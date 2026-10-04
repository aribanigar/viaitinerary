import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { searchHotels, bookedByHotel, nightsBetween, MEAL_PLANS } from "@/lib/hotelSearch";

export const dynamic = "force-dynamic";

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const shape = (r) =>
  r && {
    id: r.id ?? null,
    name: r.name,
    city: r.city ?? "",
    stars: r.stars ?? null,
    room_type: r.roomType ?? "",
    meal_plan: r.mealPlan ?? "",
    meal_plan_on_sheet: r.mealPlanOnSheet ?? false,
    rate_per_night: r.rate ?? null,
    total: r.total ?? null,
    nights: r.nights ?? null,
    rooms: r.rooms ?? null,
    dated: r.dated ?? false,
    availability: r.availability ? { status: r.availability.status, free_rooms: r.availability.freeRooms ?? null, note: r.availability.note } : null,
    ...(r.usable !== undefined ? { usable: r.usable, why: r.why || "" } : {}),
  };

/**
 * GET /api/hotels/search — Ching's hotel search over the agency's own catalog
 * (lib/hotelSearch.js). Query: city, min_stars, max_stars, max_rate, min_rate,
 * meal_plan (room_only|breakfast_only|breakfast_dinner|all_meals), room_type,
 * sort (cheapest|best), prefer (a hotel name to try first), check_in,
 * check_out (YYYY-MM-DD), nights, rooms, exclude_trip (the trip being edited —
 * its own rooms don't count against availability), limit.
 * Rates, room counts, stop-sales and bookings all come from this agency's rows.
 */
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const q = new URL(request.url).searchParams;

  const checkIn = isDate(q.get("check_in")) ? q.get("check_in") : null;
  let checkOut = isDate(q.get("check_out")) ? q.get("check_out") : null;
  const nights = int(q.get("nights"));
  if (checkIn && !checkOut && nights) checkOut = new Date(Date.parse(`${checkIn}T00:00:00Z`) + nights * 86400000).toISOString().slice(0, 10);
  if (checkIn && checkOut && nightsBetween(checkIn, checkOut) < 1) {
    return NextResponse.json({ message: "Check-out must be after check-in." }, { status: 422 });
  }
  const mealPlan = MEAL_PLANS.includes(q.get("meal_plan")) ? q.get("meal_plan") : "";

  const hotels = await prisma.hotel.findMany({
    where: { userId: adminId },
    select: { id: true, name: true, city: true, category: true, isAvailable: true, priceSections: true, totalRooms: true },
  });
  const ids = hotels.map((h) => h.id);

  let blackoutsByHotel = {};
  let booked = {};
  if (checkIn && checkOut && ids.length) {
    const from = new Date(`${checkIn}T00:00:00Z`);
    const to = new Date(`${checkOut}T00:00:00Z`);
    const [blackouts, stays] = await Promise.all([
      prisma.hotelBlackout.findMany({ where: { hotelId: { in: ids }, startDate: { lt: to }, endDate: { gte: from } } }),
      prisma.accommodation.findMany({
        where: {
          hotelId: { in: ids },
          cancelledAt: null,
          checkIn: { lt: to },
          checkOut: { gt: from },
          trip: { userId: adminId, ...(q.get("exclude_trip") ? { tripId: { not: q.get("exclude_trip") } } : {}) },
        },
        select: { hotelId: true, checkIn: true, checkOut: true, rooms: true, cancelledAt: true },
      }),
    ]);
    for (const b of blackouts) (blackoutsByHotel[b.hotelId] = blackoutsByHotel[b.hotelId] || []).push(b);
    booked = bookedByHotel(stays);
  }

  const out = searchHotels(
    hotels,
    {
      city: q.get("city") || "",
      minStars: int(q.get("min_stars")),
      maxStars: int(q.get("max_stars")),
      maxRate: int(q.get("max_rate")),
      minRate: int(q.get("min_rate")),
      mealPlan,
      roomType: q.get("room_type") || "",
      sort: q.get("sort") === "cheapest" ? "cheapest" : "best",
      prefer: q.get("prefer") || "",
      limit: Math.min(10, int(q.get("limit")) || 5),
    },
    { checkIn, checkOut, nights, rooms: int(q.get("rooms")) || 1, blackoutsByHotel, bookedByHotel: booked },
  );

  return NextResponse.json({
    results: out.results.map(shape),
    total: out.total,
    preferred: shape(out.preferred),
    near: shape(out.near),
    checked: out.checked,
    excluded: out.excluded,
    check_in: checkIn,
    check_out: checkOut,
  });
}
