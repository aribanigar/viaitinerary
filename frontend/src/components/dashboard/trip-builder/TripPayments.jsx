import React, { useCallback, useEffect, useState } from "react";
import { Wallet, RefreshCw, Check, X } from "lucide-react";
import { toast } from "react-toastify";
import { fetchTripPayments, setTripAdvance, decideClientPayment } from "../../../api/trips";

// Client payments for a saved trip (Pricing tab): the schedule the client
// sees on their proposal link, an advance override, payments received and
// "I've paid" claims to verify. Self-contained — fetches its own data.

const money = (n, sym = "₹") =>
  `${sym}${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const date = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const STATUS = {
  paid: ["Paid", "bg-emerald-50 text-emerald-700"],
  verified: ["Verified", "bg-emerald-50 text-emerald-700"],
  claimed: ["To verify", "bg-amber-50 text-amber-700"],
  rejected: ["Rejected", "bg-red-50 text-red-600"],
};
const METHOD = { razorpay: "Online (Razorpay)", upi: "UPI", bank: "Bank transfer" };
const KIND = { advance: "Advance", balance: "Balance", full: "Full payment" };

const Tile = ({ label, value, hint }) => (
  <div className="bg-[#f3f3f4]/50 rounded-xl p-4 border border-black/5">
    <span className="text-[10px] font-semibold text-[#9aa3b2] uppercase tracking-widest block mb-1.5">{label}</span>
    <div className="text-lg font-semibold text-ink">{value}</div>
    {hint && <div className="text-[11px] text-[#9aa3b2] mt-0.5">{hint}</div>}
  </div>
);

export default function TripPayments({ token, tripId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [advance, setAdvance] = useState("");

  const load = useCallback(async () => {
    if (!token || !tripId) return;
    setLoading(true);
    try {
      const res = await fetchTripPayments(token, tripId);
      setData(res);
      setAdvance(res.schedule.advance_override ?? "");
    } catch (err) {
      toast.error(err.message || "Couldn't load payments.");
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAdvance = async () => {
    setBusy("advance");
    try {
      const res = await setTripAdvance(token, tripId, advance === "" ? null : Number(advance));
      setData(res);
      toast.success(advance === "" ? "Advance back to your default %" : "Advance updated");
    } catch (err) {
      toast.error(err.message || "Couldn't update the advance.");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (p, action) => {
    const what = `${money(p.amount, data.schedule.currency_symbol)} (${KIND[p.kind] || p.kind}, ref ${p.reference || "—"})`;
    if (!window.confirm(action === "verify" ? `Mark ${what} as received?` : `Reject the payment claim ${what}?`)) return;
    setBusy(p.id);
    try {
      setData(await decideClientPayment(token, tripId, p.id, action));
      toast.success(action === "verify" ? "Payment recorded" : "Claim rejected");
    } catch (err) {
      toast.error(err.message || "Couldn't update the payment.");
    } finally {
      setBusy(null);
    }
  };

  if (!tripId) return null;
  const s = data?.schedule;
  const sym = s?.currency_symbol || "₹";

  return (
    <div className="bg-white border border-black/10 rounded-xl p-8 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f3f3f4] text-ink rounded-lg flex items-center justify-center border border-black/5">
            <Wallet className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-semibold text-ink uppercase tracking-[0.2em]">Client Payments</h3>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-ink/50 hover:text-ink hover:bg-black/[0.03] disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!s ? (
        <div className="text-sm text-[#9aa3b2]">{loading ? "Loading…" : "Save the trip to take payments."}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Tile label="Total" value={money(s.total, sym)} />
            <Tile label="Advance" value={money(s.advance, sym)} hint={s.advance_remaining > 0 ? `${money(s.advance_remaining, sym)} still due` : "Covered"} />
            <Tile label="Paid" value={money(s.paid, sym)} />
            <Tile label="Balance" value={money(s.balance, sym)} hint={s.balance > 0 && s.balance_due_date ? `Due by ${date(s.balance_due_date)}` : ""} />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink/45 uppercase tracking-[0.12em] mb-1.5">
                Advance for this trip (₹)
              </label>
              <input
                type="number"
                min="0"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                placeholder={`Default: ${money(s.advance, sym)}`}
                className="w-48 bg-[#f3f3f4] border border-black/5 rounded-xl py-2.5 px-4 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <button
              type="button"
              onClick={saveAdvance}
              disabled={busy === "advance"}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand text-white hover:bg-black disabled:opacity-50"
            >
              Save advance
            </button>
            <span className="text-[11px] text-[#9aa3b2] pb-2.5">
              {data.razorpay_configured ? "Clients can pay online from their proposal link." : "No Razorpay keys — clients pay by UPI/bank and you verify here."}
            </span>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-ink/45 uppercase tracking-[0.12em] mb-2">Payments</div>
            {data.payments.length === 0 ? (
              <div className="text-sm text-[#9aa3b2]">No client payments yet.</div>
            ) : (
              <ul className="divide-y divide-black/5 border border-black/5 rounded-xl">
                {data.payments.map((p) => {
                  const [label, tone] = STATUS[p.status] || [p.status, "bg-black/5 text-[#5b6472]"];
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">
                          {money(p.amount, sym)} · {KIND[p.kind] || p.kind}
                        </div>
                        <div className="text-xs text-[#9aa3b2] truncate">
                          {METHOD[p.method] || p.method}
                          {p.reference ? ` · ref ${p.reference}` : ""}
                          {p.payer_name ? ` · ${p.payer_name}` : ""} · {date(p.paid_at || p.created_at)}
                        </div>
                        {p.note && <div className="text-xs text-[#5b6472] mt-0.5">“{p.note}”</div>}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${tone}`}>{label}</span>
                      {p.status === "claimed" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => decide(p, "verify")}
                            disabled={busy === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-ink hover:bg-accent-hover flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(p, "reject")}
                            disabled={busy === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-black/10 text-ink hover:bg-black/[0.03] flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
