import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// GET /api/vehicles/:id/usage — trips this catalog vehicle has been booked
// on, derived live from Transportation rows rather than stored, since a
// vehicle can be reused across any number of trips.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: numId, userId: adminId } });
  if (!vehicle) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const bookings = await prisma.transportation.findMany({
    where: { vehicleId: numId },
    include: { trip: { select: { tripId: true, tripTitle: true, clientName: true } } },
    orderBy: { date: "desc" },
  });

  const vehiclesBooked = bookings.reduce((sum, t) => sum + (parseInt(t.quantity, 10) || 0), 0);
  const trips = bookings
    .filter((t) => t.trip)
    .map((t) => ({
      trip_id: t.trip.tripId,
      trip_title: t.trip.tripTitle,
      client_name: t.trip.clientName,
      quantity: t.quantity,
      route: t.route || t.destination,
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
    }));

  return NextResponse.json({ vehicles_booked: vehiclesBooked, trips });
}
