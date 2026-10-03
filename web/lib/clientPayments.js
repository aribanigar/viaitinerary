import prisma from "@/lib/prisma";
import { TRIP_INCLUDE } from "@/lib/trips";
import { syncTrip, recordSettlement } from "@/lib/accounting";
import { paymentSchedule } from "@/lib/paymentSchedule";
import { currencySymbol } from "@/lib/serialize";
import { notify } from "@/lib/notify";
import { mailerForAdminId, sendMail } from "@/lib/mailer";
import { fetchOrderPayments } from "@/lib/razorpay";
import { pushDmcItinerary } from "@/lib/dmcBridge";

// Client payments from the proposal page (/p/:token). Every received payment
// becomes an accounting receipt against the trip's client receivable, so
// trip.paidAmount, the Ledger and invoices stay right — never write
// paidAmount directly.

const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The agency's Razorpay keys, or null when it hasn't set them up. */
export const agencyRazorpayKeys = (settings) =>
  settings?.razorpayKeyId && settings?.razorpayKeySecret
    ? { keyId: settings.razorpayKeyId, keySecret: settings.razorpayKeySecret }
    : null;

const scheduleView = (trip, settings) => {
  const s = paymentSchedule(trip, settings);
  return {
    total: s.total,
    paid: s.paid,
    advance: s.advance,
    advance_remaining: s.advanceRemaining,
    balance: s.balance,
    balance_due_date: ymd(s.balanceDueDate),
    next: s.next,
    currency_symbol: currencySymbol(trip.currency),
  };
};

/** Public (client-facing) payment block for GET /api/public/proposals/:token. Allowlisted. */
export function paymentView(trip, settings, payments = []) {
  const bank =
    settings?.accountNumber || settings?.bankName
      ? {
          beneficiary_name: settings.beneficiaryName || settings.agencyName || "",
          bank_name: settings.bankName || "",
          account_number: settings.accountNumber || "",
          ifsc_code: settings.ifscCode || "",
        }
      : null;
  return {
    ...scheduleView(trip, settings),
    methods: { razorpay: !!agencyRazorpayKeys(settings), upi_id: settings?.upiId || null, bank },
    pending_claims: payments
      .filter((p) => p.status === "claimed")
      .map((p) => ({ id: p.id, kind: p.kind, amount: Number(p.amount), method: p.method, created_at: p.createdAt.toISOString() })),
    history: payments
      .filter((p) => p.status === "paid" || p.status === "verified")
      .map((p) => ({ kind: p.kind, amount: Number(p.amount), method: p.method, paid_at: (p.paidAt || p.updatedAt).toISOString() })),
  };
}

/** Agency-facing view for GET /api/trips/:id/payments. */
export function agencyPaymentView(trip, settings, payments = []) {
  return {
    schedule: { ...scheduleView(trip, settings), advance_override: trip.advanceAmount == null ? null : Number(trip.advanceAmount) },
    razorpay_configured: !!agencyRazorpayKeys(settings),
    payments: payments
      .filter((p) => p.status !== "created" && p.status !== "failed")
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        reference: p.reference || p.razorpayPaymentId || null,
        payer_name: p.payerName,
        note: p.note,
        paid_at: p.paidAt ? p.paidAt.toISOString() : null,
        created_at: p.createdAt.toISOString(),
      })),
  };
}

const KIND_LABEL = { advance: "advance", balance: "balance", full: "full payment" };

/**
 * Record a received payment: accounting receipt (→ trip.paidAmount), mark the
 * ClientPayment paid/verified, auto-confirm, notify. Idempotent: a payment
 * that already has a settlement is left alone. Returns the fresh trip.
 */
export async function recordClientPayment(clientPayment, { status = "paid", actorId = null, paymentId = null } = {}) {
  // Claim the row first so two concurrent verifications can't both record it.
  const claimed = await prisma.clientPayment.updateMany({
    where: { id: clientPayment.id, settlementId: null, status: { in: ["created", "claimed", "failed"] } },
    data: { status, paidAt: new Date(), ...(paymentId ? { razorpayPaymentId: paymentId } : {}) },
  });
  if (claimed.count === 0) return prisma.trip.findUnique({ where: { id: clientPayment.tripId } });

  const trip = await prisma.trip.findUnique({ where: { id: clientPayment.tripId }, include: TRIP_INCLUDE });
  await syncTrip(trip, trip.userId, trip.teamId);
  const obligation = await prisma.accountingObligation.findUnique({
    where: { obligation_source: { tripId: trip.id, direction: "receivable", sourceType: "trip", sourceId: trip.id } },
  });
  const method = clientPayment.method === "razorpay" ? "Razorpay" : clientPayment.method === "upi" ? "UPI" : "Bank transfer";
  const ref = paymentId || clientPayment.razorpayPaymentId || clientPayment.reference;
  const settlement = await recordSettlement(
    obligation,
    {
      amount: Number(clientPayment.amount),
      method,
      notes: `Client ${KIND_LABEL[clientPayment.kind] || "payment"} via the proposal link${ref ? ` (ref ${ref})` : ""}`,
      settlement_type: "receipt",
    },
    actorId,
  );
  await prisma.clientPayment.update({ where: { id: clientPayment.id }, data: { settlementId: settlement.id } });

  const settings = await prisma.agencySetting.findUnique({ where: { userId: trip.userId } });
  let fresh = await prisma.trip.findUnique({ where: { id: trip.id } });
  if ((settings?.autoConfirmOnPayment ?? true) && String(fresh.status || "pending").toLowerCase() === "pending") {
    fresh = await prisma.trip.update({ where: { id: trip.id }, data: { status: "confirmed" } });
    pushDmcItinerary(fresh).catch(() => {});
  }

  const sym = currencySymbol(trip.currency);
  const amount = `${sym}${Number(clientPayment.amount).toLocaleString("en-IN")}`;
  const headline = `${trip.clientName || "Your client"} paid ${amount} (${KIND_LABEL[clientPayment.kind] || "payment"}) for ${trip.tripTitle} (${trip.tripId})`;
  await notify(trip.userId, "payment_received", {
    type: "payment_received",
    message: `${headline} via ${method}${actorId ? " — verified" : ""}`,
    trip_id: trip.tripId,
    client_name: trip.clientName,
    client_phone: trip.clientPhone,
  });
  if (!actorId) await emailAgency(trip, settings, headline, `Received via ${method}${ref ? ` · reference ${ref}` : ""}.`);
  return fresh;
}

/** Best-effort email to the agency's own address. */
export async function emailAgency(trip, settings, headline, detail) {
  try {
    const { mailer } = await mailerForAdminId(trip.userId);
    const to = settings?.smtpEmail || settings?.contactEmail;
    if (!mailer || !to) return;
    await sendMail(mailer, {
      to,
      subject: headline,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#181c22"><p><b>${esc(headline)}</b></p>
        ${detail ? `<p>${esc(detail)}</p>` : ""}
        <p>Client: ${esc(trip.clientName || "—")} · ${esc(trip.clientPhone || "")} · ${esc(trip.clientEmail || "")}</p></div>`,
    });
  } catch (err) {
    console.error("agency payment email failed:", err.message);
  }
}

/**
 * Catch Razorpay payments whose checkout was closed before /pay/verify ran:
 * for open orders older than a minute, ask Razorpay and record any captured
 * (or authorized) payment. Never throws.
 */
export async function reconcilePendingOrders(trip, settings) {
  const keys = agencyRazorpayKeys(settings);
  if (!keys) return 0;
  const open = await prisma.clientPayment.findMany({
    where: {
      tripId: trip.id,
      method: "razorpay",
      status: "created",
      razorpayOrderId: { not: null },
      createdAt: { lt: new Date(Date.now() - 60000), gt: new Date(Date.now() - 7 * 86400000) },
    },
    take: 5,
  });
  let recorded = 0;
  for (const cp of open) {
    try {
      const items = await fetchOrderPayments(cp.razorpayOrderId, keys);
      const ok = items.find((p) => p.status === "captured" || p.status === "authorized");
      if (ok) {
        await recordClientPayment(cp, { paymentId: ok.id });
        recorded += 1;
      }
    } catch (err) {
      console.error("razorpay reconcile failed:", err.message);
    }
  }
  return recorded;
}
