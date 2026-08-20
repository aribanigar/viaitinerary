import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { catalogHotelBlackout } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

async function scopedHotel(request, id) {
  const user = await userFromRequest(request);
  if (!user) return { error: unauth() };
  const adminId = await adminIdOf(user);
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return { error: NextResponse.json({ message: "Invalid id" }, { status: 400 }) };
  const hotel = await prisma.hotel.findFirst({ where: { id: numId, userId: adminId } });
  if (!hotel) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { hotel };
}

// GET /api/hotels/:id/blackouts — list stop-sale/blackout date ranges for a hotel.
export async function GET(request, { params }) {
  const r = await scopedHotel(request, params.id);
  if (r.error) return r.error;
  const blackouts = await prisma.hotelBlackout.findMany({
    where: { hotelId: r.hotel.id },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json({ data: blackouts.map(catalogHotelBlackout) });
}

// POST /api/hotels/:id/blackouts — add a stop-sale or blackout date range.
export async function POST(request, { params }) {
  const r = await scopedHotel(request, params.id);
  if (r.error) return r.error;
  const body = await request.json().catch(() => ({}));

  if (!body.start_date || !body.end_date) {
    return NextResponse.json({ message: "start_date and end_date are required." }, { status: 422 });
  }
  const type = body.type === "stop_sale" ? "stop_sale" : "blackout";

  const created = await prisma.hotelBlackout.create({
    data: {
      hotelId: r.hotel.id,
      roomType: body.room_type || null,
      type,
      startDate: new Date(body.start_date),
      endDate: new Date(body.end_date),
      note: body.note || null,
    },
  });
  return NextResponse.json(catalogHotelBlackout(created), { status: 201 });
}
