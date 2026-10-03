import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { cabGroupKey, SUPPLIER_STATUSES } from "@/lib/operations";

export const dynamic = "force-dynamic";

const clip = (v, n) => (v == null ? undefined : String(v).trim().slice(0, n) || null);

// PATCH /api/trips/:tripId/bookings — the agent updates a booking's supplier
// status / confirmation number, or a cab's driver.
// { kind: "hotel"|"cab", id?, date?, group?: true, status?, reference?, note?,
//   driver_name?, driver_phone?, vehicle_number? }
// Cabs: `group` (default) applies to every day of that vehicle; `date` to that
// day only; with no id the first cab group of the trip is used (voice: "the
// driver for Rahul's trip is …").
export async function PATCH(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({
    where: { tripId: params.id, userId: adminId },
    include: { accommodations: true, transportations: true },
  });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const kind = b.kind === "cab" ? "cab" : b.kind === "hotel" ? "hotel" : null;
  if (!kind) return NextResponse.json({ message: "kind must be hotel or cab." }, { status: 422 });
  if (b.status !== undefined && b.status !== null && !SUPPLIER_STATUSES.includes(b.status)) {
    return NextResponse.json({ message: "Unknown status." }, { status: 422 });
  }

  const data = {};
  if (b.status !== undefined) {
    data.supplierStatus = b.status || null;
    if (b.status === "confirmed" || b.status === "declined") data.supplierRespondedAt = new Date();
  }
  if (b.reference !== undefined) data.supplierRef = clip(b.reference, 120);
  if (b.note !== undefined) data.supplierNote = clip(b.note, 1000);

  let ids;
  if (kind === "hotel") {
    const row = trip.accommodations.find((a) => a.id === Number(b.id));
    if (!row) return NextResponse.json({ message: "Hotel booking not found." }, { status: 404 });
    ids = [row.id];
    await prisma.accommodation.updateMany({ where: { id: { in: ids }, tripId: trip.id }, data });
  } else {
    if (b.driver_name !== undefined) data.driverName = clip(b.driver_name, 120);
    if (b.driver_phone !== undefined) data.driverPhone = clip(b.driver_phone, 40);
    if (b.vehicle_number !== undefined) data.vehicleNumber = clip(b.vehicle_number, 40)?.toUpperCase() ?? null;
    const cabs = trip.transportations.filter((t) => !t.cancelledAt);
    const row = b.id ? cabs.find((t) => t.id === Number(b.id)) : cabs.sort((x, y) => new Date(x.date || 0) - new Date(y.date || 0))[0];
    if (!row) return NextResponse.json({ message: "This trip has no cab bookings." }, { status: 404 });
    const day = b.date ? String(b.date).slice(0, 10) : null;
    ids = day
      ? cabs.filter((t) => t.date && t.date.toISOString().slice(0, 10) === day && cabGroupKey(t) === cabGroupKey(row)).map((t) => t.id)
      : b.group === false
        ? [row.id]
        : cabs.filter((t) => cabGroupKey(t) === cabGroupKey(row)).map((t) => t.id);
    if (!ids.length) return NextResponse.json({ message: "No cab booked that day." }, { status: 404 });
    await prisma.transportation.updateMany({ where: { id: { in: ids }, tripId: trip.id }, data });
  }
  return NextResponse.json({ message: "Booking updated.", updated: ids.length, ids });
}
