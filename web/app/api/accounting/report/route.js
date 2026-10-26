import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { syncTrip } from "@/lib/accounting";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Trips whose obligations are older than the trip are re-synced before the
// report is built; at most this many per request (the rest on the next load).
const SYNC_LIMIT = 80;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/accounting/report?from=YYYY-MM-DD&to=YYYY-MM-DD&basis=travel|booking&tz=-330
// Every trip in the range (no page cap), aggregated by lib/report.js.
// basis=travel → by start date; basis=booking → by the day the trip was created
// (in the agent's time zone, `tz` = Date#getTimezoneOffset, IST when absent).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const teamId = teamIdOf(user);

  const sp = new URL(request.url).searchParams;
  const basis = sp.get("basis") === "booking" ? "booking" : "travel";
  const from = DAY.test(sp.get("from") || "") ? sp.get("from") : null;
  const to = DAY.test(sp.get("to") || "") ? sp.get("to") : null;
  const tzRaw = parseInt(sp.get("tz") ?? "", 10);
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : -330;

  const where = { userId: adminId, isPackage: false };
  if (from || to) {
    // Dates are whole days: [from 00:00, to+1 00:00).
    const bound = (day, plusDays = 0) => {
      const t = Date.parse(`${day}T00:00:00Z`) + plusDays * 86400000;
      return new Date(basis === "booking" ? t + tz * 60000 : t);
    };
    const range = {};
    if (from) range.gte = bound(from);
    if (to) range.lt = bound(to, 1);
    where[basis === "booking" ? "createdAt" : "startDate"] = range;
  }

  const select = {
    id: true, userId: true, teamId: true, tripId: true, tripTitle: true, clientName: true, clientPhone: true,
    destination: true, status: true, startDate: true, createdAt: true, updatedAt: true, currency: true,
    cost: true, gstAmount: true, includeGst: true, paidAmount: true, refundedAmount: true,
    tripActivities: { select: { costPerTicket: true, ticketCount: true, childCost: true, childCount: true } },
    obligations: {
      select: { direction: true, partyType: true, partyId: true, partyName: true, sourceType: true, expectedAmount: true, settledAmount: true, updatedAt: true },
    },
  };
  let trips = await prisma.trip.findMany({ where, select, orderBy: { startDate: "asc" } });

  // Refresh accounting for trips edited since their obligations were written
  // (the builder doesn't sync on save; the ledger and payments do).
  const stale = trips
    .filter((t) => {
      const rec = t.obligations.find((o) => o.direction === "receivable" && o.sourceType === "trip");
      return !rec || new Date(rec.updatedAt) < new Date(t.updatedAt);
    })
    .slice(0, SYNC_LIMIT);
  if (stale.length) {
    const full = await prisma.trip.findMany({
      where: { id: { in: stale.map((t) => t.id) }, userId: adminId },
      include: { accommodations: true, transportations: { include: { vehicle: { select: { price: true, name: true } } } } },
    });
    for (const t of full) {
      try {
        await syncTrip(t, adminId, teamId);
      } catch (err) {
        console.error(`report: sync failed for ${t.tripId}`, err);
      }
    }
    const fresh = await prisma.accountingObligation.findMany({
      where: { tripId: { in: stale.map((t) => t.id) } },
      select: { tripId: true, ...select.obligations.select },
    });
    const byTrip = new Map();
    for (const o of fresh) (byTrip.get(o.tripId) || byTrip.set(o.tripId, []).get(o.tripId)).push(o);
    trips = trips.map((t) => (byTrip.has(t.id) ? { ...t, obligations: byTrip.get(t.id) } : t));
  }

  const report = buildReport(trips, { basis, tzOffsetMin: tz });
  return NextResponse.json({ from, to, ...report, synced: stale.length });
}
