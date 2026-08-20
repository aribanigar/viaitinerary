import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// GET /api/hotels/:id/usage — rooms booked + trips this catalog hotel has been
// used in, derived live from Accommodation rows rather than stored, since a
// hotel can be reused across any number of trips.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const hotel = await prisma.hotel.findFirst({ where: { id: numId, userId: adminId } });
  if (!hotel) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const accommodations = await prisma.accommodation.findMany({
    where: { hotelId: numId },
    include: { trip: { select: { tripId: true, tripTitle: true, clientName: true } } },
    orderBy: { checkIn: "desc" },
  });

  const roomsBooked = accommodations.reduce((sum, a) => sum + (parseInt(a.rooms, 10) || 0), 0);
  const trips = accommodations
    .filter((a) => a.trip)
    .map((a) => ({
      trip_id: a.trip.tripId,
      trip_title: a.trip.tripTitle,
      client_name: a.trip.clientName,
      rooms: a.rooms,
      room_type: a.roomType,
      check_in: a.checkIn ? new Date(a.checkIn).toISOString().slice(0, 10) : null,
      check_out: a.checkOut ? new Date(a.checkOut).toISOString().slice(0, 10) : null,
    }));

  return NextResponse.json({ rooms_booked: roomsBooked, trips });
}
