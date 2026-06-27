import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import {
  serializeSettings,
  serializeDestination,
  serializeHotel,
  serializeVehicle,
  serializeTrip,
} from "@/lib/serialize";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

// GET /api/builder/init?trip_id=... — bootstrap the Trip Builder.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const [settings, destinations, vehicles, hotels, policy] = await Promise.all([
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
    prisma.destination.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.hotel.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.policy.findUnique({ where: { userId: adminId } }),
  ]);

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
    settings: serializeSettings(settings),
    destinations: destinations.map(serializeDestination),
    vehicles: vehicles.map(serializeVehicle),
    hotels: hotels.map(serializeHotel),
    policies: mappedPolicies,
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
