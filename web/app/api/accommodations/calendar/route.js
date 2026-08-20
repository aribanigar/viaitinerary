import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// GET /api/accommodations/calendar?month=YYYY-MM — every hotel booking whose
// stay overlaps the given month (default: current month), across all hotels
// for the agency. Powers the Hotel Booking Calendar view.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map((n) => parseInt(n, 10))
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const stays = await prisma.accommodation.findMany({
    where: {
      trip: { userId: adminId },
      checkIn: { lte: monthEnd },
      checkOut: { gte: monthStart },
    },
    include: {
      hotel: { select: { id: true, name: true, city: true } },
      trip: { select: { tripId: true, tripTitle: true, clientName: true, status: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  return NextResponse.json({
    month: `${year}-${String(month).padStart(2, "0")}`,
    data: stays.map((s) => ({
      id: s.id,
      hotel_id: s.hotelId,
      hotel_name: s.hotel?.name || s.name,
      city: s.hotel?.city || s.city,
      check_in: dateOnly(s.checkIn),
      check_out: dateOnly(s.checkOut),
      rooms: s.rooms,
      room_type: s.roomType,
      cancelled: !!s.cancelledAt,
      trip_id: s.trip?.tripId,
      trip_title: s.trip?.tripTitle,
      client_name: s.trip?.clientName,
      status: s.cancelledAt ? "cancelled" : s.trip?.status || "pending",
    })),
  });
}
