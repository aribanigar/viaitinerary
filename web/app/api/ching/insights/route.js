import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { recordInsights, readInsights, setMissStatus, deleteMisses } from "@/lib/chingInsight";

export const dynamic = "force-dynamic";

// How Ching is doing (lib/chingInsight.js): what it missed, and the daily numbers.
const isSuper = (user) => user?.role === "super_admin";

// GET /api/ching/insights?days=14 — this agency's report.
// ?all=1 (platform super admins only): every agency together.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const days = Math.max(1, Math.min(90, Number(q.get("days")) || 14));
  if (q.get("all") === "1") {
    if (!isSuper(user)) return NextResponse.json({ message: "Not allowed." }, { status: 403 });
    return NextResponse.json({ scope: "all", ...(await readInsights(null, { days })) });
  }
  return NextResponse.json({ scope: "agency", can_see_all: isSuper(user), ...(await readInsights(await adminIdOf(user), { days })) });
}

// POST /api/ching/insights { events: [{ type: "miss", kind, key, shape, text, page } | { type: "stat", name, n }] }
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const r = await recordInsights(await adminIdOf(user), user.id, b.events);
  return NextResponse.json({ recorded: true, ...r });
}

// PATCH /api/ching/insights { key, status: "done" | "ignored" | "open" }
export async function PATCH(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const ok = await setMissStatus(await adminIdOf(user), b.key, String(b.status || ""));
  return ok ? NextResponse.json({ key: b.key, status: b.status }) : NextResponse.json({ message: "Not found." }, { status: 404 });
}

// DELETE /api/ching/insights { key? } — one miss, or (no key) the whole list. The daily numbers stay.
export async function DELETE(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  return NextResponse.json({ deleted: await deleteMisses(await adminIdOf(user), b.key || null) });
}
