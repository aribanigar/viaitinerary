import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { operationsBoard, todayIST } from "@/lib/operations";

export const dynamic = "force-dynamic";

// GET /api/operations?from=YYYY-MM-DD&days=1..14 — arrivals, departures,
// check-ins/outs and cabs per day, plus bookings still awaiting supplier
// confirmation and trips with a balance due (next 30 days).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const sp = new URL(request.url).searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") || "") ? sp.get("from") : todayIST();
  return NextResponse.json(await operationsBoard(adminId, { from, days: Number(sp.get("days")) || 1 }));
}
