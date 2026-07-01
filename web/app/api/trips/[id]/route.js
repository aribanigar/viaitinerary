import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

// The route param `id` is the human trip_id (matches the frontend).
async function findScopedTrip(tripId, adminId) {
  return prisma.trip.findFirst({ where: { tripId, userId: adminId } });
}

// GET /api/trips/:tripId
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({
    where: { tripId: params.id, userId: adminId },
    include: TRIP_INCLUDE,
  });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(serializeTrip(trip));
}

// PUT /api/trips/:tripId
export async function PUT(request, { params }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);

    const existing = await findScopedTrip(params.id, adminId);
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await request.json();
    await prisma.trip.update({ where: { id: existing.id }, data: await buildTripScalars(body) });
    await syncTripRelations(existing.id, body);

    const full = await prisma.trip.findUnique({ where: { id: existing.id }, include: TRIP_INCLUDE });
    return NextResponse.json(serializeTrip(full));
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to update trip" }, { status: 500 });
  }
}

// DELETE /api/trips/:tripId
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const existing = await findScopedTrip(params.id, adminId);
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.trip.delete({ where: { id: existing.id } }); // children cascade
  return NextResponse.json({ message: "Trip deleted" });
}
