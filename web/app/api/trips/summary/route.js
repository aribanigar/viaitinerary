import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { LIST_COLUMNS, listRows } from "@/lib/tripList";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 31;

// GET /api/trips/summary?from=YYYY-MM-DD&to=YYYY-MM-DD — the dashboard's
// numbers without downloading every trip (it used to fetch up to 1000 list
// rows to count them): counts and money summed in the database, plus only the
// trips starting between `from` and `to` (the "today" / "next 7 days" lists),
// in the same row shape as GET /api/trips. Same tenant scope and filter
// (the agency's trips, packages excluded) as that list.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const where = { userId: adminId, isPackage: false };

  const sp = new URL(request.url).searchParams;
  let from = DAY.test(sp.get("from") || "") ? sp.get("from") : null;
  let to = DAY.test(sp.get("to") || "") ? sp.get("to") : null;
  if (!from || !to) {
    const today = new Date().toISOString().slice(0, 10);
    from = from || today;
    to = to || today;
  }
  // A bounded window: this is for the dashboard's short lists, not a search.
  const fromD = new Date(`${from}T00:00:00Z`);
  let toD = new Date(`${to}T23:59:59Z`);
  if ((toD - fromD) / 86400000 > MAX_WINDOW_DAYS) toD = new Date(fromD.getTime() + MAX_WINDOW_DAYS * 86400000);

  const [total, byStatus, money, windowTrips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.trip.aggregate({ where, _sum: { paidAmount: true } }),
    prisma.trip.findMany({
      where: { ...where, startDate: { gte: fromD, lte: toD } },
      orderBy: { startDate: "asc" },
      take: 200,
      select: LIST_COLUMNS,
    }),
  ]);

  // Status is free text in old rows ("Confirmed" / "confirmed"): count case-insensitively,
  // exactly as the dashboard did in the browser.
  const status = {};
  for (const row of byStatus) {
    const key = String(row.status || "").toLowerCase();
    status[key] = (status[key] || 0) + row._count._all;
  }

  return NextResponse.json({
    total,
    status,
    paid_total: Number(money._sum.paidAmount || 0),
    from,
    to: toD.toISOString().slice(0, 10),
    trips: await listRows(windowTrips, user),
  });
}
