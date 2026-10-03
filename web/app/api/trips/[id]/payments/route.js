import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { agencyPaymentView, reconcilePendingOrders } from "@/lib/clientPayments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function load(request, params) {
  const user = await userFromRequest(request);
  if (!user) return { error: NextResponse.json({ message: "Unauthenticated." }, { status: 401 }) };
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId } });
  if (!trip) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
  return { user, adminId, trip, settings };
}

async function view(trip, settings) {
  const fresh = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: { clientPayments: { orderBy: { createdAt: "desc" } } },
  });
  return agencyPaymentView(fresh, settings, fresh.clientPayments);
}

// GET /api/trips/:tripId/payments — schedule + client payments (and claims to verify).
export async function GET(request, { params }) {
  const { error, trip, settings } = await load(request, params);
  if (error) return error;
  await reconcilePendingOrders(trip, settings);
  return NextResponse.json(await view(trip, settings));
}

// POST /api/trips/:tripId/payments { advance_amount: number | null } — advance override.
export async function POST(request, { params }) {
  const { error, trip, settings } = await load(request, params);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (!("advance_amount" in body)) return NextResponse.json({ message: "Nothing to update." }, { status: 422 });
  const raw = body.advance_amount;
  const value = raw === null || raw === "" ? null : Number(raw);
  if (value !== null && !(value >= 0)) return NextResponse.json({ message: "Advance must be 0 or more." }, { status: 422 });
  await prisma.trip.update({ where: { id: trip.id }, data: { advanceAmount: value } });
  return NextResponse.json(await view({ ...trip }, settings));
}
