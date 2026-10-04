import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Clock,
  X,
  Mic,
  SendHorizontal,
  Link2,
  Settings2,
  CalendarDays,
  BedDouble,
  IndianRupee,
  LayoutTemplate,
  Check,
  FileText,
  Loader2,
} from "lucide-react";
import worldRaw from "./world.svg?raw";
import AssistantFrame from "../../components/dashboard/AssistantFrame";
import TripBuilder from "../../components/dashboard/TripBuilder";
import { useChingEditor } from "../../utils/ching/editorBridge";
import { useChingBus, clearChingHistory } from "../../utils/ching/chingBus";

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

const AIAssistant = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("trip");
  const draft = searchParams.get("d") || "";
  const editor = useChingEditor();
  const bus = useChingBus();
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [trip, setTrip] = useState(null);
  const [tab, setTab] = useState("Trip Info");

  // The builder's state, read a few times a second while it's on screen.
  useEffect(() => {
    const read = () => {
      try {
        setTrip(editor?.snapshot ? editor.snapshot() : null);
      } catch {
        setTrip(null);
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

  // Bring the live builder into view when Ching starts filling it, and when
  // the Confirm & Build walkthrough starts — that's the part to watch.
  const builderRef = useRef(null);
  const hadRoute = useRef(false);
  useEffect(() => {
    const has = route.length > 0;
    if (has && !hadRoute.current) builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    hadRoute.current = has;
  }, [route.length]);
  useEffect(() => {
    if (bus.stage === "Trip Info") builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [bus.stage]);
  const lastReply = [...bus.history].reverse().find((h) => h.role === "ching");
  const photo = list(trip?.itinerary).find((d) => d.photo)?.photo || list(trip?.accommodations).find((a) => a.photo)?.photo || "";
  const dest = ti.destination || route[0]?.city || "";

  const talk = () => window.dispatchEvent(new CustomEvent("ching:open", { detail: { listen: true } }));
  const send = (e) => {
    e?.preventDefault();
    const text = message.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent("ching:submit", { detail: { text } }));
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
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${showHistory ? "text-[#181c22]" : "text-[#181c22]/50 hover:text-[#181c22]"}`}
          >
            <Clock className="w-4 h-4" /> History
          </button>
        </>
      }
    >
      <div className="h-full overflow-y-auto">
        {/* two columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-6 p-6">
          {/* ── LEFT column ─────────────────────────────────────── */}
          <section className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              {TABS.map((t) => (
                <ToolIcon key={t.tab} icon={t.icon} label={t.tab} active={shownTab === t.tab} onClick={() => openTab(t.tab)} />
              ))}
            </div>

            {/* World Map card: India, and the trip's route on it */}
            <div className="relative rounded-[24px] bg-[#f3f3f4] border border-black/5 p-5 overflow-hidden">
              <div className="relative w-full">
                <div className="worldmap w-full" dangerouslySetInnerHTML={{ __html: world }} />
                {route.length > 0 && (
                  <div className="absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
                    {route.map((r, i) => (
                      <React.Fragment key={`${r.city}${i}`}>
                        {i > 0 && <span className="w-5 border-t border-dashed border-[#181c22]" />}
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur border border-black/5 text-[11px] font-semibold shadow-sm">
                          <span className="block w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? LIME : INK, boxShadow: i === 0 ? `0 0 0 3px ${LIME}44` : "none" }} />
                          {r.city}
                          {r.nights > 0 && <span className="text-[#181c22]/50">{r.nights}N</span>}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {nights > 0 && (
                  <div className="absolute top-1 left-1 flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-full bg-[#181c22] text-white text-[11px] font-medium shadow-lg">Trip length</span>
                    <span className="px-2.5 py-1.5 rounded-full bg-[#e7e7e7] text-[#181c22] text-[11px] font-semibold">
                      {nights}N / {nights + 1}D
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-lg font-medium">{route.length ? "Your route" : "World Map"}</div>
            </div>

            {/* Ching: the greeting, then its latest reply */}
            <div className="flex items-start gap-4 mt-6">
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
                alt="Ching, your AI travel assistant"
                className="w-14 h-14 rounded-full object-cover shrink-0"
                style={{ boxShadow: `0 0 0 3px ${LIME}` }}
              />
              {lastReply ? (
                <p className="text-[22px] leading-[1.3] font-light tracking-tight" aria-live="polite">
                  {lastReply.text}
                </p>
              ) : (
                <p className="text-[26px] leading-[1.25] font-light tracking-tight">
                  Hi there! I'm <span className="font-semibold">Ching, your AI travel assistant</span>:{" "}
                  <span className="font-semibold">tell me the trip</span> and watch it{" "}
                  <span className="font-semibold">build itself below!</span>
                </p>
              )}
            </div>

            {showHistory && (
              <div className="mt-5 rounded-[20px] bg-white border border-black/5 p-4 max-h-[260px] overflow-y-auto space-y-2">
                {bus.history.length === 0 ? (
                  <p className="text-[13px] text-[#181c22]/45">Nothing yet — talk to Ching and the conversation shows up here.</p>
                ) : (
                  bus.history.map((h, i) => (
                    <div key={i} className={`flex ${h.role === "you" ? "justify-end" : "justify-start"}`}>
                      <p
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${
                          h.role === "you" ? "bg-[#181c22] text-white rounded-br-sm" : "bg-[#f3f3f4] text-[#181c22] rounded-bl-sm"
                        }`}
                      >
                        {h.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* waveform + mic */}
            <div className="flex flex-col items-center gap-6 mt-8 mb-6">
              <Waveform listening={bus.listening} interim={bus.interim} />
              <button
                type="button"
                onClick={talk}
                aria-label="Talk to Ching"
                className={`relative grid place-items-center w-14 h-14 rounded-full shadow-xl hover:scale-105 transition-transform ${
                  bus.listening ? "bg-[#e7f63c] text-[#181c22]" : "bg-[#181c22] text-white"
                }`}
              >
                {bus.listening && <span className="absolute inset-0 rounded-full bg-[#e7f63c] opacity-40 animate-ping" />}
                <Mic className="relative w-5 h-5" />
              </button>
            </div>

            {/* input */}
            <form onSubmit={send} className="mt-auto flex items-center gap-3 bg-white rounded-full border border-black/10 pl-5 pr-2 py-2 shadow-sm">
              <Link2 className="w-4 h-4 text-[#181c22]/40 shrink-0" />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#181c22] placeholder:text-[#181c22]/40"
                placeholder="e.g. 5 day Kashmir trip for Rahul Sharma, 2 adults, from 10 November…"
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
          </section>

          {/* ── RIGHT column: the trip, and how far it's built ─────────── */}
          <aside className="rounded-[24px] bg-white border border-black/5 p-6 flex flex-col shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[30px] leading-[1.1] font-light tracking-tight break-words min-w-0">
                {dest || "Your next trip"}
                {ti.clientName && (
                  <>
                    <br />
                    <span className="text-[22px]">{ti.clientName}</span>
                  </>
                )}
              </h2>
              <div className="text-right shrink-0 pt-1">
                <div className="text-[11px] text-[#181c22]/50">{Number(ti.cost) > 0 ? "total" : "nights"}</div>
                <div className="text-2xl font-semibold tracking-tight">{Number(ti.cost) > 0 ? money(ti.cost) : nights || "—"}</div>
              </div>
            </div>

            {photo ? (
              <img src={photo} alt={dest} className="w-full h-[150px] object-cover rounded-[18px] mt-5" />
            ) : (
              <div className="w-full h-[150px] rounded-[18px] mt-5 bg-[#f3f3f4] grid place-items-center text-[12px] text-[#181c22]/40">
                The destination's photo appears here
              </div>
            )}

            <p className="text-[13px] leading-relaxed text-[#181c22]/70 mt-5">
              {ti.clientName
                ? `${ti.clientName} · ${ti.adults || 0} adult${Number(ti.adults) === 1 ? "" : "s"}${Number(ti.kids5to12) ? ` + ${ti.kids5to12} child${Number(ti.kids5to12) === 1 ? "" : "ren"}` : ""}${Number(ti.kidsUpto5) ? ` + ${ti.kidsUpto5} under 5` : ""}${ti.startDate && nights ? ` · ${shortDate(ti.startDate)}, ${nights}N/${nights + 1}D` : ""}${route.length ? ` · ${route.map((r) => (r.nights ? `${r.city} ${r.nights}N` : r.city)).join(" → ")}` : ""}.`
                : "Say or type the trip: who's travelling, when, for how many nights and where. Ching fills Trip Info, then the day-wise itinerary, then hotels and transport by date, then pricing — and makes the PDF."}
            </p>

            <h3 className="text-lg font-medium mt-6">
              {route.length ? `${route.length} destination${route.length === 1 ? "" : "s"}` : "Build steps"}
            </h3>

            {/* Build steps (the old mini-map box) */}
            <div className="relative mt-3 flex-1 min-h-[260px] rounded-[20px] bg-[#f3f3f4] border border-black/5 overflow-hidden p-4 pb-20">
              <ol className="space-y-2.5">
                {progress.steps.map((s, i) => {
                  const active = progress.active === s.key || (progress.active === "PDF" && s.key === "PDF");
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => s.key !== "PDF" && openTab(s.key)}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        <span
                          className={`grid place-items-center w-7 h-7 rounded-full shrink-0 text-[11px] font-bold ${
                            s.done ? "bg-[#181c22] text-[#e7f63c]" : active ? "bg-[#e7f63c] text-[#181c22]" : "bg-white text-[#181c22]/50 border border-black/10"
                          }`}
                        >
                          {active && !s.done ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : s.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.key === "PDF" ? <FileText className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold">{s.label}</span>
                          <span className="block text-[11px] text-[#181c22]/55 truncate">{s.detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* progress card */}
              <div
                className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3 rounded-[16px] bg-white/80 backdrop-blur border border-black/5 px-4 py-3 shadow-lg"
                style={{ boxShadow: `0 0 0 1.5px ${LIME}, 0 12px 30px -12px rgba(0,0,0,.35)` }}
              >
                <span className="text-xs font-medium text-[#181c22]">
                  {progress.active ? `Building · ${progress.active === "PDF" ? "making the PDF" : progress.active}` : progress.pct === 100 ? "Trip ready" : "Preparing the result"}
                </span>
                <span className="ml-auto text-lg font-semibold tracking-tight">{progress.pct}%</span>
                {draft || tripId ? (
                  <button
                    type="button"
                    onClick={newChat}
                    title="Start a new trip"
                    className="grid place-items-center w-7 h-7 rounded-lg bg-white border border-black/10 text-[#181c22]/50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {/* ── The live Trip Builder: Ching fills it while you talk ─────── */}
        <div ref={builderRef} className="px-6 pb-6 scroll-mt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="block w-2 h-2 rounded-full" style={{ background: LIME, boxShadow: `0 0 0 4px ${LIME}44` }} />
            <h3 className="text-lg font-medium">Live trip builder</h3>
            <span className="text-[12px] text-[#181c22]/50">fills in as you speak — check it, then Confirm &amp; Build in Ching</span>
          </div>
          <div className="h-[86vh] min-h-[620px]">
            <TripBuilder key={tripId || draft || "assistant"} embedded embeddedTripId={tripId} />
          </div>
        </div>
      </div>
    </AssistantFrame>
  );
};

export default AIAssistant;
