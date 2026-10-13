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

// The columns the lite serializers read — nothing else is fetched or sent.
const HOTEL_LITE = { id: true, name: true, city: true, category: true, isAvailable: true, latitude: true, longitude: true, priceSections: true, imagePath: true };
const VEHICLE_LITE = { id: true, name: true, price: true, rateType: true, seatingCapacity: true, vehicleType: true, isAvailable: true };
const DESTINATION_LITE = { id: true, name: true, activities: true, country: true, state: true, city: true, imagePath: true };
const ACTIVITY_LITE = {
  id: true, name: true, destinationId: true, sellingPrice: true, durationHours: true, cost: true, childPrice: true,
  childCost: true, priceSections: true, category: true, city: true, imagePath: true, description: true,
};

// GET /api/builder/init?trip_id=... — bootstrap the Trip Builder.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  // Each part loads on its own: one failing query (e.g. a column the live
  // database doesn't have yet because `prisma db push` was skipped at build)
  // must not take the destinations, hotels and cabs down with it. What failed
  // is returned in `load_errors` and shown in the builder.
  //
  // Everything — including the account flag and the trip being opened — runs
  // in ONE parallel round of queries; hotels and cabs read only the columns
  // the builder's lite shapes (serializeHotel / serializeVehicle) send.
  const params = new URL(request.url).searchParams;
  const tripId = params.get("trip_id");
  // catalogs=0: the client already holds the catalogs (api/builderInit.js) and
  // only needs the trip + settings + policies — the hotels' rate sheets are
  // most of this response.
  const withCatalogs = params.get("catalogs") !== "0";
  // (A Prisma query only starts once something subscribes to it, so these two
  // get their handlers right here — which also means a failure is never an
  // unhandled rejection while the batch below is still running.)
  const tripQuery = tripId
    ? prisma.trip.findFirst({ where: { tripId, userId: adminId }, include: TRIP_INCLUDE }).then((trip) => ({ trip }), (error) => ({ error }))
    : null;
  const loadErrors = [];
  const accountQuery = prisma.user
    .findUnique({ where: { id: adminId }, select: { isDmcBridge: true } })
    .then((u) => !!u?.isDmcBridge)
    .catch((err) => {
      loadErrors.push({ part: "account", message: String(err?.message || err).split("\n").filter(Boolean).slice(-1)[0].slice(0, 300) });
      return false;
    });
  const PARTS = ["settings", "destinations", "vehicles", "hotels", "activities", "policies"];
  const settled = await Promise.allSettled([
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
    withCatalogs ? prisma.destination.findMany({ where: { userId: adminId }, orderBy: { name: "asc" }, select: DESTINATION_LITE }) : null,
    withCatalogs ? prisma.vehicle.findMany({ where: { userId: adminId }, orderBy: { name: "asc" }, select: VEHICLE_LITE }) : null,
    withCatalogs ? prisma.hotel.findMany({ where: { userId: adminId }, orderBy: { name: "asc" }, select: HOTEL_LITE }) : null,
    withCatalogs ? prisma.activity.findMany({ where: { userId: adminId, isActive: true }, orderBy: { name: "asc" }, select: ACTIVITY_LITE }) : null,
    prisma.policy.findUnique({ where: { userId: adminId } }),
  ]);
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
  const isDmcBridge = await accountQuery;

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
    policies: mappedPolicies,
    load_errors: loadErrors,
  };
  if (withCatalogs) {
    resp.destinations = (destinations || []).map(serializeDestination);
    resp.vehicles = (vehicles || []).map(serializeVehicle);
    resp.hotels = (hotels || []).map(serializeHotel);
    resp.activities = (activities || []).map(serializeActivityLite);
  }

  if (tripQuery) {
    const { trip, error } = await tripQuery;
    if (error) throw error; // as before: a trip that can't load fails the request
    resp.trip = serializeTrip(trip);
  }

  return NextResponse.json(resp);
}
