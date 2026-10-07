import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Clock,
  X,
  Mic,
  SendHorizontal,
  Settings2,
  CalendarDays,
  BedDouble,
  IndianRupee,
  LayoutTemplate,
  Check,
  FileText,
  Loader2,
  HelpCircle,
  EarOff,
  CircleDashed,
  Sparkles,
  MapPin,
  Car,
} from "lucide-react";
import worldRaw from "./world.svg?raw";
import AssistantFrame from "../../components/dashboard/AssistantFrame";
import TripBuilder from "../../components/dashboard/TripBuilder";
import { useChingEditor } from "../../utils/ching/editorBridge";
import { useChingBus, clearChingHistory, setChingUnderstanding } from "../../utils/ching/chingBus";

// The AI Trip Assistant: Ching's own workspace. Same design as before (world
// map card, greeting, waveform + mic, message box, destination card), now live:
// what Ching hears and says, the trip's route and build progress — and the
// real Trip Builder underneath, filling in as the agent speaks.
const world = worldRaw;

const LIME = "#e7f63c";
const INK = "#181c22";

// The builder's tabs, in the order a trip is built.
const TABS = [
  { tab: "Trip Info", icon: Settings2 },
  { tab: "Itinerary", icon: CalendarDays },
  { tab: "Logistics", icon: BedDouble },
  { tab: "Pricing", icon: IndianRupee },
  { tab: "Template", icon: LayoutTemplate },
];

const list = (v) => (Array.isArray(v) ? v : []);
const nightsOf = (a) => Math.max(0, Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000) || 0);
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (s) => {
  const [y, m, d] = String(s || "").slice(0, 10).split("-").map(Number);
  return y ? `${d} ${MONTHS[m - 1]} ${y}` : "";
};

/** "YYYY-MM-DD" + n days, in local calendar terms ("" without a start date). */
const dayYmd = (start, n) => {
  const [y, m, d] = String(start || "").slice(0, 10).split("-").map(Number);
  if (!y) return "";
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const ToolIcon = ({ icon, active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`grid place-items-center w-11 h-11 rounded-2xl border transition-colors ${
      active
        ? "border-[#181c22] text-[#181c22] bg-white shadow-sm"
        : "border-[#e6e6e6] text-[#181c22]/50 hover:text-[#181c22] hover:border-[#d0d0d0] bg-white"
    }`}
  >
    {React.createElement(icon, { className: "w-[18px] h-[18px]", strokeWidth: 1.8 })}
  </button>
);

// Lime voice waveform (mirrored bars) with a centered chip: what Ching hears.
const Waveform = ({ listening, interim }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!listening) return undefined;
    const iv = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(iv);
  }, [listening]);
  const bars = Array.from({ length: 34 }, (_, i) => {
    const t = Math.sin(i / 1.7 + (listening ? tick / 2 : 0)) * Math.cos(i / 5 - (listening ? tick / 5 : 0));
    return 8 + Math.abs(t) * 30 + (i % 3) * 4;
  });
  const chip = listening ? interim || "Listening…" : "Tap the mic and tell me the trip";
  return (
    <div className="relative flex items-center justify-center w-full max-w-[520px]">
      <div className="flex items-center gap-[3px] w-full justify-center">
        {bars.map((h, i) => (
          <span
            key={i}
            className="rounded-full transition-[height] duration-100"
            style={{
              width: 3,
              height: `${h}px`,
              background: LIME,
              opacity: i > 12 && i < 22 ? 0.25 : listening ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 max-w-[90%] px-4 py-1.5 rounded-full bg-white/90 backdrop-blur border border-black/5 text-xs font-medium text-[#181c22] shadow-sm truncate">
        {chip}
      </div>
    </div>
  );
};

/** Where the trip stands, step by step, from the builder's own state. */
function buildProgress(trip, stage, pdfAt) {
  const ti = trip?.tripInfo || {};
  const nights = Number(ti.duration) || 0;
  const days = list(trip?.itinerary);
  const stays = list(trip?.accommodations).filter((a) => !a.cancelled);
  const cabs = list(trip?.transportation);
  const hotelNights = stays.reduce((n, a) => n + nightsOf(a), 0);
  const steps = [
    { key: "Trip Info", label: "Trip info", detail: ti.clientName ? `${ti.clientName} · ${ti.adults || 0} adults` : "Client, guests, dates", done: !!(ti.clientName && ti.startDate && nights) },
    { key: "Itinerary", label: "Itinerary", detail: days.length ? `${days.length} days, a destination each` : "Destinations day by day", done: nights > 0 && days.length === nights + 1 && days.every((d) => d.location || d.destination) },
    { key: "Logistics", label: "Logistics", detail: stays.length ? `${hotelNights} hotel nights · ${cabs.length} cab days` : "Hotels, then transport, by date", done: nights > 0 && hotelNights === nights && (cabs.length > 0 || stays.length > 0) },
    { key: "Pricing", label: "Pricing", detail: Number(ti.cost) > 0 ? money(ti.cost) : "Totals, margin, GST", done: Number(ti.cost) > 0 },
    { key: "PDF", label: "PDF", detail: pdfAt ? "Generated" : "After pricing", done: !!pdfAt },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, pct: Math.round((done / steps.length) * 100), active: stage };
}


// How to say each missing piece — shown next to it, so the agent knows the words.
const SAY = {
  clientName: "for Atif Aslam",
  clientPhone: "phone 98765 43210",
  clientEmail: "email atif at gmail dot com",
  startDate: "from 10 November",
  duration: "4 nights",
  destination: "Kashmir trip",
  days: "day 1 arrival in Srinagar, day 2 Gulmarg…",
  dayCount: "make it 4 nights",
  hotels: "2 nights in Srinagar at Lalit",
  hotelGaps: "Gulmarg hotel Khyber",
  cab: "Innova for the whole trip",
  cabVehicle: "use Innova",
  title: "call it Kashmir Honeymoon",
};
const EXAMPLES = [
  "Family of four, three adults and the rest kids, for Atif Aslam from 10 November, 2 nights Srinagar at Lalit and 2 nights Gulmarg",
  "Day 1 arrival in Srinagar, day 2 Gulmarg, day 3 Pahalgam, day 4 departure, for Shah, 2 adults",
  "Sort the hotels",
  "Make it cheaper",
];
// "(picked for you)" / "(your usual)" in a change line = Ching chose it, nobody said it.
const pickedByChing = (line) => /\((?:picked for you|your usual|nothing under budget[^)]*|picked for \d+ guests)\)|remembered|from .*'s last trip/i.test(line);

const Section = ({ icon, title, tone, children }) => (
  <div>
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 ${tone}`}>
      {React.createElement(icon, { className: "w-3.5 h-3.5", strokeWidth: 2.2 })}
      {title}
    </div>
    <ul className="space-y-1">{children}</ul>
  </div>
);

/**
 * What Ching made of the request — grounded, like a citation: what it heard
 * from you, what it picked itself, what it needs you to decide, what it didn't
 * catch and what's still missing (with the words to say).
 */
const Understanding = ({ understanding, draft, listening, interim, onExample }) => {
  const u = understanding || {};
  const heard = list(u.changes);
  const questions = [...new Set([...list(draft?.blocking).map((c) => c.text), ...list(u.warnings)])];
  const missed = list(u.unrecognized);
  const pending = list(u.pending).filter((p) => p.level !== "recommended" || p.key === "cab");
  const empty = !heard.length && !questions.length && !missed.length && !pending.length;

  if (empty && !listening) {
    return (
      <div className="rounded-[18px] bg-[#f7f7f8] border border-black/5 p-3">
        <div className="text-[11px] font-semibold text-[#181c22]/50 mb-2">Try saying</div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onExample(e)}
              className="text-left text-[12px] leading-snug px-3 py-1.5 rounded-full bg-white border border-black/10 hover:border-[#181c22] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[18px] bg-[#f7f7f8] border border-black/5 p-3 space-y-3 max-h-[300px] overflow-y-auto" aria-live="polite">
      {listening && (
        <div className="flex items-center gap-2 text-[12px] text-[#181c22]/70">
          <span className="block w-2 h-2 rounded-full animate-pulse" style={{ background: LIME, boxShadow: `0 0 0 3px ${LIME}55` }} />
          <span className="truncate">{interim || "Listening…"}</span>
        </div>
      )}
      {heard.length > 0 && (
        <Section icon={Check} title={u.phase === "done" ? "Done" : "Picking up"} tone="text-[#181c22]">
          {heard.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
              <span className="mt-[5px] block w-1.5 h-1.5 rounded-full bg-[#181c22] shrink-0" />
              <span className="min-w-0">
                {line}
                <span
                  className={`ml-1.5 align-middle inline-block px-1.5 py-[1px] rounded-full text-[9.5px] font-bold uppercase tracking-wide ${
                    pickedByChing(line) ? "bg-[#e7f63c] text-[#181c22]" : "bg-white border border-black/10 text-[#181c22]/50"
                  }`}
                  title={pickedByChing(line) ? "Nobody said this — Ching chose it. Change it if it's not right." : "From what you said"}
                >
                  {pickedByChing(line) ? "Ching picked" : "you said"}
                </span>
              </span>
            </li>
          ))}
        </Section>
      )}
      {questions.length > 0 && (
        <Section icon={HelpCircle} title="Needs you" tone="text-amber-700">
          {questions.map((q, i) => (
            <li key={i} className="text-[12.5px] leading-snug text-[#181c22] bg-amber-50 border border-amber-200/70 rounded-xl px-2.5 py-1.5">
              {q}
            </li>
          ))}
        </Section>
      )}
      {missed.length > 0 && (
        <Section icon={EarOff} title="Didn't catch" tone="text-rose-700">
          {missed.map((m, i) => (
            <li key={i} className="text-[12.5px] leading-snug text-[#181c22]/80">
              “{m}” <span className="text-[#181c22]/45">— say it another way, e.g. “make Gulmarg 2 nights”</span>
            </li>
          ))}
        </Section>
      )}
      {pending.length > 0 && (
        <Section icon={CircleDashed} title="Still missing" tone="text-[#181c22]/50">
          {pending.map((p) => (
            <li key={p.key} className="text-[12.5px] leading-snug text-[#181c22]/75">
              {p.label}
              {SAY[p.key] && <span className="text-[#181c22]/45"> — say “{SAY[p.key]}”</span>}
            </li>
          ))}
        </Section>
      )}
    </div>
  );
};

const PREVIEW_TABS = ["Overview", "Day by day", "Hotels & cabs"];

const AIAssistant = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("trip");
  const draftKey = searchParams.get("d") || "";
  const editor = useChingEditor();
  const bus = useChingBus();
  const [message, setMessage] = useState("");
  const [trip, setTrip] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState("Trip Info");
  const [preview, setPreview] = useState("Overview");

  // The builder's state (and its pending voice draft), read a few times a second.
  useEffect(() => {
    const read = () => {
      try {
        setTrip(editor?.snapshot ? editor.snapshot() : null);
        setDraft(editor?.draft ? editor.draft() : null);
      } catch {
        setTrip(null);
        setDraft(null);
      }
    };
    read();
    const iv = setInterval(read, 400);
    return () => clearInterval(iv);
  }, [editor]);

  // While Ching walks the build, the highlighted tab follows it.
  const shownTab = bus.stage && TABS.some((t) => t.tab === bus.stage) ? bus.stage : tab;

  const ti = trip?.tripInfo || {};
  const nights = Number(ti.duration) || 0;
  // Route: consecutive stays in one city merged — "Srinagar 2N → Gulmarg 1N".
  const route = useMemo(() => {
    const out = [];
    list(trip?.accommodations)
      .filter((a) => !a.cancelled)
      .slice()
      .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))
      .forEach((a) => {
        const city = String(a.city || "").split(",")[0].trim();
        const last = out[out.length - 1];
        if (last && last.city === city) last.nights += nightsOf(a);
        else out.push({ city, nights: nightsOf(a) });
      });
    if (!out.length) {
      list(trip?.itinerary).forEach((d) => {
        const city = String(d.location || d.destination || "").trim();
        if (city && out[out.length - 1]?.city !== city) out.push({ city, nights: 0 });
      });
    }
    return out;
  }, [trip]);
  const progress = buildProgress(trip, bus.stage, bus.pdfAt);

  // The conversation scrolls to its newest line.
  const threadRef = useRef(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bus.history.length, bus.understanding]);

  const photo = list(trip?.itinerary).find((d) => d.photo)?.photo || list(trip?.accommodations).find((a) => a.photo)?.photo || "";
  const dest = ti.destination || route[0]?.city || "";
  const days = list(trip?.itinerary);
  const stays = list(trip?.accommodations).filter((a) => !a.cancelled).slice().sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
  const cabs = list(trip?.transportation).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const talk = () => window.dispatchEvent(new CustomEvent("ching:open", { detail: { listen: true } }));
  const submit = (text) => {
    const t = String(text || "").trim();
    if (!t) return;
    window.dispatchEvent(new CustomEvent("ching:submit", { detail: { text: t } }));
  };
  const send = (e) => {
    e?.preventDefault();
    submit(message);
    setMessage("");
  };
  const openTab = (t) => {
    setTab(t);
    try {
      editor?.setTab(t);
    } catch {
      // builder not ready yet
    }
  };
  const newChat = () => {
    clearChingHistory();
    setChingUnderstanding(null);
    navigate(`/assistant?d=${Date.now().toString(36)}`);
  };

  return (
    <AssistantFrame
      title={ti.tripTitle || "AI Trip Assistant"}
      nav={
        <>
          <button type="button" onClick={newChat} className="flex items-center gap-2 text-sm font-medium text-[#181c22] hover:opacity-70 transition-opacity">
            <Plus className="w-4 h-4" /> New Trip
          </button>
          <span className="flex items-center gap-2 text-sm font-medium text-[#181c22]/50">
            <Clock className="w-4 h-4" /> {bus.history.length} messages
          </span>
        </>
      }
    >
      <div className="h-full overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 p-4 sm:p-6">
          {/* ── LEFT: the conversation, what Ching picked up, and the composer ── */}
          <section className="flex flex-col rounded-[24px] bg-white border border-black/5 shadow-sm min-h-[640px] lg:h-[calc(100vh-150px)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-black/5">
              {TABS.map((t) => (
                <ToolIcon key={t.tab} icon={t.icon} label={t.tab} active={shownTab === t.tab} onClick={() => openTab(t.tab)} />
              ))}
              <span className="ml-auto text-[11px] font-medium text-[#181c22]/45 hidden sm:block">Conversation</span>
            </div>

            {/* thread */}
            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#181c22] text-[#e7f63c] shrink-0" style={{ boxShadow: `0 0 0 3px ${LIME}` }}>
                  <Sparkles className="w-4 h-4" />
                </span>
                <p className="text-[15px] leading-snug pt-1.5">
                  Hi! I'm <span className="font-semibold">Ching</span>. Tell me the trip in any order — who, how many, when, where and which hotels — and watch it build on the right. If I'm unsure of something, I'll ask instead of guessing.
                </p>
              </div>
              {bus.history.map((h, i) =>
                h.role === "you" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-[#181c22] text-white text-[13.5px] leading-snug">{h.text}</p>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-3">
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-[#181c22] text-[#e7f63c] shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <p className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tl-md bg-[#f3f3f4] text-[#181c22] text-[13.5px] leading-snug">{h.text}</p>
                  </div>
                ),
              )}
            </div>

            {/* what Ching made of it, then the composer */}
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-black/5 bg-white">
              <Understanding
                understanding={bus.understanding}
                draft={draft}
                listening={bus.listening}
                interim={bus.interim}
                onExample={(e) => submit(e)}
              />
              {bus.listening && (
                <div className="flex justify-center">
                  <Waveform listening interim={bus.interim} />
                </div>
              )}
              <form onSubmit={send} className="flex items-center gap-2 bg-white rounded-full border border-black/10 pl-2 pr-2 py-2 shadow-sm focus-within:border-[#181c22] transition-colors">
                <button
                  type="button"
                  onClick={talk}
                  aria-label="Talk to Ching"
                  className={`relative grid place-items-center w-10 h-10 rounded-full shrink-0 transition-colors ${
                    bus.listening ? "bg-[#e7f63c] text-[#181c22]" : "bg-[#f3f3f4] text-[#181c22] hover:bg-[#e7f63c]"
                  }`}
                >
                  {bus.listening && <span className="absolute inset-0 rounded-full bg-[#e7f63c] opacity-40 animate-ping" />}
                  <Mic className="relative w-[18px] h-[18px]" />
                </button>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#181c22] placeholder:text-[#181c22]/40"
                  placeholder="Type or tap the mic — e.g. family of four for Atif Aslam from 10 Nov…"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  aria-label="Send to Ching"
                  className="grid place-items-center w-10 h-10 rounded-full bg-[#181c22] text-white shrink-0 hover:bg-black transition-colors disabled:opacity-40"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </form>
            </div>
          </section>

          {/* ── RIGHT: the preview ───────────────────────────────────────── */}
          <aside className="rounded-[24px] bg-white border border-black/5 shadow-sm flex flex-col min-h-[640px] lg:h-[calc(100vh-150px)] overflow-hidden">
            <div className="flex items-center gap-1 px-4 pt-4 pb-3 border-b border-black/5">
              {PREVIEW_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPreview(t)}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${
                    preview === t ? "bg-[#181c22] text-white" : "text-[#181c22]/55 hover:text-[#181c22]"
                  }`}
                >
                  {t}
                </button>
              ))}
              <span className="ml-auto text-[11px] font-semibold tracking-tight">
                {Number(ti.cost) > 0 ? money(ti.cost) : nights ? `${nights}N / ${nights + 1}D` : ""}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {preview === "Overview" && (
                <>
                  <h2 className="text-[28px] leading-[1.1] font-light tracking-tight break-words">
                    {dest || "Your next trip"}
                    {ti.clientName && (
                      <>
                        <br />
                        <span className="text-[20px]">{ti.clientName}</span>
                      </>
                    )}
                  </h2>
                  <p className="text-[13px] leading-relaxed text-[#181c22]/70 mt-3">
                    {ti.clientName
                      ? `${ti.adults || 0} adult${Number(ti.adults) === 1 ? "" : "s"}${Number(ti.kids5to12) ? ` + ${ti.kids5to12} child${Number(ti.kids5to12) === 1 ? "" : "ren"}` : ""}${Number(ti.kidsUpto5) ? ` + ${ti.kidsUpto5} under 5` : ""}${ti.startDate && nights ? ` · ${shortDate(ti.startDate)}, ${nights}N/${nights + 1}D` : ""}`
                      : "Nothing yet — say or type the trip on the left."}
                  </p>

                  {/* World map card with the route */}
                  <div className="relative rounded-[20px] bg-[#f3f3f4] border border-black/5 p-4 mt-4 overflow-hidden">
                    <div className="worldmap w-full" dangerouslySetInnerHTML={{ __html: world }} />
                    {route.length > 0 && (
                      <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
                        {route.map((r, i) => (
                          <React.Fragment key={`${r.city}${i}`}>
                            {i > 0 && <span className="w-5 border-t border-dashed border-[#181c22]" />}
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur border border-black/5 text-[11px] font-semibold shadow-sm">
                              <span className="block w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? LIME : INK }} />
                              {r.city}
                              {r.nights > 0 && <span className="text-[#181c22]/50">{r.nights}N</span>}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>

                  {photo && <img src={photo} alt={dest} className="w-full h-[140px] object-cover rounded-[18px] mt-4" />}

                  {/* Build steps */}
                  <ol className="mt-5 space-y-2.5">
                    {progress.steps.map((st, i) => {
                      const active = progress.active === st.key;
                      return (
                        <li key={st.key}>
                          <button type="button" onClick={() => st.key !== "PDF" && openTab(st.key)} className="w-full flex items-center gap-3 text-left">
                            <span
                              className={`grid place-items-center w-7 h-7 rounded-full shrink-0 text-[11px] font-bold ${
                                st.done ? "bg-[#181c22] text-[#e7f63c]" : active ? "bg-[#e7f63c] text-[#181c22]" : "bg-white text-[#181c22]/50 border border-black/10"
                              }`}
                            >
                              {active && !st.done ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : st.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : st.key === "PDF" ? <FileText className="w-3.5 h-3.5" /> : i + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold">{st.label}</span>
                              <span className="block text-[11px] text-[#181c22]/55 truncate">{st.detail}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#f7f7f8] px-4 py-2.5" style={{ boxShadow: `0 0 0 1.5px ${LIME}` }}>
                    <span className="text-xs font-medium">
                      {progress.active ? `Building · ${progress.active === "PDF" ? "making the PDF" : progress.active}` : progress.pct === 100 ? "Trip ready" : draft && !draft.ok ? "Waiting for your answers" : "In progress"}
                    </span>
                    <span className="ml-auto text-lg font-semibold tracking-tight">{progress.pct}%</span>
                    {draftKey || tripId ? (
                      <button type="button" onClick={newChat} title="Start a new trip" className="grid place-items-center w-7 h-7 rounded-lg bg-white border border-black/10 text-[#181c22]/50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </>
              )}

              {preview === "Day by day" &&
                (days.length ? (
                  <ol className="space-y-2">
                    {days.map((d, i) => {
                      const ymd = dayYmd(ti.startDate, i);
                      const date = shortDate(ymd);
                      const cab = ymd ? cabs.find((c) => String(c.date).slice(0, 10) === ymd) : null;
                      return (
                        <li key={d.id || i} className="rounded-[16px] border border-black/5 bg-[#f7f7f8] px-4 py-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[13.5px] font-semibold">{d.title || `Day ${i + 1}`}</span>
                            <span className="ml-auto text-[11px] text-[#181c22]/45 shrink-0">{date}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[#181c22]/60">
                            {(d.location || d.destination) && (
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.location || d.destination}</span>
                            )}
                            {cab && (
                              <span className="flex items-center gap-1"><Car className="w-3 h-3" />{cab.vehicleType || "Cab"} · {cab.route || cab.tripType}</span>
                            )}
                          </div>
                          {list(d.activities).length > 0 && (
                            <p className="mt-1 text-[11.5px] text-[#181c22]/50 line-clamp-2">{list(d.activities).join(" · ")}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-[13px] text-[#181c22]/45">The day-wise plan appears here as soon as Ching knows the nights and places.</p>
                ))}

              {preview === "Hotels & cabs" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#181c22]/50 mb-2">Hotels</h3>
                    {stays.length ? (
                      <ul className="space-y-2">
                        {stays.map((a) => (
                          <li key={a.id} className="rounded-[16px] border border-black/5 bg-[#f7f7f8] px-4 py-3">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13.5px] font-semibold">{a.name || "Hotel to pick"}</span>
                              <span className="ml-auto text-[11px] text-[#181c22]/45 shrink-0">{nightsOf(a)}N</span>
                            </div>
                            <div className="mt-0.5 text-[11.5px] text-[#181c22]/60">
                              {a.city} · {a.category || "—"} · {a.roomType || "room"} · {shortDate(a.checkIn)} → {shortDate(a.checkOut)}
                              {Number(a.pricePerRoom) > 0 ? ` · ${money(a.pricePerRoom)}/night` : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-[#181c22]/45">No hotels yet.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#181c22]/50 mb-2">Cabs</h3>
                    {cabs.length ? (
                      <ul className="space-y-1.5">
                        {cabs.map((c) => (
                          <li key={c.id} className="flex items-baseline gap-2 text-[12.5px]">
                            <span className="text-[#181c22]/45 w-[70px] shrink-0">{shortDate(c.date)}</span>
                            <span className="font-medium">{c.vehicleType || "Cab"}</span>
                            <span className="text-[#181c22]/60 truncate">{c.route || c.tripType}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-[#181c22]/45">No cabs yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* ── The live Trip Builder: Ching fills it while you talk ─────── */}
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="block w-2 h-2 rounded-full" style={{ background: LIME, boxShadow: `0 0 0 4px ${LIME}44` }} />
            <h3 className="text-lg font-medium">Live trip builder</h3>
            <span className="text-[12px] text-[#181c22]/50">fills in as you speak — check it, then Confirm &amp; Build in Ching</span>
          </div>
          <div className="h-[86vh] min-h-[620px]">
            <TripBuilder key={tripId || draftKey || "assistant"} embedded embeddedTripId={tripId} />
          </div>
        </div>
      </div>
    </AssistantFrame>
  );
};

export default AIAssistant;
