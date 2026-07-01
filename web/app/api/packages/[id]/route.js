import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function findPackage(id, adminId) {
  return prisma.trip.findFirst({ where: { tripId: id, userId: adminId, isPackage: true } });
}

// GET /api/packages/:id — full package (for the builder).
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const pkg = await prisma.trip.findFirst({
    where: { tripId: params.id, userId: adminId, isPackage: true },
    include: TRIP_INCLUDE,
  });
  if (!pkg) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(serializeTrip(pkg));
}

// PUT /api/packages/:id — update package scalars + children + locked flag.
export async function PUT(request, { params }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);

    const existing = await findPackage(params.id, adminId);
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await request.json();
    const scalars = await buildTripScalars(body);
    await prisma.trip.update({
      where: { id: existing.id },
      data: { ...scalars, status: "template", locked: body.locked !== undefined ? !!body.locked : existing.locked },
    });
    await syncTripRelations(existing.id, body);

    const full = await prisma.trip.findUnique({ where: { id: existing.id }, include: TRIP_INCLUDE });
    return NextResponse.json(serializeTrip(full));
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to update package" }, { status: 500 });
  }
}

// DELETE /api/packages/:id
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const existing = await findPackage(params.id, adminId);
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.trip.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
