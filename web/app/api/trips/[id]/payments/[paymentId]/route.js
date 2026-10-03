import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { recordClientPayment, agencyPaymentView } from "@/lib/clientPayments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/trips/:tripId/payments/:paymentId { action: "verify" | "reject" }
// Verify a client's "I've paid" claim (records the receipt exactly like an
// online payment) or reject it.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId } });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const cp = await prisma.clientPayment.findFirst({ where: { id: Number(params.paymentId) || -1, tripId: trip.id } });
  if (!cp) return NextResponse.json({ message: "Payment not found" }, { status: 404 });
  if (cp.status !== "claimed") return NextResponse.json({ message: "This payment isn't waiting for verification." }, { status: 422 });

  const body = await request.json().catch(() => ({}));
  if (body.action === "verify") {
    await recordClientPayment(cp, { status: "verified", actorId: user.id });
  } else if (body.action === "reject") {
    await prisma.clientPayment.update({ where: { id: cp.id }, data: { status: "rejected" } });
  } else {
    return NextResponse.json({ message: "Unknown action." }, { status: 422 });
  }

  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
  const fresh = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: { clientPayments: { orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json(agencyPaymentView(fresh, settings, fresh.clientPayments));
}
