import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// GET /api/activities/:id/usage — the trips this catalog activity is on, with
// persons booked, derived live from TripActivity rows (like /api/hotels/:id/usage).
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const activity = await prisma.activity.findFirst({ where: { id: numId, userId: adminId } });
  if (!activity) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const rows = await prisma.tripActivity.findMany({
    where: { activityId: numId, trip: { userId: adminId } },
    include: { trip: { select: { tripId: true, tripTitle: true, clientName: true, startDate: true } } },
    orderBy: { createdAt: "desc" },
  });

  const day = (startDate, n) =>
    startDate && n ? dateOnly(new Date(new Date(startDate).getTime() + (n - 1) * 86400000)) : null;
  const persons = rows.reduce((sum, a) => sum + (a.ticketCount || 0) + (a.childCount || 0), 0);
  const trips = rows
    .filter((a) => a.trip)
    .map((a) => ({
      trip_id: a.trip.tripId,
      trip_title: a.trip.tripTitle,
      client_name: a.trip.clientName,
      persons: (a.ticketCount || 0) + (a.childCount || 0),
      day_number: a.dayNumber,
      date: day(a.trip.startDate, a.dayNumber),
    }));

  return NextResponse.json({ persons_booked: persons, trips });
}
