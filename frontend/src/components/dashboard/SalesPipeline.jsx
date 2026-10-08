import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { fetchSalesPipeline } from "../../api/trips";

// Dashboard "Sales pipeline": where trips are between draft and fully paid,
// and which ones need the agent now (asked for changes, payment to verify,
// approved but unpaid, balance due, proposal not opened).

const STAGES = [
  ["drafts_not_sent", "Not sent"],
  ["sent_not_viewed", "Sent"],
  ["viewed_no_response", "Viewed"],
  ["changes_requested", "Changes"],
  ["approved_unpaid", "Approved"],
  ["partially_paid", "Part paid"],
  ["fully_paid", "Paid"],
];

const NUDGE = {
  approved_unpaid: (t) => `Hi ${t.client_name || "there"}, a quick reminder about the advance for your ${t.trip_title} trip — you can pay from the link we sent. Thank you!`,
  balance_due: (t) => `Hi ${t.client_name || "there"}, a gentle reminder that the balance for your ${t.trip_title} trip is due soon. You can pay from the link we sent.`,
  not_viewed: (t) => `Hi ${t.client_name || "there"}, did you get a chance to look at the ${t.trip_title} itinerary we sent? Happy to change anything.`,
  changes_requested: (t) => `Hi ${t.client_name || "there"}, thanks for your feedback on the ${t.trip_title} plan — we're on it.`,
  payment_claimed: (t) => `Hi ${t.client_name || "there"}, thanks for your payment for ${t.trip_title}. We're confirming it now.`,
};

const ago = (iso) => {
  if (!iso) return "";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days > 0) return `${days}d ago`;
  if (days < 0) return `in ${-days}d`;
  return "today";
};

export default function SalesPipeline({ token }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchSalesPipeline(token)
      .then((res) => alive && setData(res))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [token]);

  if (!data) return null;
  const total = STAGES.reduce((n, [k]) => n + (data.counts?.[k] || 0), 0);
  if (!total) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden mb-12">
      <div className="p-6 border-b border-black/5 flex flex-wrap gap-2 justify-between items-center bg-[#f3f3f4]/60">
        <h3 className="text-sm font-bold text-ink uppercase tracking-widest">Sales Pipeline</h3>
        <span className="text-[10px] font-bold text-[#8a93a2] uppercase tracking-widest">Last 90 days & upcoming</span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-px bg-black/5">
        {STAGES.map(([key, label]) => (
          <div key={key} className="bg-white px-3 py-4 text-center">
            <div className={`text-2xl font-light ${key === "changes_requested" && data.counts[key] ? "text-amber-600" : "text-ink"}`}>
              {data.counts?.[key] || 0}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a93a2] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {data.attention?.length > 0 && (
        <div className="divide-y divide-black/5 border-t border-black/5">
          <div className="px-6 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-[#8a93a2]">Needs attention</div>
          {data.attention.map((t) => {
            const phone = String(t.client_phone || "").replace(/\D/g, "");
            const text = (NUDGE[t.key] || NUDGE.not_viewed)(t);
            return (
              <div key={`${t.trip_id}-${t.key}`} className="px-6 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">
                    {t.client_name || "Client"} · <span className="font-normal text-[#5b6472]">{t.trip_title}</span>
                  </div>
                  <div className="text-xs text-[#5b6472] truncate">
                    {t.reason}
                    {t.since ? <span className="text-[#9aa3b2]"> · {ago(t.since)}</span> : null}
                  </div>
                </div>
                {phone && (
                  <a
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl text-[#25D366] hover:bg-green-50"
                    title="Message on WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
                <Link
                  to={`/trip-builder/${t.trip_id}`}
                  className="p-2 rounded-xl text-ink/50 hover:text-ink hover:bg-black/[0.03]"
                  title="Open trip"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
