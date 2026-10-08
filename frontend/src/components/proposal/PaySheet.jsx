import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "react-toastify";
import { formatMoney, KIND_LABEL, paymentErrorMessage } from "./money";

// Manual payment (no online gateway): UPI (app deep link on phones, QR on
// desktop) and/or bank transfer, then an "I've paid" form that records a claim
// for the agency to confirm. Mount only while open, keyed per kind.

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(String(text));
    toast.success(`${label} copied`);
  } catch {
    toast.info(String(text));
  }
}

const CopyRow = ({ label, value }) =>
  value ? (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</div>
        <div className="text-sm font-semibold text-ink break-all">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => copy(value, label)}
        className="grid place-items-center w-9 h-9 shrink-0 rounded-full border border-black/10 text-ink/60 hover:bg-black/[0.04]"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  ) : null;

export default function PaySheet({
  payment,
  kind, // "advance" | "balance" | "full"
  amount,
  agencyName,
  tripId,
  defaultName = "",
  brand,
  brandText,
  onClaim, // async ({ kind, method, reference, payer_name, note }) => void
  onClose,
}) {
  const sym = payment.currency_symbol || "₹";
  const methods = payment.methods || {};
  const upi = methods.upi_id || "";
  const bank = methods.bank || null;
  const hasBank = Boolean(bank && (bank.account_number || bank.ifsc_code));
  const [method, setMethod] = useState(upi ? "upi" : "bank");
  const [claiming, setClaiming] = useState(false);
  const [reference, setReference] = useState("");
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [qr, setQr] = useState("");

  const amt = Math.max(0, Math.round(Number(amount) || 0));
  const upiLink = upi
    ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(agencyName || "")}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${tripId || ""} ${kind}`.trim())}`
    : "";

  // QR of the same UPI link for desktop (scan with a phone).
  useEffect(() => {
    if (!upiLink) return undefined;
    let alive = true;
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(upiLink, { margin: 1, width: 220 }))
      .then((url) => alive && setQr(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [upiLink]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reference.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onClaim({
        kind,
        method,
        reference: reference.trim(),
        payer_name: name.trim() || undefined,
        note: note.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(paymentErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[16px] sm:text-sm text-ink outline-none focus:border-brand placeholder:text-ink/35";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-brand/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pay ${formatMoney(amt, sym)}`}
        className="relative w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden mx-auto mt-2 w-10 h-1 rounded-full bg-black/10" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full text-ink/55 hover:bg-black/[0.05]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="px-6 pt-8 pb-7 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: brand }} strokeWidth={1.8} />
            <h2 className="mt-3 text-lg font-semibold text-ink">Thanks!</h2>
            <p className="mt-1.5 text-sm text-ink/65">
              We're confirming your payment of {formatMoney(amt, sym)}. {agencyName} will let you know once it's received.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full h-11 rounded-full text-sm font-semibold"
              style={{ background: brand, color: brandText }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 sm:px-6 pt-5 pb-6 space-y-5">
            <div className="pr-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: brand }}>
                {KIND_LABEL[kind] || "Payment"}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">{formatMoney(amt, sym)}</h2>
              <p className="mt-0.5 text-sm text-ink/60">
                Pay {agencyName} by {upi && hasBank ? "UPI or bank transfer" : upi ? "UPI" : "bank transfer"}, then tell us below.
              </p>
            </div>

            {upi && (
              <div className="rounded-2xl border border-black/[0.07] p-4">
                <div className="text-sm font-semibold text-ink">UPI</div>
                <a
                  href={upiLink}
                  className="sm:hidden mt-3 w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: brand, color: brandText }}
                >
                  <Smartphone className="w-4 h-4" /> Pay with UPI app
                </a>
                {qr && (
                  <div className="hidden sm:flex mt-3 items-center gap-4">
                    <img src={qr} alt="UPI payment QR code" className="w-36 h-36 rounded-xl border border-black/5" />
                    <p className="text-xs text-ink/60">
                      Scan with any UPI app (GPay, PhonePe, Paytm, BHIM). The amount is filled in for you.
                    </p>
                  </div>
                )}
                <CopyRow label="UPI ID" value={upi} />
              </div>
            )}

            {hasBank && (
              <div className="rounded-2xl border border-black/[0.07] px-4 py-3">
                <div className="text-sm font-semibold text-ink mb-1">Bank transfer</div>
                <div className="divide-y divide-black/5">
                  <CopyRow label="Amount" value={String(amt)} />
                  <CopyRow label="Beneficiary" value={bank.beneficiary_name} />
                  <CopyRow label="Bank" value={bank.bank_name} />
                  <CopyRow label="Account number" value={bank.account_number} />
                  <CopyRow label="IFSC" value={bank.ifsc_code} />
                </div>
              </div>
            )}

            {!claiming ? (
              <button
                type="button"
                onClick={() => setClaiming(true)}
                className="w-full h-12 rounded-full bg-brand text-white text-sm font-semibold"
              >
                I've paid
              </button>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="text-sm font-semibold text-ink">Tell us about your payment</div>
                {upi && hasBank && (
                  <div className="flex gap-2">
                    {[
                      ["upi", "UPI"],
                      ["bank", "Bank transfer"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMethod(value)}
                        aria-pressed={method === value}
                        className={`flex-1 h-10 rounded-full border text-xs font-semibold ${
                          method === value ? "border-brand bg-brand text-white" : "border-black/10 bg-white text-ink"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <label htmlFor="pay-ref" className="block mb-1.5 text-xs font-semibold text-ink/60">
                    {method === "upi" ? "UPI reference / UTR number" : "Transaction reference / UTR"}
                  </label>
                  <input
                    id="pay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    maxLength={100}
                    autoComplete="off"
                    placeholder="e.g. 412345678901"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="pay-name" className="block mb-1.5 text-xs font-semibold text-ink/60">
                    Paid by
                  </label>
                  <input
                    id="pay-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="pay-note" className="block mb-1.5 text-xs font-semibold text-ink/60">
                    Note (optional)
                  </label>
                  <textarea
                    id="pay-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className={`${field} resize-none`}
                  />
                </div>
                {error && (
                  <p className="rounded-xl bg-[#fff4f3] border border-[#ff5a4d]/30 px-3 py-2 text-sm text-[#b42318]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!reference.trim() || submitting}
                  className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: brand, color: brandText }}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit payment details
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
