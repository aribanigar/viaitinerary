import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Phone,
  Mail,
  Calendar,
  Clock,
  Check,
  ArrowRight,
  Loader2,
  Pencil,
  MapPin,
  Users,
  IndianRupee,
  StickyNote,
  PhoneCall,
  Handshake,
  Send,
  RefreshCw,
  UserPlus,
  Trophy,
  XCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getLeadInquiry,
  updateLeadInquiry,
  logLeadActivity,
  convertInquiryToTrip,
} from "../../../api/leadInquiries";
import {
  STAGES,
  stageOf,
  isOpenStage,
  SOURCES,
  sourceLabel,
  PRIORITIES,
  priorityOf,
  LOST_REASONS,
  CALL_OUTCOMES,
  followUpPresets,
  followUpBadge,
  timeAgo,
  toLocalInput,
  waNumber,
  openWhatsApp,
  WA_TEMPLATES,
  suggestedTemplate,
} from "../../../utils/leads";
import { formatDate } from "../../../utils/dateUtils";

export const WhatsAppGlyph = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.45-9.45 9.45M20.1 3.9A11.3 11.3 0 0 0 12.05.55C5.78.55.68 5.65.68 11.92c0 2 .52 3.96 1.52 5.68L.58 23.5l6.03-1.58a11.37 11.37 0 0 0 5.43 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.04" />
  </svg>
);

const ACTIVITY_META = {
  note: { icon: StickyNote, label: "Note", tone: "bg-slate-100 text-slate-600" },
  call: { icon: PhoneCall, label: "Call", tone: "bg-blue-50 text-blue-600" },
  whatsapp: { icon: WhatsAppGlyph, label: "WhatsApp", tone: "bg-green-50 text-green-600" },
  email: { icon: Mail, label: "Email", tone: "bg-indigo-50 text-indigo-600" },
  meeting: { icon: Handshake, label: "Meeting", tone: "bg-teal-50 text-teal-600" },
  status: { icon: RefreshCw, label: "Stage", tone: "bg-amber-50 text-amber-700" },
  follow_up: { icon: Clock, label: "Follow-up", tone: "bg-orange-50 text-orange-600" },
  assigned: { icon: UserPlus, label: "Assigned", tone: "bg-purple-50 text-purple-600" },
  created: { icon: Sparkles, label: "Lead created", tone: "bg-emerald-50 text-emerald-600" },
  converted: { icon: Trophy, label: "Won", tone: "bg-purple-50 text-purple-700" },
  edited: { icon: Pencil, label: "Edited", tone: "bg-slate-100 text-slate-500" },
};

const chip = "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all";
const input =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#e7f63c]";
const label = "block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1";

function FollowUpPicker({ value, onPick, compact = false }) {
  const presets = useMemo(() => followUpPresets(), []);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPick(p.at)}
          className={`${chip} bg-white border-slate-200 text-slate-600 hover:border-[#181c22] hover:text-[#181c22]`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="datetime-local"
        value={value ? toLocalInput(value) : ""}
        onChange={(e) => e.target.value && onPick(new Date(e.target.value))}
        className={`${compact ? "w-44" : "w-48"} px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600`}
        aria-label="Pick a date and time"
      />
    </div>
  );
}

const LeadDrawer = ({ leadId, token, user, isAdmin, members = [], agencyName, startWithWhatsApp = false, onClose, onChanged }) => {
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [composer, setComposer] = useState(null); // { key, text, followUp }
  const [lostAsk, setLostAsk] = useState(null); // { reason, other }
  const [editing, setEditing] = useState(null); // form copy of the lead
  const [log, setLog] = useState({ type: "note", body: "", outcome: "", followUp: null });

  const load = useCallback(async () => {
    try {
      const res = await getLeadInquiry(token, leadId);
      setLead(res.inquiry);
      setActivities(res.activities || []);
      return res.inquiry;
    } catch (err) {
      toast.error(err.message || "Could not load the lead");
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, leadId]);

  useEffect(() => {
    setLoading(true);
    setComposer(null);
    setEditing(null);
    load().then((l) => {
      if (l && startWithWhatsApp) openComposer(l);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ctx = { agent: (user?.name || "").split(" ")[0] || "your travel expert", agency: agencyName || "our team" };

  const refresh = async () => {
    const l = await load();
    if (l) onChanged?.(l);
  };

  const patch = async (data, okMsg) => {
    setBusy("patch");
    try {
      await updateLeadInquiry(token, lead.id, data);
      if (okMsg) toast.success(okMsg);
      await refresh();
      return true;
    } catch (err) {
      toast.error(err.message || "Could not update the lead");
      return false;
    } finally {
      setBusy("");
    }
  };

  const record = async (data, okMsg) => {
    setBusy("log");
    try {
      await logLeadActivity(token, lead.id, data);
      if (okMsg) toast.success(okMsg);
      await refresh();
      return true;
    } catch (err) {
      toast.error(err.message || "Could not save");
      return false;
    } finally {
      setBusy("");
    }
  };

  function openComposer(l = lead) {
    const t = suggestedTemplate(l);
    setComposer({ key: t.key, text: t.text(l, ctx), followUp: isOpenStage(l.status) });
  }

  const sendWhatsApp = () => {
    const text = composer.text.trim();
    if (!openWhatsApp(lead.client_phone, text)) {
      toast.error(waNumber(lead.client_phone) ? "Your browser blocked the WhatsApp window — allow pop-ups for this site." : "This lead has no valid phone number.");
      return;
    }
    const next = composer.followUp ? followUpPresets().find((p) => p.key === "3d").at : undefined;
    setComposer(null);
    record(
      { type: "whatsapp", body: text, template: composer.key, ...(next ? { next_follow_up_at: next.toISOString() } : {}) },
      next ? "WhatsApp logged · follow-up in 3 days" : "WhatsApp logged",
    );
  };

  const changeStage = (key) => {
    if (key === lead.status) return;
    if (key === "lost") return setLostAsk({ reason: LOST_REASONS[0], other: "" });
    if (key === "converted") return convert();
    patch({ status: key }, `Moved to ${stageOf(key).label}`);
  };

  const confirmLost = async () => {
    const reason = lostAsk.reason === "Other" ? lostAsk.other.trim() || "Other" : lostAsk.reason;
    if (await patch({ status: "lost", lost_reason: reason }, "Marked as lost")) setLostAsk(null);
  };

  const convert = async () => {
    if (!window.confirm(`Create a trip for ${lead.client_name} from this lead?`)) return;
    setBusy("convert");
    try {
      const res = await convertInquiryToTrip(token, lead.id);
      const tripId = res.trip_id || res.data?.trip_id;
      toast.success("Lead won — trip created");
      await refresh();
      if (tripId) navigate(`/trip-builder/${tripId}`);
    } catch (err) {
      toast.error(err.message || "Could not convert the lead");
    } finally {
      setBusy("");
    }
  };

  const saveLog = async () => {
    const { type, body, outcome, followUp } = log;
    if (type === "note" && !body.trim()) return toast.error("Write the note first");
    const ok = await record(
      {
        type,
        body: [outcome, body.trim()].filter(Boolean).join(" — ") || null,
        outcome: outcome || undefined,
        ...(followUp ? { next_follow_up_at: followUp.toISOString() } : {}),
      },
      `${ACTIVITY_META[type].label} logged`,
    );
    if (ok) setLog({ type, body: "", outcome: "", followUp: null });
  };

  const saveEdit = async () => {
    const f = editing;
    if (!f.client_name.trim()) return toast.error("Client name is required");
    if (await patch(
      {
        client_name: f.client_name,
        client_phone: f.client_phone,
        client_email: f.client_email,
        destination: f.destination,
        start_date: f.start_date || null,
        duration: f.duration,
        adults: f.adults,
        kids_cnb: f.kids_cnb,
        kids_5_to_12: f.kids_5_to_12,
        approximate_budget: f.approximate_budget,
        special_requests: f.special_requests,
        source: f.source || undefined,
      },
      "Lead updated",
    )) setEditing(null);
  };

  if (!lead) {
    return (
      <Shell onClose={onClose}>
        <div className="flex-1 flex items-center justify-center text-slate-400">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Lead not found"}
        </div>
      </Shell>
    );
  }

  const prio = priorityOf(lead.priority);
  const due = followUpBadge(lead.next_follow_up_at);
  const open = isOpenStage(lead.status);
  const pax = (lead.adults || 0) + (lead.kids_cnb || 0) + (lead.kids_5_to_12 || 0);
  const hasPhone = !!waNumber(lead.client_phone);

  return (
    <Shell onClose={onClose}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              <span className="font-mono">{lead.inquiry_id}</span>
              <span>·</span>
              <span>{sourceLabel(lead.source)}</span>
              <span>·</span>
              <span>{timeAgo(lead.created_at)}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 truncate mt-0.5">{lead.client_name}</h2>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {[lead.destination, lead.start_date && formatDate(lead.start_date), lead.duration && `${lead.duration}N`, pax && `${pax} pax`]
                .filter(Boolean)
                .join(" · ") || "No trip details yet"}
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <a
            href={lead.client_phone ? `tel:${lead.client_phone}` : undefined}
            onClick={() => lead.client_phone && setLog((s) => ({ ...s, type: "call" }))}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-bold ${lead.client_phone ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "border-slate-100 text-slate-300 pointer-events-none"}`}
          >
            <Phone className="w-4 h-4" /> Call
          </a>
          <button
            type="button"
            disabled={!hasPhone}
            onClick={() => openComposer()}
            className="flex flex-col items-center gap-1 py-2 rounded-xl border border-green-200 bg-green-50 text-green-700 text-[11px] font-bold hover:bg-green-100 disabled:opacity-40"
          >
            <WhatsAppGlyph className="w-4 h-4" /> WhatsApp
          </button>
          <a
            href={lead.client_email ? `mailto:${lead.client_email}?subject=${encodeURIComponent(`Your ${lead.destination || ""} trip`.replace("  ", " "))}` : undefined}
            onClick={() => lead.client_email && record({ type: "email", body: `Email to ${lead.client_email}` })}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-bold ${lead.client_email ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "border-slate-100 text-slate-300 pointer-events-none"}`}
          >
            <Mail className="w-4 h-4" /> Email
          </a>
          {lead.status === "converted" && lead.converted_trip_id ? (
            <button
              type="button"
              onClick={() => navigate(`/trip-builder/${lead.converted_trip_id}`)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-[#181c22] text-white text-[11px] font-bold"
            >
              <ArrowRight className="w-4 h-4" /> Open trip
            </button>
          ) : (
            <button
              type="button"
              disabled={lead.status === "converted" || busy === "convert"}
              onClick={convert}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-[#e7f63c] text-[#181c22] text-[11px] font-bold hover:bg-[#d4e42e] disabled:opacity-50"
            >
              {busy === "convert" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} Make trip
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* WhatsApp composer */}
        {composer && (
          <section className="rounded-2xl border border-green-200 bg-green-50/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <WhatsAppGlyph className="w-4 h-4 text-green-600" /> Message {lead.client_name.split(" ")[0]}
              </h3>
              <button onClick={() => setComposer(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close message">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {WA_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setComposer((c) => ({ ...c, key: t.key, text: t.text(lead, ctx) }))}
                  className={`${chip} ${composer.key === t.key ? "bg-[#181c22] text-white border-[#181c22]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              rows={7}
              value={composer.text}
              onChange={(e) => setComposer((c) => ({ ...c, text: e.target.value }))}
              className={`${input} bg-white resize-y`}
            />
            <label className="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={composer.followUp}
                onChange={(e) => setComposer((c) => ({ ...c, followUp: e.target.checked }))}
              />
              Remind me to follow up in 3 days
            </label>
            <button
              type="button"
              onClick={sendWhatsApp}
              disabled={!composer.text.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:bg-[#1ebe5b] disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Open in WhatsApp {/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? "" : "Web"}
            </button>
            <p className="text-[11px] text-slate-400 mt-1.5 text-center">Opens the chat with this message ready — press send there. It's saved on the lead's timeline.</p>
          </section>
        )}

        {/* Stage */}
        <section>
          <div className={label}>Stage</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={busy !== "" || lead.status === "converted"}
                onClick={() => changeStage(s.key)}
                className={`${chip} flex items-center gap-1.5 ${lead.status === s.key || (s.key === "lost" && lead.status === "closed") ? s.tone + " ring-2 ring-offset-1 ring-slate-300" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"} disabled:cursor-not-allowed`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            ))}
          </div>
          {(lead.status === "lost" || lead.status === "closed") && lead.lost_reason && (
            <p className="text-xs text-slate-500 mt-2">
              <XCircle className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> {lead.lost_reason}
            </p>
          )}
          {lostAsk && (
            <div className="mt-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs font-bold text-slate-700 mb-2">Why was it lost?</div>
              <div className="flex flex-wrap gap-1.5">
                {LOST_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setLostAsk((a) => ({ ...a, reason: r }))}
                    className={`${chip} ${lostAsk.reason === r ? "bg-[#181c22] text-white border-[#181c22]" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {lostAsk.reason === "Other" && (
                <input className={`${input} mt-2`} placeholder="Reason" value={lostAsk.other} onChange={(e) => setLostAsk((a) => ({ ...a, other: e.target.value }))} />
              )}
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setLostAsk(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                <button onClick={confirmLost} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#181c22] text-white">Mark lost</button>
              </div>
            </div>
          )}
        </section>

        {/* Priority + owner */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className={label}>Priority</div>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => p.key !== prio.key && patch({ priority: p.key })}
                  className={`${chip} flex items-center gap-1 ${prio.key === p.key ? p.tone : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className={label}>Assigned to</div>
            {isAdmin && lead.status !== "converted" ? (
              <select
                value={lead.assigned_to || ""}
                onChange={(e) => patch({ assigned_to: e.target.value === "" ? null : Number(e.target.value) }, "Lead assigned")}
                className={`${input} py-1.5 text-xs font-semibold`}
              >
                <option value="">Unassigned</option>
                {user?.id && !members.some((m) => m.id === user.id) && <option value={user.id}>Me ({user.name})</option>}
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm font-semibold text-slate-700 py-1.5">{lead.assignee?.name || "Unassigned"}</div>
            )}
          </div>
        </section>

        {/* Next follow-up */}
        {open && (
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" /> Next follow-up
              </div>
              {due ? (
                <span className={`${chip} ${due.tone}`}>{due.label}</span>
              ) : (
                <span className="text-xs font-semibold text-red-500">Not scheduled</span>
              )}
            </div>
            <FollowUpPicker value={lead.next_follow_up_at} onPick={(d) => patch({ next_follow_up_at: d.toISOString() }, "Follow-up scheduled")} />
            {due && (
              <button
                type="button"
                onClick={() => patch({ next_follow_up_at: null }, "Follow-up done")}
                className="mt-2 text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Mark done (no next follow-up)
              </button>
            )}
          </section>
        )}

        {/* Log activity */}
        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="flex gap-1.5 mb-3">
            {["note", "call", "meeting"].map((t) => {
              const M = ACTIVITY_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLog((s) => ({ ...s, type: t, outcome: "" }))}
                  className={`${chip} flex items-center gap-1.5 ${log.type === t ? "bg-[#181c22] text-white border-[#181c22]" : "bg-white text-slate-600 border-slate-200"}`}
                >
                  <M.icon className="w-3.5 h-3.5" /> {t === "note" ? "Note" : t === "call" ? "Call" : "Meeting"}
                </button>
              );
            })}
          </div>
          {log.type === "call" && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CALL_OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setLog((s) => ({ ...s, outcome: s.outcome === o ? "" : o }))}
                  className={`${chip} ${log.outcome === o ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <textarea
            rows={3}
            value={log.body}
            onChange={(e) => setLog((s) => ({ ...s, body: e.target.value }))}
            placeholder={log.type === "note" ? "What did you learn? Budget, hotel taste, decision maker…" : "What was discussed?"}
            className={`${input} resize-y`}
          />
          {open && (
            <div className="mt-2">
              <div className="text-[11px] font-bold text-slate-400 mb-1">
                Next follow-up {log.followUp ? `· ${followUpBadge(log.followUp)?.label}` : "(optional)"}
              </div>
              <FollowUpPicker compact value={log.followUp} onPick={(d) => setLog((s) => ({ ...s, followUp: d }))} />
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={saveLog}
              disabled={busy !== ""}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e7f63c] text-[#181c22] hover:bg-[#d4e42e] disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy === "log" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </section>

        {/* Details */}
        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-black text-slate-900">Lead details</div>
            {!editing && (
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    client_name: lead.client_name || "",
                    client_phone: lead.client_phone || "",
                    client_email: lead.client_email || "",
                    destination: lead.destination || "",
                    start_date: lead.start_date || "",
                    duration: lead.duration || "",
                    adults: lead.adults ?? 1,
                    kids_cnb: lead.kids_cnb ?? 0,
                    kids_5_to_12: lead.kids_5_to_12 ?? 0,
                    approximate_budget: lead.approximate_budget ?? "",
                    special_requests: lead.special_requests || "",
                    source: lead.source || "",
                  })
                }
                className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["client_name", "Name", "text", 2],
                ["client_phone", "Phone", "tel", 1],
                ["client_email", "Email", "email", 1],
                ["destination", "Destination", "text", 1],
                ["start_date", "Travel date", "date", 1],
                ["duration", "Nights", "number", 1],
                ["approximate_budget", "Budget (₹)", "number", 1],
                ["adults", "Adults", "number", 1],
                ["kids_5_to_12", "Kids 5–12", "number", 1],
                ["kids_cnb", "Kids under 5", "number", 1],
              ].map(([k, l, type, span]) => (
                <div key={k} className={span === 2 ? "col-span-2" : ""}>
                  <label className={label}>{l}</label>
                  <input type={type} min={type === "number" ? 0 : undefined} value={editing[k]} onChange={(e) => setEditing((f) => ({ ...f, [k]: e.target.value }))} className={input} />
                </div>
              ))}
              <div>
                <label className={label}>Source</label>
                <select value={editing.source} onChange={(e) => setEditing((f) => ({ ...f, source: e.target.value }))} className={input}>
                  <option value="">—</option>
                  {SOURCES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={label}>Requirements</label>
                <textarea rows={3} value={editing.special_requests} onChange={(e) => setEditing((f) => ({ ...f, special_requests: e.target.value }))} className={`${input} resize-y`} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                <button onClick={saveEdit} disabled={busy !== ""} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#181c22] text-white disabled:opacity-50">
                  Save details
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <Detail icon={Phone} label="Phone" value={lead.client_phone} />
              <Detail icon={Mail} label="Email" value={lead.client_email} />
              <Detail icon={MapPin} label="Destination" value={lead.destination} />
              <Detail icon={Calendar} label="Travel" value={[lead.start_date && formatDate(lead.start_date), lead.duration && `${lead.duration} nights`].filter(Boolean).join(" · ")} />
              <Detail icon={Users} label="Guests" value={`${lead.adults || 0} adults${lead.kids_5_to_12 ? ` · ${lead.kids_5_to_12} kids 5–12` : ""}${lead.kids_cnb ? ` · ${lead.kids_cnb} under 5` : ""}`} />
              <Detail icon={IndianRupee} label="Budget" value={lead.approximate_budget ? `₹${Number(lead.approximate_budget).toLocaleString("en-IN")}` : ""} />
              {lead.special_requests && (
                <div className="col-span-2">
                  <dt className={label}>Requirements</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap">{lead.special_requests}</dd>
                </div>
              )}
              {lead.notes && (
                <div className="col-span-2">
                  <dt className={label}>Notes</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap">{lead.notes}</dd>
                </div>
              )}
              {(lead.utm_source || lead.utm_campaign) && (
                <div className="col-span-2 text-[11px] text-slate-400">
                  Campaign: {[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ")}
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Timeline */}
        <section>
          <div className="text-sm font-black text-slate-900 mb-3">Timeline</div>
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing yet — every call, message, note and stage change will show here.</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-3 space-y-4">
              {activities.map((a) => {
                const M = ACTIVITY_META[a.type] || ACTIVITY_META.note;
                return (
                  <li key={a.id} className="ml-5">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${M.tone}`}>
                      <M.icon className="w-3 h-3" />
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{M.label}</span>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap" title={new Date(a.created_at).toLocaleString()}>
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                    {a.body && <p className="text-xs text-slate-600 whitespace-pre-wrap mt-0.5 line-clamp-6">{a.body}</p>}
                    {a.author?.name && <p className="text-[11px] text-slate-400 mt-0.5">by {a.author.name}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Shell>
  );
};

const Detail = ({ icon, label: l, value }) => {
  const Icon = icon;
  return (
  <div className="min-w-0">
    <dt className={label}>{l}</dt>
    <dd className="flex items-center gap-1.5 text-slate-700 truncate">
      <Icon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
      <span className="truncate">{value || <span className="text-slate-300">—</span>}</span>
    </dd>
  </div>
  );
};

const Shell = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex justify-end">
    <div className="absolute inset-0 bg-black/30" onClick={onClose} />
    <aside className="relative w-full sm:w-[480px] h-full bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true">
      {children}
    </aside>
  </div>
);

export default LeadDrawer;
