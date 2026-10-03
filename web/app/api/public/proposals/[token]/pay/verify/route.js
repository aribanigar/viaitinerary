import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loadProposalTrip } from "@/lib/publicProposalTrip";
import { agencyRazorpayKeys, recordClientPayment, paymentView } from "@/lib/clientPayments";
import { verifyRazorpaySignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/public/proposals/:token/pay/verify
//   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Checks the checkout signature with the agency's secret and records the
// payment. Idempotent: verifying the same payment twice changes nothing.
export async function POST(request, { params }) {
  const found = await loadProposalTrip(params.token);
  if (!found) return NextResponse.json({ message: "This proposal link is no longer valid." }, { status: 404 });
  const { trip, settings } = found;
  const keys = agencyRazorpayKeys(settings);
  if (!keys) return NextResponse.json({ message: "Online payment isn't set up for this trip." }, { status: 422 });

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const cp = orderId ? await prisma.clientPayment.findUnique({ where: { razorpayOrderId: orderId } }) : null;
  if (!cp || cp.tripId !== trip.id) return NextResponse.json({ message: "Unknown payment." }, { status: 404 });
  if (!verifyRazorpaySignature({ orderId, paymentId, signature: body.razorpay_signature }, keys)) {
    return NextResponse.json({ message: "We couldn't verify this payment. If money was deducted, please contact us." }, { status: 400 });
  }

  await recordClientPayment(cp, { paymentId });
  const fresh = await prisma.trip.findUnique({ where: { id: trip.id }, include: { clientPayments: true } });
  return NextResponse.json({ ok: true, payment: paymentView(fresh, settings, fresh.clientPayments) });
}
