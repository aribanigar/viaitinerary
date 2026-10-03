import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";
import { loadProposalTrip } from "@/lib/publicProposalTrip";
import { paymentSchedule, amountFor } from "@/lib/paymentSchedule";
import { agencyRazorpayKeys } from "@/lib/clientPayments";
import { createRazorpayOrder } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = ["advance", "balance", "full"];

// POST /api/public/proposals/:token/pay { kind } — Razorpay order on the
// AGENCY's account. The amount is always computed here from the trip's
// payment schedule; the client never chooses it.
export async function POST(request, { params }) {
  const limit = await rateLimit(`proposal-pay:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const found = await loadProposalTrip(params.token);
  if (!found) return NextResponse.json({ message: "This proposal link is no longer valid." }, { status: 404 });
  const { trip, settings } = found;
  const keys = agencyRazorpayKeys(settings);
  if (!keys) return NextResponse.json({ message: "Online payment isn't set up for this trip." }, { status: 422 });

  const body = await request.json().catch(() => ({}));
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  if (!kind) return NextResponse.json({ message: "Unknown payment." }, { status: 422 });
  const amount = amountFor(kind, paymentSchedule(trip, settings));
  if (!(amount >= 1)) return NextResponse.json({ message: "Nothing is due for this payment." }, { status: 422 });

  let order;
  try {
    order = await createRazorpayOrder(
      {
        amountPaise: Math.round(amount * 100),
        currency: "INR",
        receipt: `${trip.tripId}-${kind}-${Date.now().toString(36)}`.slice(0, 40),
        notes: { trip_id: trip.tripId, kind },
      },
      keys,
    );
  } catch (err) {
    return NextResponse.json({ message: `Couldn't start the payment: ${err.message}` }, { status: 502 });
  }
  await prisma.clientPayment.create({
    data: { tripId: trip.id, userId: trip.userId, kind, amount, method: "razorpay", status: "created", razorpayOrderId: order.id },
  });

  const label = { advance: "Advance", balance: "Balance", full: "Payment" }[kind];
  return NextResponse.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency || "INR",
    key_id: keys.keyId,
    name: settings?.agencyName || "Travel booking",
    description: `${label} for ${trip.tripTitle}`.slice(0, 250),
    prefill: { name: trip.clientName || "" },
  });
}
