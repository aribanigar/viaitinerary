import React, { useMemo, useState } from "react";
import {
  AudioLines,
  Check,
  CircleAlert,
  CircleX,
  Hammer,
  Pencil,
  Loader2,
  Mic,
  MicOff,
  SendHorizontal,
  TriangleAlert,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

// Ching's panel — purely presentational; ChingWidget owns speech and the live
// session. Kept deliberately small (≤ ~42% of a phone screen, no backdrop) so
// the Trip Builder form and preview filling up behind it stay visible.

const INK = "#181c22";
const LIME = "#e7f63c";

const EDIT_EXAMPLES =
  "“make Gulmarg 2 nights”, “add Shikara ride on day 2”, “give me 20% margin”, “email it to me”";

function exampleCommand(hotels) {
  const byCity = new Map();
  (hotels || []).forEach((h) => {
    if (h?.name && h.city && !byCity.has(h.city)) byCity.set(h.city, h);
  });
  const picks = [...byCity.values()].slice(0, 2);
  const stays =
    picks.length === 2
      ? `2 nights at ${picks[0].name} in ${picks[0].city}, 2 nights at ${picks[1].name} in ${picks[1].city}`
      : "2 nights in Srinagar, 2 nights in Pahalgam";
  return `Create a 5 day trip for Rahul Sharma, 2 adults and 1 child, from 10 November, ${stays}, with Innova, breakfast and dinner.`;
}

const safeCall = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const Unrecognized = ({ items }) =>
  items?.length ? (
    <ul className="space-y-0.5">
      {items.map((u, i) => (
        <li key={i} className="text-[11px] text-[#181c22]/50 break-words">
          Didn't understand: “{u}”
        </li>
      ))}
    </ul>
  ) : null;

const Warnings = ({ items }) =>
  items?.length ? (
    <ul className="space-y-1">
      {items.map((w, i) => (
        <li key={i} className="flex gap-1.5 text-[11px] font-medium text-amber-800">
          <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" /> {w}
        </li>
      ))}
    </ul>
  ) : null;

const ChangeList = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((c, i) => (
      <li key={i} className="flex gap-2 text-[13px] leading-snug text-[#181c22]">
        <span className="grid place-items-center w-4 h-4 mt-0.5 shrink-0 rounded-full bg-[#e7f63c]">
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
        <span className="min-w-0 break-words">{c}</span>
      </li>
    ))}
  </ul>
);

function MicButton({ listening, disabled, onClick, supported }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={listening ? "Stop listening" : "Start listening"}
      className={`relative grid place-items-center w-14 h-14 shrink-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
        listening
          ? "bg-[#e7f63c] text-[#181c22]"
          : "bg-[#181c22] text-white hover:scale-105 active:scale-95"
      } shadow-[0_12px_30px_-12px_rgba(16,24,42,0.65)]`}
    >
      {listening && (
        <span className="absolute inset-0 rounded-full bg-[#e7f63c] opacity-40 animate-ping" />
      )}
      {supported ? (
        <Mic className="relative w-6 h-6" strokeWidth={2} />
      ) : (
        <MicOff className="relative w-6 h-6" strokeWidth={2} />
      )}
    </button>
  );
}

// What's still missing in the trip (from the builder's checklist). Tapping
// an item opens that tab in the builder.
function Pending({ items, onOpenTab }) {
  if (!items?.length) return null;
  const required = items.filter((i) => i.level === "required");
  const optional = items.filter((i) => i.level !== "required");
  return (
    <div className="rounded-xl bg-amber-50/70 border border-amber-200/60 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800/80 mb-1.5">
        Still needed · {items.length}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {[...required, ...optional].slice(0, 10).map((i) => (
          <li key={i.key}>
            <button
              type="button"
              onClick={() => onOpenTab?.(i.tab)}
              title={`Open ${i.tab}`}
              className={`px-2 py-1 rounded-full text-[11px] font-medium border ${
                i.level === "required"
                  ? "bg-white border-amber-300 text-amber-900"
                  : "bg-white/60 border-black/10 text-[#181c22]/60"
              }`}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Hotel search results (from the agency's own catalog): rate for the trip's
// nights, meal plan, availability — with "Use" when the open trip can take it.
const MEAL_SHORT = { room_only: "Room only", breakfast_only: "Breakfast", breakfast_dinner: "Breakfast + Dinner", all_meals: "All meals" };
const AVAIL_STYLE = {
  available: ["text-emerald-700", "Available"],
  blackout: ["text-amber-700", "Blackout — confirm"],
  unchecked: ["text-[#181c22]/45", "Dates not checked"],
};
function HotelResults({ hotels, onUse, running }) {
  if (!hotels?.results?.length) return null;
  return (
    <ul className="pl-8 space-y-1.5">
      {hotels.results.slice(0, 5).map((r, i) => {
        const [cls, label] = AVAIL_STYLE[r.availability?.status] || AVAIL_STYLE.unchecked;
        return (
          <li key={r.id} className="flex items-center gap-2 rounded-xl border border-black/[0.07] bg-white px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-[#181c22]/40 w-3 shrink-0">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold truncate" title={r.name}>
                {r.name} {r.stars ? <span className="text-[#181c22]/45 font-medium">{r.stars}★</span> : null}
              </span>
              <span className="block text-[11px] text-[#181c22]/60 truncate">
                ₹{Number(r.rate_per_night || 0).toLocaleString("en-IN")}/night · {r.room_type}
                {r.meal_plan ? ` · ${MEAL_SHORT[r.meal_plan] || r.meal_plan}` : ""} · <span className={cls}>{label}</span>
              </span>
            </span>
            {hotels.canUse && (
              <button
                type="button"
                disabled={running}
                onClick={() => onUse?.(i + 1)}
                className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-40"
                style={{ background: INK, color: LIME }}
              >
                Use
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// What Ching said back (also spoken aloud when voice replies are on).
const Reply = ({ text }) =>
  text ? (
    <div className="flex items-start gap-2">
      <span className="grid place-items-center w-6 h-6 rounded-full shrink-0" style={{ background: INK }}>
        <AudioLines className="w-3 h-3" style={{ color: LIME }} />
      </span>
      <p className="flex-1 rounded-2xl rounded-tl-sm bg-[#f4f5f6] px-3 py-2 text-[13px] leading-snug">{text}</p>
    </div>
  ) : null;

// The live session: what has been filled/changed so far, updating as the
// agent speaks.
function LiveBlock({ live, onOpenTab }) {
  const label =
    live.phase === "opening"
      ? "Opening a new trip…"
      : live.phase === "finishing"
        ? "Finishing…"
        : live.mode === "edit"
          ? "Updating the trip…"
          : "Filling…";
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-[#fafafa] p-3 space-y-2" aria-live="polite">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/55">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="flex-1">{label}</span>
        {live.changes.length > 0 && <span>{live.changes.length}</span>}
      </div>
      {live.changes.length > 0 ? (
        <ChangeList items={live.changes} />
      ) : (
        live.phase === "listening" && (
          <p className="text-xs text-[#181c22]/45">Changes appear here — and in the form — as you speak.</p>
        )
      )}
      <Warnings items={live.warnings} />
      <Unrecognized items={live.unrecognized} />
      <Pending items={live.pending} onOpenTab={onOpenTab} />
    </div>
  );
}

// Confirm & Build: the trip Ching understood, laid out to check before anything
// is saved — so a misheard word doesn't become a booking mistake.
const CHECK_STYLE = {
  ok: { icon: Check, cls: "text-emerald-700", dot: "bg-emerald-100" },
  warn: { icon: TriangleAlert, cls: "text-amber-800", dot: "bg-amber-100" },
  save: { icon: TriangleAlert, cls: "text-amber-800", dot: "bg-amber-100" },
  blocking: { icon: CircleX, cls: "text-[#b42318]", dot: "bg-[#fff0ee]" },
};

function DraftCard({ tripDraft, running, onConfirm, onEdit, onCancel }) {
  const { draft } = tripDraft;
  const [showOk, setShowOk] = useState(false);
  const problems = draft.checks.filter((c) => c.level !== "ok");
  const passed = draft.checks.filter((c) => c.level === "ok");
  const value = (k) => draft.rows.find((r) => r[0] === k)?.[1];
  const header = [value("Client") || "No client name", value("Guests")].filter(Boolean).join(" | ");
  const when = [value("Dates"), value("Duration")?.replace(/\s/g, "")].filter(Boolean).join(" | ");
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-3 space-y-2.5" aria-live="polite">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/50">Trip draft · not saved yet</div>
      <div>
        <div className="text-[14px] font-semibold leading-snug break-words">{header}</div>
        {when && <div className="text-[13px] text-[#181c22]/70">{when}</div>}
        {value("Destination") && <div className="text-[12px] text-[#181c22]/55">{value("Destination")}</div>}
      </div>
      {draft.stays.length > 0 && (
        <ul className="rounded-xl bg-[#f7f7f8] divide-y divide-black/5">
          {draft.stays.map((g, i) => (
            <li key={i} className="flex items-baseline gap-2 px-2.5 py-1.5 text-[13px]">
              <span className="font-semibold shrink-0">{g.city} – {g.nights}N</span>
              <span className="flex-1 min-w-0 truncate text-[#181c22]/65" title={g.hotel}>
                {g.hotel || "no hotel"}
              </span>
              {(g.suggested || g.picked) && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800" title={g.suggested ? "Ching planned this city — nobody said it" : "Ching picked this hotel"}>
                  {g.suggested ? "suggested" : "picked"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {(value("Vehicle") || value("Meals")) && (
        <div className="text-[12px] text-[#181c22]/65 break-words">{[value("Vehicle"), value("Meals")].filter(Boolean).join(" · ")}</div>
      )}
      <ul className="space-y-1">
        {problems.map((c, i) => {
          const st = CHECK_STYLE[c.level];
          const Icon = st.icon;
          return (
            <li key={i} className={`flex gap-1.5 text-[12px] font-medium ${st.cls}`}>
              <Icon className="w-3.5 h-3.5 mt-px shrink-0" /> <span className="break-words">{c.text}</span>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => setShowOk((v) => !v)} className="flex gap-1.5 text-[12px] font-medium text-emerald-700">
            <Check className="w-3.5 h-3.5 mt-px shrink-0" /> {passed.length} checks passed{showOk ? "" : " — show"}
          </button>
        </li>
        {showOk &&
          passed.map((c, i) => (
            <li key={`ok${i}`} className="pl-5 text-[11px] text-[#181c22]/55">
              {c.text}
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-0.5">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!draft.ok || running}
          title={draft.ok ? "Build the trip and save it" : draft.blocking[0]?.text}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ background: INK, color: LIME }}
        >
          <Hammer className="w-3.5 h-3.5" /> Confirm &amp; Build
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={running}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold border border-black/10 text-[#181c22] hover:bg-black/[0.03]"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={running}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[#b42318] hover:bg-[#fff4f3]"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
      <p className="text-[11px] text-[#181c22]/45">
        {draft.ok ? "Say “confirm” to build it — or say a change, like “make Gulmarg 2 nights”." : "Say or type the fix — the draft updates, then confirm."}
      </p>
    </div>
  );
}

// After a live session: a small pill in place of the sheet, so the builder's
// form and preview stay visible. Tap the text to reopen the full panel.
function ResultPill({ outcome, canUndo, onUndo, onExpand, onClose, speech }) {
  return (
    <div
      role="status"
      className="fixed z-[90] left-4 right-4 sm:left-auto sm:right-4 lg:right-6 bottom-[calc(env(safe-area-inset-bottom)+68px)] sm:bottom-[calc(env(safe-area-inset-bottom)+136px)] lg:bottom-[92px] sm:max-w-[400px] flex items-center gap-1.5 rounded-full bg-[#181c22] text-white pl-2 pr-1.5 py-1.5 shadow-[0_16px_40px_-14px_rgba(16,24,42,0.7)]"
    >
      <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-[#e7f63c] text-[#181c22]">
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
      <button
        type="button"
        onClick={onExpand}
        className="flex-1 min-w-0 text-left text-[13px] font-semibold truncate px-1"
        title={(outcome.lines || []).join("\n") || outcome.title}
      >
        {outcome.title}
      </button>
      {canUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1 h-8 px-3 shrink-0 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
      )}
      {speech.supported && (
        <button
          type="button"
          onClick={speech.startCommand}
          className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-[#e7f63c] text-[#181c22]"
          aria-label="Speak again"
          title="Speak again (Alt+C)"
        >
          <Mic className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="grid place-items-center w-8 h-8 shrink-0 rounded-full text-white/60 hover:text-white"
        aria-label="Close Ching"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ChingPanel({
  speech,
  handsFree,
  onToggleHandsFree,
  lang = "en-IN",
  langs = [],
  onChangeLang,
  status,
  init,
  notice,
  onDismissNotice,
  onSubmitText,
  onClose,
  editor,
  live,
  outcome,
  compact,
  canUndo,
  progress,
  onUndo,
  onExpand,
  voiceOn,
  speaking,
  onToggleVoice,
  onOpenTab,
  onConfirm,
  tripDraft,
  onConfirmDraft,
  onEditDraft,
  onCancelDraft,
  onUseHotel,
}) {
  const [draft, setDraft] = useState("");
  const { supported, phase, interim, error, wakeBlocked } = speech;
  const listening = phase === "command";
  const running = status === "running";
  const example = useMemo(() => exampleCommand(init?.hotels), [init]);
  const blank = editor ? safeCall(() => editor.isBlank(), false) : false;
  const tripLabel = editor?.tripLabel || "this trip";

  if (compact && outcome && !live && !listening && !running) {
    return (
      <ResultPill
        outcome={outcome}
        canUndo={canUndo}
        onUndo={onUndo}
        onExpand={onExpand}
        onClose={onClose}
        speech={speech}
      />
    );
  }

  const submitDraft = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || running) return;
    speech.clearError();
    setDraft("");
    onSubmitText(text);
  };

  const statusLabel = listening
    ? "Listening… pause when you're done"
    : !supported
      ? "Voice isn't supported here — type below"
      : phase === "wake"
        ? "Say “Hello Ching” — or tap the mic"
        : "Tap the mic and speak · Alt+C";

  const idleHint = !editor
    ? `Ask for a trip and it fills in as you speak: “${example}”`
    : blank
      ? `Describe the trip — the form fills in as you speak: “${example}”`
      : `Editing ${tripLabel} — try: ${EDIT_EXAMPLES}.`;

  const subtitle = !editor ? "Voice trip builder" : blank ? "New trip" : tripLabel;
  // A draft to confirm gets the room it needs, so Confirm & Build is in view.
  const tall = !!tripDraft && !listening;
  const hint = tall ? "Check the draft below, then say “confirm” — or say a change." : idleHint;

  return (
    <div
      role="dialog"
      aria-label="Ching voice trip builder"
      className={`fixed z-[90] inset-x-0 bottom-0 ${tall ? "max-h-[82dvh]" : "max-h-[42dvh]"} sm:inset-x-auto sm:right-4 lg:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+136px)] lg:bottom-[92px] sm:w-[400px] sm:max-h-[calc(100dvh-180px)] ${tall ? "lg:max-h-[min(760px,calc(100dvh-116px))]" : "lg:max-h-[min(560px,calc(100dvh-116px))]"} flex flex-col bg-white text-[#181c22] rounded-t-[24px] sm:rounded-[24px] border border-black/5 shadow-[0_-10px_50px_-20px_rgba(16,24,42,0.45)] sm:shadow-[0_24px_70px_-24px_rgba(16,24,42,0.55)] overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-2 border-b border-black/5 shrink-0">
        <span className="grid place-items-center w-8 h-8 rounded-full shrink-0" style={{ background: INK }}>
          <AudioLines className="w-4 h-4" style={{ color: LIME }} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold tracking-tight leading-tight">Ching</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45 leading-tight truncate">
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceOn}
          title={voiceOn ? "Ching talks back — tap to mute" : "Ching is muted — tap to hear replies"}
          className={`grid place-items-center w-8 h-8 rounded-full border border-black/10 shrink-0 hover:bg-black/[0.03] ${
            speaking ? "bg-[#e7f63c]" : "bg-white"
          }`}
          aria-label={voiceOn ? "Mute Ching's voice" : "Turn on Ching's voice"}
        >
          {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[#181c22]/45" />}
        </button>
        {langs.length > 1 && onChangeLang && (
          <button
            type="button"
            onClick={() => {
              const i = langs.findIndex((l) => l.code === lang);
              onChangeLang(langs[(i + 1) % langs.length].code);
            }}
            disabled={!supported}
            title={`Listening in ${langs.find((l) => l.code === lang)?.label || "English"} — tap to change (English / हिन्दी / اردو)`}
            aria-label="Change the language Ching listens in"
            className="grid place-items-center h-8 min-w-8 px-2 rounded-full border border-black/10 bg-white hover:bg-black/[0.03] text-[11px] font-bold disabled:opacity-40 shrink-0"
          >
            {langs.find((l) => l.code === lang)?.short || "EN"}
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={handsFree}
          onClick={onToggleHandsFree}
          disabled={!supported}
          title={
            wakeBlocked && handsFree
              ? "Hands-free is paused — microphone unavailable"
              : "Hands-free: say “Hello Ching” on any page"
          }
          className="flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full border border-black/10 bg-white hover:bg-black/[0.03] disabled:opacity-40 shrink-0"
        >
          <span className="text-[11px] font-semibold whitespace-nowrap">Hello Ching</span>
          <span
            className={`relative w-9 h-6 rounded-full transition-colors ${
              handsFree ? (wakeBlocked ? "bg-amber-400" : "bg-[#181c22]") : "bg-black/15"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                handsFree ? "left-4 bg-[#e7f63c]" : "left-1 bg-white"
              }`}
            />
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid place-items-center w-8 h-8 rounded-full text-[#181c22]/55 hover:bg-black/[0.05] shrink-0"
          aria-label="Close Ching"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3 space-y-3">
        <div className="flex items-start gap-3">
          <MicButton
            listening={listening}
            supported={supported}
            disabled={!supported || running}
            onClick={speech.toggleCommand}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#181c22]/45">
              {statusLabel}
            </div>
            <p className="mt-1 text-[14px] leading-snug break-words" aria-live="polite">
              {listening && interim ? (
                <span className="text-[#181c22]">{interim}</span>
              ) : (
                <span className="text-[#181c22]/40">
                  {listening ? "Go ahead — I'm listening…" : live ? "" : hint}
                </span>
              )}
            </p>
          </div>
        </div>

        {live && <LiveBlock live={live} onOpenTab={onOpenTab} />}

        {running && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-[#f4f5f6] p-3 text-[13px] font-medium">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {progress || "Working on it…"}
          </div>
        )}

        {tripDraft && !live && !listening && (
          <DraftCard tripDraft={tripDraft} running={running} onConfirm={onConfirmDraft} onEdit={onEditDraft} onCancel={onCancelDraft} />
        )}

        {outcome && !tripDraft && !live && !listening && !running && (
          <div className="rounded-2xl border border-black/[0.07] bg-[#fafafa] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center w-[18px] h-[18px] shrink-0 rounded-full bg-[#e7f63c]">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{outcome.title}</span>
              {canUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  className="flex items-center gap-1 h-8 px-3 shrink-0 rounded-full border border-black/10 bg-white text-xs font-semibold hover:bg-black/[0.03]"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </button>
              )}
            </div>
            <Reply text={outcome.reply} />
            {outcome.lines?.length > 0 && <ChangeList items={outcome.lines} />}
            <Warnings items={outcome.warnings} />
            <Unrecognized items={outcome.unrecognized} />
            <Pending items={outcome.pending} onOpenTab={onOpenTab} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-[#ff5a4d]/30 bg-[#fff4f3] p-3 text-xs font-medium text-[#b42318]">
            <CircleAlert className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={speech.clearError} aria-label="Dismiss" className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {notice?.kind === "reply" && !listening && !live && (
          <div className="space-y-2">
            <Reply text={notice.text} />
            <HotelResults hotels={notice.hotels} onUse={onUseHotel} running={running} />
            {notice.confirm && onConfirm && (
              <div className="flex gap-2 pl-8">
                <button
                  type="button"
                  onClick={() => {
                    onDismissNotice?.();
                    onConfirm(true);
                  }}
                  className="rounded-full px-4 py-1.5 text-xs font-bold"
                  style={{ background: INK, color: LIME }}
                >
                  Yes, do it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDismissNotice?.();
                    onConfirm(false);
                  }}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-black/10 text-[#181c22]"
                >
                  No
                </button>
              </div>
            )}
            <Pending items={notice.pending} onOpenTab={onOpenTab} />
          </div>
        )}

        {notice && notice.kind !== "reply" && !listening && !live && (
          <div
            className={`rounded-2xl border p-3 text-xs ${
              notice.kind === "error"
                ? "border-[#ff5a4d]/30 bg-[#fff4f3] text-[#b42318]"
                : "border-black/10 bg-white text-[#181c22]"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="flex-1 font-semibold text-[13px]">
                {notice.kind === "error"
                  ? notice.text
                  : notice.kind === "no-editor"
                    ? "Open a trip in the Trip Builder to change it."
                    : notice.editing
                      ? "I didn't catch a change to make."
                      : "I didn't catch a trip request."}
              </span>
              <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className="shrink-0 opacity-60">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {notice.kind !== "error" && (
              <div className="mt-1 space-y-1.5">
                {notice.unrecognized?.length ? (
                  <Unrecognized items={notice.unrecognized} />
                ) : (
                  <p className="text-[#181c22]/55 break-words">Heard: “{notice.text}”</p>
                )}
                {notice.kind === "unknown" &&
                  (notice.editing ? (
                    <p className="text-[#181c22]/70">Try: {EDIT_EXAMPLES}.</p>
                  ) : (
                    <p className="text-[#181c22]/70">
                      Try something like:{" "}
                      <button
                        type="button"
                        onClick={() => setDraft(example)}
                        className="text-left font-medium text-[#181c22] underline decoration-[#e7f63c] decoration-2 underline-offset-2"
                      >
                        “{example}”
                      </button>
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: typed input (the only option when voice is unsupported) */}
      <div className="shrink-0 border-t border-black/5 bg-white px-3.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <form
          onSubmit={submitDraft}
          className="flex items-center gap-2 rounded-full border border-black/10 bg-white pl-4 pr-1.5 py-1 focus-within:border-[#181c22]"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={editor && !blank ? "Type a change, e.g. make Gulmarg 2 nights…" : "Type a trip request…"}
            autoFocus={!supported}
            disabled={running}
            enterKeyHint="send"
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] sm:text-sm text-[#181c22] placeholder:text-[#181c22]/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || running}
            className="grid place-items-center w-9 h-9 rounded-full bg-[#181c22] text-white shrink-0 disabled:opacity-30"
            aria-label="Send"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
