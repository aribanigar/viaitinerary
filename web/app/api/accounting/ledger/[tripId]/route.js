import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { syncTrip, serializeObligation } from "@/lib/accounting";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

const num = (v) => (v == null ? 0 : Number(v));

const DIRECTION_ORDER = { receivable: 0, payable: 1 };
const PARTY_ORDER = { client: 0, hotel: 1, cab: 2, manual: 3 };

// GET /api/accounting/ledger/:tripId — single trip ledger (obligations + summary).
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const teamId = teamIdOf(user);

  const trip = await prisma.trip.findFirst({
    where: { tripId: params.tripId, userId: adminId },
    include: TRIP_INCLUDE,
  });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await syncTrip(trip, adminId, teamId);

  const obligations = await prisma.accountingObligation.findMany({
    where: { tripId: trip.id },
    include: { settlements: { orderBy: [{ settlementDate: "desc" }, { id: "desc" }] } },
  });

  // Portable ordering: receivable first, then payable; client/hotel/cab/manual within.
  obligations.sort((a, b) => {
    const d = (DIRECTION_ORDER[a.direction] ?? 2) - (DIRECTION_ORDER[b.direction] ?? 2);
    if (d !== 0) return d;
    const p = (PARTY_ORDER[a.partyType] ?? 4) - (PARTY_ORDER[b.partyType] ?? 4);
    if (p !== 0) return p;
    return a.id - b.id;
  });

  const receivableExpected = obligations
    .filter((o) => o.direction === "receivable")
    .reduce((s, o) => s + num(o.expectedAmount), 0);
  const receivableSettled = obligations
    .filter((o) => o.direction === "receivable")
    .reduce((s, o) => s + num(o.settledAmount), 0);
  const payableExpected = obligations
    .filter((o) => o.direction === "payable")
    .reduce((s, o) => s + num(o.expectedAmount), 0);
  const payableSettled = obligations
    .filter((o) => o.direction === "payable")
    .reduce((s, o) => s + num(o.settledAmount), 0);

  const summary = {
    receivable_expected: receivableExpected,
    receivable_settled: receivableSettled,
    receivable_remaining: Math.max(0, receivableExpected - receivableSettled),
    payable_expected: payableExpected,
    payable_settled: payableSettled,
    payable_remaining: Math.max(0, payableExpected - payableSettled),
  };

  return NextResponse.json({
    trip: {
      trip_id: trip.tripId,
      trip_title: trip.tripTitle,
      client_name: trip.clientName,
      status: trip.status,
      start_date: trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 10) : null,
      currency: trip.currency,
    },
    summary,
    obligations: obligations.map(serializeObligation),
  });
}
