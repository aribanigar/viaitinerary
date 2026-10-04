import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import {
  serializeSettings,
  serializeDestination,
  serializeHotel,
  serializeVehicle,
  serializeActivityLite,
  serializeTrip,
} from "@/lib/serialize";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

// GET /api/builder/init?trip_id=... — bootstrap the Trip Builder.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  // Each part loads on its own: one failing query (e.g. a column the live
  // database doesn't have yet because `prisma db push` was skipped at build)
  // must not take the destinations, hotels and cabs down with it. What failed
  // is returned in `load_errors` and shown in the builder.
  const PARTS = ["settings", "destinations", "vehicles", "hotels", "activities", "policies"];
  const settled = await Promise.allSettled([
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
    prisma.destination.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.hotel.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.activity.findMany({ where: { userId: adminId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.policy.findUnique({ where: { userId: adminId } }),
  ]);
  const loadErrors = [];
  const part = (i, fallback) => {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value;
    const message = String(r.reason?.message || r.reason || "failed").split("\n").filter(Boolean).slice(-1)[0].slice(0, 300);
    console.error(`builder/init: ${PARTS[i]} failed:`, r.reason);
    loadErrors.push({ part: PARTS[i], message });
    return fallback;
  };
  const settings = part(0, null);
  const destinations = part(1, []);
  const vehicles = part(2, []);
  const hotels = part(3, []);
  const activities = part(4, []);
  const policy = part(5, null);
  const isDmcBridge = await prisma.user
    .findUnique({ where: { id: adminId }, select: { isDmcBridge: true } })
    .then((u) => !!u?.isDmcBridge)
    .catch((err) => {
      loadErrors.push({ part: "account", message: String(err?.message || err).split("\n").filter(Boolean).slice(-1)[0].slice(0, 300) });
      return false;
    });

  const flat = (v) => (Array.isArray(v) ? v.join("\n") : v ?? "");
  const mappedPolicies = policy
    ? {
        terms_conditions: flat(policy.termsConditions),
        must_haves: flat(policy.mustHaves),
        roles_responsibilities: flat(policy.rolesResponsibilities),
        cancellation_policy: flat(policy.cancellationPolicy),
        additional_expenses: flat(policy.additionalExpenses),
        default_inclusions: policy.defaultInclusions ?? [],
        default_exclusions: policy.defaultExclusions ?? [],
      }
    : null;

  const resp = {
    // DMC partner agencies get the "Powered by Via Kashmir" mark on every itinerary page.
    settings: { ...serializeSettings(settings), powered_by_via_kashmir: isDmcBridge },
    destinations: destinations.map(serializeDestination),
    vehicles: vehicles.map(serializeVehicle),
    hotels: hotels.map(serializeHotel),
    activities: activities.map(serializeActivityLite),
    policies: mappedPolicies,
    load_errors: loadErrors,
  };

  const tripId = new URL(request.url).searchParams.get("trip_id");
  if (tripId) {
    const trip = await prisma.trip.findFirst({
      where: { tripId, userId: adminId },
      include: TRIP_INCLUDE,
    });
    resp.trip = serializeTrip(trip);
  }

  return NextResponse.json(resp);
}
