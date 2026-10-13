import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { RefreshCw, Check, EyeOff, RotateCcw, Copy, Trash2, Sparkles, Tag } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { fetchChingInsights, setChingMissStatus, deleteChingMisses } from "../../api/ching";
import { MISS_LABEL, MISS_HINT, pctText, missesAsText } from "../../utils/ching/insight";

// How Ching is doing, from real use: the share of requests it understood, how
// many planned trips were built, and every sentence it got wrong, grouped by
// shape (utils/ching/insight.js, web/lib/chingInsight.js). The list is the
// to-do for teaching Ching; "unmet" lines are a to-do for the catalog's tags.

const RANGES = [7, 14, 30, 90];
const KINDS = ["unknown", "partial", "corrected", "stuck", "unmet", "no-trip"];
const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

const Tile = ({ label, value, sub, tone = "ink" }) => (
  <div className="rounded-2xl bg-white border border-black/5 p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2]">{label}</p>
    <p className={`mt-1 text-[28px] leading-none font-semibold ${tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-ink"}`}>{value}</p>
    {sub && <p className="mt-1.5 text-xs text-[#5b6472]">{sub}</p>}
  </div>
);

// One bar per day: the whole bar is the turns, the dark part what Ching missed.
const Days = ({ daily }) => {
  const max = Math.max(1, ...daily.map((d) => d.turns || 0));
  if (!daily.length) return <p className="text-sm text-[#8a93a2]">No requests in this period yet.</p>;
  return (
    <div className="flex items-end gap-1 h-28" role="img" aria-label="Requests per day, with the ones Ching missed">
      {daily.map((d) => {
        const turns = d.turns || 0;
        const missed = Math.min(turns, d.missed || 0);
        return (
          <div key={d.day} className="flex-1 min-w-[6px] flex flex-col justify-end h-full" title={`${when(d.day)}: ${turns} requests, ${missed} missed`}>
            <div className="w-full rounded-t bg-[#d7dbe2] flex flex-col justify-end" style={{ height: `${Math.max(3, (turns / max) * 100)}%` }}>
              {missed > 0 && <div className="w-full rounded-t bg-amber-500" style={{ height: `${(missed / Math.max(1, turns)) * 100}%` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function ChingInsights() {
  const { token } = useAuth();
  const [days, setDays] = useState(14);
  const [all, setAll] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await fetchChingInsights(token, { days, all }));
    } catch (err) {
      toast.error(err?.message || "Couldn't load Ching's report");
    } finally {
      setLoading(false);
    }
  }, [token, days, all]);
  useEffect(() => {
    load();
  }, [load]);

  const misses = useMemo(() => (data?.misses || []).filter((m) => (showClosed || m.status === "open") && (!kind || m.kind === kind)), [data, kind, showClosed]);
  const score = data?.score || {};
  const totals = data?.totals || {};

  const mark = async (m, status) => {
    try {
      await setChingMissStatus(token, m.key, status);
      setData((d) => (d ? { ...d, misses: d.misses.map((x) => (x.key === m.key ? { ...x, status } : x)), open: d.misses.filter((x) => (x.key === m.key ? status : x.status) === "open").length } : d));
    } catch (err) {
      toast.error(err?.message || "Couldn't update it");
    }
  };
  const remove = async (m) => {
    try {
      await deleteChingMisses(token, m.key);
      setData((d) => (d ? { ...d, misses: d.misses.filter((x) => x.key !== m.key) } : d));
    } catch (err) {
      toast.error(err?.message || "Couldn't delete it");
    }
  };
  const copy = async () => {
    const text = missesAsText(data?.misses || []);
    if (!text) {
      toast.info("Nothing open to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied the open list");
    } catch {
      toast.error("Couldn't copy. Select the list and copy it by hand.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
              <Sparkles className="w-5 h-5" /> How Ching is doing
            </h1>
            <p className="text-sm text-[#5b6472]">Measured from your team's real requests: what it understood, and every sentence it got wrong.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-black/10 overflow-hidden">
              {RANGES.map((n) => (
                <button key={n} type="button" onClick={() => setDays(n)} aria-pressed={days === n} className={`px-3 py-2 text-sm font-semibold ${days === n ? "bg-ink text-white" : "text-ink hover:bg-black/[0.03]"}`}>
                  {n}d
                </button>
              ))}
            </div>
            {(data?.can_see_all || all) && (
              <button type="button" onClick={() => setAll((v) => !v)} aria-pressed={all} className={`px-3 py-2 rounded-xl border text-sm font-semibold ${all ? "bg-ink text-white border-ink" : "border-black/10 text-ink hover:bg-black/[0.03]"}`}>
                {all ? "All agencies" : "This agency"}
              </button>
            )}
            <button type="button" onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 text-sm font-semibold text-ink hover:bg-black/[0.03]">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Understood" value={pctText(score.understood)} sub={`${score.turns || 0} requests in ${days} days`} tone={score.understood == null ? "ink" : score.understood >= 90 ? "good" : "warn"} />
          <Tile label="Trips built" value={pctText(score.confirmed)} sub={`${totals.confirmed || 0} of ${totals.plans || 0} trips Ching planned`} tone={score.confirmed == null ? "ink" : score.confirmed >= 60 ? "good" : "warn"} />
          <Tile label="Taken back" value={pctText(score.corrected)} sub={`${totals.corrected || 0} undone or cancelled straight after`} tone={score.corrected == null ? "ink" : score.corrected <= 10 ? "good" : "warn"} />
          <Tile label="By voice" value={pctText(score.turns ? ((totals.voice || 0) / score.turns) * 100 : null)} sub={`${totals.voice || 0} spoken, ${totals.typed || 0} typed`} />
        </div>

        <div className="rounded-[24px] bg-white border border-black/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2]">Requests per day</h2>
            <p className="text-[11px] text-[#8a93a2]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#d7dbe2] mr-1" /> requests
              <span className="inline-block w-2 h-2 rounded-sm bg-amber-500 ml-3 mr-1" /> missed
            </p>
          </div>
          <Days daily={data?.daily || []} />
        </div>

        <div className="rounded-[24px] bg-white border border-black/5 p-5">
          <div className="flex flex-wrap items-center gap-2 justify-between mb-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2]">What Ching got wrong · {data?.open ?? 0} open</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[#5b6472]">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show fixed and ignored
              </label>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/10 text-xs font-semibold text-ink hover:bg-black/[0.03]">
                <Copy className="w-3.5 h-3.5" /> Copy open list
              </button>
            </div>
          </div>
          <p className="text-xs text-[#5b6472] mb-3">Similar sentences are one line with a count. Names, numbers and dates are blanked in the shape; phone numbers and emails are never stored.</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <button type="button" onClick={() => setKind("")} aria-pressed={!kind} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${!kind ? "bg-ink text-white" : "bg-[#f7f7f8] text-ink/60 hover:text-ink"}`}>
              All
            </button>
            {KINDS.filter((k) => (data?.byKind || {})[k] || k === kind).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k === kind ? "" : k)} aria-pressed={k === kind} title={MISS_HINT[k]} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${k === kind ? "bg-ink text-white" : "bg-[#f7f7f8] text-ink/60 hover:text-ink"}`}>
                {MISS_LABEL[k]} · {(data?.byKind || {})[k] || 0}
              </button>
            ))}
          </div>
          {kind && <p className="text-xs text-[#5b6472] mb-3">{MISS_HINT[kind]}</p>}

          {!data ? (
            <p className="text-sm text-[#8a93a2]">Loading…</p>
          ) : !misses.length ? (
            <p className="text-sm text-[#8a93a2]">{data.misses?.length ? "Nothing open here." : "Nothing logged yet. This fills in as your team talks to Ching."}</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {misses.map((m) => (
                <li key={m.key} className={`py-3 flex flex-wrap items-start gap-3 ${m.status !== "open" ? "opacity-55" : ""}`}>
                  <span className="shrink-0 w-10 text-center rounded-lg bg-[#f7f7f8] py-1 text-sm font-bold text-ink" title="Times seen">
                    {m.count || 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink break-words">“{m.examples?.[0] || m.shape}”</p>
                    {m.examples?.length > 1 && <p className="text-xs text-[#5b6472] break-words mt-0.5">also: {m.examples.slice(1).map((e) => `“${e}”`).join(", ")}</p>}
                    <p className="text-[11px] text-[#8a93a2] mt-1 break-words">
                      {MISS_LABEL[m.kind] || m.kind} · last {when(m.last)}
                      {m.agencies > 1 ? ` · ${m.agencies} agencies` : ""}
                      {m.reopened ? ` · came back ${m.reopened}×` : ""}
                      {m.shape && m.shape !== m.examples?.[0] ? ` · shape: ${m.shape}` : ""}
                    </p>
                    {m.kind === "unmet" && (
                      <Link to="/accommodation" className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-ink underline underline-offset-2">
                        <Tag className="w-3 h-3" /> Tick tags on your hotels
                      </Link>
                    )}
                  </div>
                  {!all && (
                    <div className="flex items-center gap-1 shrink-0">
                      {m.status === "open" ? (
                        <>
                          <button type="button" onClick={() => mark(m, "done")} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-[11px] font-bold text-ink hover:bg-black/[0.03]" title="It works now. It reopens by itself if it is seen again.">
                            <Check className="w-3 h-3" /> Fixed
                          </button>
                          <button type="button" onClick={() => mark(m, "ignored")} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-[11px] font-bold text-ink/70 hover:bg-black/[0.03]" title="Not something Ching should do. Stays hidden even if seen again.">
                            <EyeOff className="w-3 h-3" /> Ignore
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => mark(m, "open")} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-[11px] font-bold text-ink hover:bg-black/[0.03]">
                          <RotateCcw className="w-3 h-3" /> Reopen
                        </button>
                      )}
                      <button type="button" onClick={() => remove(m)} aria-label="Delete this line" className="grid place-items-center w-7 h-7 rounded-lg text-ink/40 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
