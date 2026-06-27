import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { syncTrip } from "@/lib/accounting";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

const num = (v) => (v == null ? 0 : Number(v));

// GET /api/accounting/ledger — paginated trip-level ledger summary.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const teamId = teamIdOf(user);

  const { searchParams } = new URL(request.url);
  const perPage = Math.min(Math.max(1, parseInt(searchParams.get("per_page") || "25", 10)), 500);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const status = searchParams.get("status");
  const query = (searchParams.get("query") || "").trim();

  const where = { userId: adminId };
  if (query) {
    where.OR = [
      { tripId: { contains: query, mode: "insensitive" } },
      { tripTitle: { contains: query, mode: "insensitive" } },
      { clientName: { contains: query, mode: "insensitive" } },
    ];
  }

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: TRIP_INCLUDE,
    }),
  ]);

  // Refresh obligations for each visible trip, then aggregate.
  for (const trip of trips) {
    await syncTrip(trip, adminId, teamId);
  }

  const tripIds = trips.map((t) => t.id);
  const obligations = tripIds.length
    ? await prisma.accountingObligation.findMany({ where: { tripId: { in: tripIds } } })
    : [];

  const byTrip = new Map();
  for (const id of tripIds) byTrip.set(id, []);
  for (const o of obligations) byTrip.get(o.tripId)?.push(o);

  const rows = [];
  for (const trip of trips) {
    const list = byTrip.get(trip.id) || [];
    const receivable = list.find((o) => o.direction === "receivable" && o.sourceType === "trip");

    // Status filter applies to the trip-level receivable obligation.
    if (status && receivable && receivable.status !== status) continue;

    const sum = (pred, field) =>
      list.filter(pred).reduce((acc, o) => acc + num(o[field]), 0);

    const receivableExpected = sum((o) => o.direction === "receivable", "expectedAmount");
    const receivableSettled = sum((o) => o.direction === "receivable", "settledAmount");
    const hotelExpected = sum((o) => o.direction === "payable" && o.partyType === "hotel", "expectedAmount");
    const hotelSettled = sum((o) => o.direction === "payable" && o.partyType === "hotel", "settledAmount");
    const cabExpected = sum((o) => o.direction === "payable" && o.partyType === "cab", "expectedAmount");
    const cabSettled = sum((o) => o.direction === "payable" && o.partyType === "cab", "settledAmount");
    const payableExpected = sum((o) => o.direction === "payable", "expectedAmount");
    const payableSettled = sum((o) => o.direction === "payable", "settledAmount");

    const receivableRemaining = Math.max(0, receivableExpected - receivableSettled);
    const payableRemaining = Math.max(0, payableExpected - payableSettled);

    rows.push({
      trip_id: trip.tripId,
      trip_title: trip.tripTitle,
      client_name: trip.clientName,
      status: trip.status,
      start_date: trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 10) : null,
      currency: trip.currency,
      receivable_expected: receivableExpected,
      receivable_settled: receivableSettled,
      receivable_remaining: receivableRemaining,
      hotel_expected: hotelExpected,
      hotel_settled: hotelSettled,
      hotel_remaining: Math.max(0, hotelExpected - hotelSettled),
      cab_expected: cabExpected,
      cab_settled: cabSettled,
      cab_remaining: Math.max(0, cabExpected - cabSettled),
      payable_expected: payableExpected,
      payable_settled: payableSettled,
      payable_remaining: payableRemaining,
      net_position: receivableRemaining - payableRemaining,
    });
  }

  return NextResponse.json({
    data: rows,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}
