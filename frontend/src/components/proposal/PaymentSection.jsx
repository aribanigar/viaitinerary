import React from "react";
import { CheckCircle2, Clock, CreditCard, Loader2, PencilLine } from "lucide-react";
import { formatMoney, KIND_LABEL, METHOD_LABEL } from "./money";

// "Payment" card on the public proposal page — anchor #pay (reminder emails
// link to /p/<token>#pay). Shows the schedule, what's been paid, claims still
// being confirmed, and pay buttons when the client can pay now.

const fmtDate = (value) => {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const claimDetail = (c) =>
  [METHOD_LABEL[c.method] || c.method, fmtDate(c.created_at)].filter(Boolean).join(", ");

const Row = ({ label, value, note, strong = false }) => (
  <div className="flex items-baseline justify-between gap-3 py-2">
    <div className="min-w-0">
      <div className={`text-sm ${strong ? "font-semibold" : "text-[#181c22]/70"}`}>{label}</div>
      {note && <div className="text-xs text-[#181c22]/50">{note}</div>}
    </div>
    <div className={`text-sm tabular-nums shrink-0 ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>
  </div>
);

export default function PaymentSection({
  payment,
  agencyName,
  brand,
  brandText,
  preview,
  canPay, // a payment method is configured and the trip is in its pay phase
  payingKind, // kind currently opening/processing, or null
  onPay, // (kind) => void
  onRequestChanges,
}) {
  const sym = payment.currency_symbol || "₹";
  const money = (n) => formatMoney(n, sym);
  const total = Number(payment.total) || 0;
  const paid = Number(payment.paid) || 0;
  const advance = Number(payment.advance) || 0;
  const advanceRemaining = Number(payment.advance_remaining) || 0;
  const balance = Number(payment.balance) || 0;
  const next = payment.next && Number(payment.next.amount) > 0 ? payment.next : null;
  const fullDue = Math.max(0, total - paid);
  const paidInFull = total > 0 && fullDue <= 0;
  const pending = Array.isArray(payment.pending_claims) ? payment.pending_claims : [];
  const history = Array.isArray(payment.history) ? payment.history : [];
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const methods = payment.methods || {};
  const hasMethod = Boolean(methods.razorpay || methods.upi_id || methods.bank);

  return (
    <section id="pay" className="scroll-mt-4 max-w-[830px] mx-auto px-4 pt-6">
      <div className="rounded-[24px] bg-white border border-black/5 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" style={{ color: brand }} />
          <h2 className="text-lg font-semibold tracking-tight flex-1">Payment</h2>
          {paidInFull && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Paid in full
            </span>
          )}
        </div>

        {/* progress */}
        <div className="mt-4 h-2 rounded-full bg-black/[0.06] overflow-hidden" aria-hidden>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: brand }} />
        </div>
        <div className="mt-1.5 text-xs text-[#181c22]/55">
          {money(paid)} of {money(total)} paid
        </div>

        <div className="mt-3 divide-y divide-black/5">
          <Row label="Trip total" value={money(total)} strong />
          <Row label="Paid so far" value={money(paid)} />
          {advance > 0 && (
            <Row
              label="Advance"
              value={money(advance)}
              note={advanceRemaining > 0 ? `${money(advanceRemaining)} still due to confirm the booking` : "Paid ✓"}
            />
          )}
          {balance > 0 && (
            <Row
              label="Balance"
              value={money(balance)}
              note={payment.balance_due_date ? `Due by ${fmtDate(payment.balance_due_date)}` : null}
            />
          )}
        </div>

        {pending.length > 0 && (
          <ul className="mt-3 space-y-2">
            {pending.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
              >
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  We're confirming your payment of <b>{money(c.amount)}</b>
                  {claimDetail(c) ? ` (${claimDetail(c)})` : ""}. {agencyName} will confirm it shortly.
                </span>
              </li>
            ))}
          </ul>
        )}

        {history.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45">
              Payments received
            </div>
            <ul className="mt-1.5 divide-y divide-black/5">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{KIND_LABEL[h.kind] || "Payment"}</div>
                    <div className="text-xs text-[#181c22]/50">
                      {[fmtDate(h.paid_at), METHOD_LABEL[h.method] || h.method].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{money(h.amount)}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!paidInFull && next && (
          <div className="mt-5">
            {preview ? (
              <p className="rounded-2xl bg-[#f4f5f6] px-3 py-2.5 text-xs text-[#181c22]/60">
                Preview — your client pays here. Payments are disabled in preview.
              </p>
            ) : canPay ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => onPay(next.kind)}
                  disabled={!!payingKind}
                  className="flex-1 h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: brand, color: brandText }}
                >
                  {payingKind === next.kind && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pay {next.kind === "advance" ? "advance" : "balance"} {money(next.amount)}
                </button>
                {fullDue > Number(next.amount) && (
                  <button
                    type="button"
                    onClick={() => onPay("full")}
                    disabled={!!payingKind}
                    className="flex-1 sm:flex-none h-12 px-5 rounded-full border border-black/15 bg-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {payingKind === "full" && <Loader2 className="w-4 h-4 animate-spin" />}
                    Pay full {money(fullDue)}
                  </button>
                )}
              </div>
            ) : !hasMethod ? (
              <p className="text-sm text-[#181c22]/60">
                {agencyName} will share the payment details with you.
              </p>
            ) : (
              <p className="text-sm text-[#181c22]/60">Approve the trip to pay the advance and confirm your booking.</p>
            )}
            {canPay && !preview && (
              <p className="mt-2 text-xs text-[#181c22]/45 text-center sm:text-left">
                {methods.razorpay ? "Secure online payment — UPI, cards, net banking." : "Pay by UPI or bank transfer."}
              </p>
            )}
          </div>
        )}

        {onRequestChanges && !preview && (
          <button
            type="button"
            onClick={onRequestChanges}
            className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#181c22]/55 hover:text-[#181c22]"
          >
            <PencilLine className="w-3.5 h-3.5" /> Need changes to the trip? Tell {agencyName}
          </button>
        )}
      </div>
    </section>
  );
}
