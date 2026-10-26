import React, { useMemo, useState } from "react";
import { X, Download, Crown, Wallet } from "lucide-react";
import { TIERS, tierStays, hotelsForStay, defaultTierPicks, tierFileName } from "../../../utils/tierExport";
import { stayNights, starsLabel, currencySymbolOf } from "../../../utils/hotelOptions";

/**
 * "Export Budget + Premium": pick each stay's hotel for the two itineraries
 * (they share everything else — days, activities, guests, rooms, beds, cabs),
 * see both totals, then export both PDFs in one go.
 */
const TierExportModal = ({ accommodations, hotels, tripId, currency, priceFor, onExport, onClose }) => {
  const stays = useMemo(() => tierStays(accommodations), [accommodations]);
  const [picks, setPicks] = useState(() => defaultTierPicks(accommodations, hotels));
  const sym = currencySymbolOf(currency);
  const totals = useMemo(
    () => Object.fromEntries(TIERS.map((t) => [t.key, priceFor(picks[t.key])])),
    [picks, priceFor],
  );
  const pick = (tier, stayId, hotelId) =>
    setPicks((p) => ({ ...p, [tier]: { ...p[tier], [stayId]: hotelId === "" ? null : hotelId } }));
  const same = stays.length > 0 && stays.every((s) => String(picks.budget[s.id]) === String(picks.premium[s.id]));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export Budget and Premium itineraries"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-black/5">
          <div>
            <h3 className="text-lg font-black text-ink">Export Budget + Premium</h3>
            <p className="text-xs text-ink/50 mt-0.5">
              Same days, activities, guests, rooms, beds and cabs — only the hotels change. Two PDFs download together.
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-ink/40 hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!stays.length && <p className="text-sm text-ink/60">Add the hotels in Logistics first — the two itineraries differ only in their hotels.</p>}
          {stays.map((stay) => {
            const options = hotelsForStay(stay, hotels);
            const nights = stayNights(stay.checkIn, stay.checkOut);
            return (
              <div key={stay.id} className="rounded-2xl border border-black/10 p-3">
                <div className="text-xs font-bold text-ink mb-2">
                  {stay.city || "Stay"} · {nights} night{nights === 1 ? "" : "s"}
                  <span className="font-medium text-ink/45">
                    {" "}
                    · {stay.rooms || 1} room{Number(stay.rooms) === 1 ? "" : "s"}
                    {stay.mealPlan ? ` · ${stay.mealPlan}` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TIERS.map((t) => (
                    <label key={t.key} className="block">
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-ink/45 mb-1">
                        {t.key === "premium" ? <Crown className="w-3 h-3" /> : <Wallet className="w-3 h-3" />} {t.label}
                      </span>
                      <select
                        value={picks[t.key][stay.id] ?? ""}
                        onChange={(e) => pick(t.key, String(stay.id), e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-[#e7f63c]"
                      >
                        {!options.length && <option value="">{stay.name}</option>}
                        {options.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                            {starsLabel(h.category) ? ` ${starsLabel(h.category)}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-black/5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((t) => (
              <div key={t.key} className="rounded-xl bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-ink/45">{t.label} total</div>
                <div className="text-base font-black text-ink">
                  {sym}
                  {Number(totals[t.key] || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-ink/40 truncate">{tierFileName(tripId, t.label)}</div>
              </div>
            ))}
          </div>
          {same && <p className="text-xs text-amber-700">Both itineraries have the same hotels — pick a different Premium hotel for at least one stay.</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-ink/60 hover:bg-black/5">
              Cancel
            </button>
            <button
              onClick={() => onExport(picks)}
              disabled={!stays.length || same}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#e7f63c] text-[#181c22] hover:bg-[#d4e42e] disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export both PDFs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierExportModal;
