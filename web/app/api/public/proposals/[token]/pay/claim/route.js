import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";
import { loadProposalTrip } from "@/lib/publicProposalTrip";
import { paymentSchedule, amountFor } from "@/lib/paymentSchedule";
import { paymentView, emailAgency } from "@/lib/clientPayments";
import { currencySymbol } from "@/lib/serialize";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/public/proposals/:token/pay/claim { kind, method: "upi"|"bank", reference, payer_name, note }
// "I've paid" by UPI / bank transfer. NOT counted as paid until the agency
// verifies it (POST /api/trips/:id/payments/:paymentId { action: "verify" }).
export async function POST(request, { params }) {
  const limit = await rateLimit(`proposal-claim:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const found = await loadProposalTrip(params.token);
  if (!found) return NextResponse.json({ message: "This proposal link is no longer valid." }, { status: 404 });
  const { trip, settings } = found;

  const body = await request.json().catch(() => ({}));
  const kind = ["advance", "balance", "full"].includes(body.kind) ? body.kind : null;
  const method = ["upi", "bank"].includes(body.method) ? body.method : null;
  if (!kind || !method) return NextResponse.json({ message: "Unknown payment." }, { status: 422 });
  const reference = String(body.reference ?? "").trim().slice(0, 120);
  if (!reference) return NextResponse.json({ message: "Please enter the UPI / bank transaction reference." }, { status: 422 });
  const amount = amountFor(kind, paymentSchedule(trip, settings));
  if (!(amount > 0)) return NextResponse.json({ message: "Nothing is due for this payment." }, { status: 422 });

  const open = await prisma.clientPayment.count({ where: { tripId: trip.id, status: "claimed" } });
  if (open >= 3) {
    return NextResponse.json({ message: "We're still confirming your earlier payment — we'll be in touch shortly." }, { status: 422 });
  }

  await prisma.clientPayment.create({
    data: {
      tripId: trip.id,
      userId: trip.userId,
      kind,
      amount,
      method,
      status: "claimed",
      reference,
      payerName: String(body.payer_name ?? "").trim().slice(0, 120) || null,
      note: String(body.note ?? "").trim().slice(0, 1000) || null,
    },
  });

  const sym = currencySymbol(trip.currency);
  const headline = `${trip.clientName || "Your client"} says they paid ${sym}${amount.toLocaleString("en-IN")} by ${method === "upi" ? "UPI" : "bank transfer"} for ${trip.tripTitle} (${trip.tripId}) — please verify`;
  await notify(trip.userId, "payment_claimed", {
    type: "payment_claimed",
    message: `${headline} (ref ${reference})`,
    trip_id: trip.tripId,
    client_name: trip.clientName,
    client_phone: trip.clientPhone,
  });
  await emailAgency(trip, settings, headline, `Reference: ${reference}. Open the trip → Pricing → Payments to verify it.`);

  const fresh = await prisma.trip.findUnique({ where: { id: trip.id }, include: { clientPayments: true } });
  return NextResponse.json({ ok: true, payment: paymentView(fresh, settings, fresh.clientPayments) });
}
