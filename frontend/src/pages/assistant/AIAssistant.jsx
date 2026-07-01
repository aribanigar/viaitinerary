import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  Calendar,
  Search,
  Users,
  Settings,
  Bell,
  Plus,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Mic,
  SendHorizontal,
  Link2,
  Layers,
  Filter,
  Minus,
  Workflow,
  Tag,
  Pencil,
  Aperture,
} from "lucide-react";
import worldRaw from "./world.svg?raw";
import usRaw from "./us.svg?raw";

// ── Exact replica of the "AI travel assistant" reference, built on the brand
// CSS (Manrope, monochrome base, lime accent, 20px+ radii). Static design piece.
const world = worldRaw;
const usZoom = usRaw
  .replace(/viewBox="[^"]*"/, 'viewBox="72 322 210 178"')
  .replace(/<svg /, '<svg preserveAspectRatio="xMidYMid slice" ');

const LIME = "#c7f135";
const INK = "#10182a";

// Black aperture brand mark used in the reference (top-left / rail).
const Mark = ({ className = "" }) => (
  <span
    className={`grid place-items-center rounded-full bg-[#10182a] ${className}`}
  >
    <Aperture className="w-[60%] h-[60%] text-white" strokeWidth={2.2} />
  </span>
);

const RailIcon = ({ icon: Icon, active, to }) => {
  const cls = `grid place-items-center w-11 h-11 rounded-2xl transition-colors ${
    active
      ? "bg-[#10182a] text-white shadow-md"
      : "text-[#10182a]/50 hover:text-[#10182a] hover:bg-black/5"
  }`;
  const inner = <Icon className="w-[18px] h-[18px]" strokeWidth={2} />;
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button className={cls}>{inner}</button>
  );
};

const ToolIcon = ({ icon: Icon, active }) => (
  <button
    className={`grid place-items-center w-11 h-11 rounded-2xl border transition-colors ${
      active
        ? "border-[#10182a] text-[#10182a] bg-white shadow-sm"
        : "border-[#e6e6e6] text-[#10182a]/50 hover:text-[#10182a] hover:border-[#d0d0d0] bg-white"
    }`}
  >
    <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
  </button>
);

// Lime voice waveform (mirrored bars) with a centered "Listen to You…" chip.
const Waveform = () => {
  const bars = Array.from({ length: 34 }, (_, i) => {
    const t = Math.sin(i / 1.7) * Math.cos(i / 5);
    return 8 + Math.abs(t) * 30 + (i % 3) * 4;
  });
  return (
    <div className="relative flex items-center justify-center w-full max-w-[520px]">
      <div className="flex items-center gap-[3px] w-full justify-center">
        {bars.map((h, i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 3,
              height: `${h}px`,
              background: LIME,
              opacity: i > 12 && i < 22 ? 0.25 : 0.9,
            }}
          />
        ))}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur border border-black/5 text-xs font-medium text-[#10182a] shadow-sm">
        Listen to You…
      </div>
    </div>
  );
};

const AIAssistant = () => {
  const [message, setMessage] = useState(
    "I want to make a trip to the Grand Canyon from France",
  );

  return (
    <div className="min-h-screen w-full bg-[#f0f0f1] text-[#10182a] font-sans antialiased flex">
      {/* ── Left icon rail ─────────────────────────────────────────── */}
      <aside className="w-[80px] shrink-0 flex flex-col items-center py-6">
        <Mark className="w-8 h-8" />
        <div className="mt-10 flex flex-col items-center gap-1.5 bg-white rounded-[26px] p-2 border border-black/5 shadow-sm">
          <RailIcon icon={Home} to="/dashboard" />
          <RailIcon icon={Calendar} to="/my-trips" />
          <RailIcon icon={Search} active />
          <RailIcon icon={Users} to="/team" />
          <RailIcon icon={Settings} to="/settings" />
        </div>
        <div className="mt-auto flex flex-col items-center gap-4">
          <button className="relative grid place-items-center w-11 h-11 rounded-2xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm">
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#ff5a4d] ring-2 ring-white" />
          </button>
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop"
            alt="You"
            className="w-11 h-11 rounded-2xl object-cover border border-black/5 shadow-sm"
          />
        </div>
      </aside>

      {/* ── Main rounded surface ───────────────────────────────────── */}
      <main className="flex-1 my-4 mr-4 rounded-[28px] bg-[#fbfbfb] border border-black/5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
        {/* top bar */}
        <header className="flex items-center gap-8 px-8 pt-6 pb-4 border-b border-black/5">
          <div className="flex items-center gap-2 pr-6">
            <Sparkles className="w-4 h-4" style={{ color: LIME }} fill={LIME} />
            <span className="text-[15px] font-semibold tracking-tight">
              Trip to the Grand Canyon
            </span>
          </div>
          <button className="flex items-center gap-2 text-sm font-medium text-[#10182a] hover:opacity-70 transition-opacity">
            <Plus className="w-4 h-4" /> New Chat
          </button>
          <button className="flex items-center gap-2 text-sm font-medium text-[#10182a]/50 hover:text-[#10182a] transition-colors">
            <Clock className="w-4 h-4" /> History
          </button>
        </header>

        {/* two columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-6 p-6">
          {/* ── LEFT column ─────────────────────────────────────── */}
          <section className="flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <ToolIcon icon={Workflow} active />
              <ToolIcon icon={Tag} />
              <ToolIcon icon={Pencil} />
              <ToolIcon icon={Layers} />
              <ToolIcon icon={Filter} />
            </div>

            {/* World Map card */}
            <div className="relative rounded-[24px] bg-[#f3f3f4] border border-black/5 p-5 overflow-hidden">
              <div className="absolute top-4 right-4 z-20 flex gap-2">
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm hover:text-[#10182a]">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm hover:text-[#10182a]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full">
                <div
                  className="worldmap w-full"
                  dangerouslySetInnerHTML={{ __html: world }}
                />
                {/* route overlay */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 65"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M17.5,27 C28,15 40,14 49,22"
                    fill="none"
                    stroke={INK}
                    strokeWidth="0.5"
                    strokeDasharray="1.4 1.1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {/* endpoint labels + dots */}
                <div
                  className="absolute"
                  style={{ left: "17.5%", top: "42%", transform: "translate(-50%,-50%)" }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold">
                    Arizona, USA
                  </span>
                  <span className="block w-5 h-5 rounded-full" style={{ background: LIME, boxShadow: `0 0 0 6px ${LIME}44` }} />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#10182a]" />
                </div>
                <div
                  className="absolute"
                  style={{ left: "49%", top: "34%", transform: "translate(-50%,-50%)" }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold">
                    Paris, France
                  </span>
                  <span className="block w-2.5 h-2.5 rounded-full bg-[#10182a] ring-4 ring-white" />
                </div>
                {/* transit pill */}
                <div
                  className="absolute flex items-center gap-2"
                  style={{ left: "33%", top: "52%", transform: "translate(-50%,-50%)" }}
                >
                  <span className="px-3 py-1.5 rounded-full bg-[#10182a] text-white text-[11px] font-medium shadow-lg">
                    Time in transit
                  </span>
                  <span className="px-2.5 py-1.5 rounded-full bg-[#e7e7e7] text-[#10182a] text-[11px] font-semibold">
                    15h
                  </span>
                </div>
              </div>

              <div className="mt-2 text-lg font-medium">World Map</div>
            </div>

            {/* AI greeting */}
            <div className="flex items-start gap-4 mt-6">
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
                alt="AI assistant"
                className="w-14 h-14 rounded-full object-cover shrink-0"
                style={{ boxShadow: `0 0 0 3px ${LIME}` }}
              />
              <p className="text-[26px] leading-[1.25] font-light tracking-tight">
                Hi there! I'm <span className="font-semibold">your AI travel assistant</span>:{" "}
                <span className="font-semibold">Discover</span> the world with{" "}
                <span className="font-semibold">new possibilities!</span>
              </p>
            </div>

            {/* waveform + mic */}
            <div className="flex flex-col items-center gap-6 mt-8 mb-2">
              <Waveform />
              <button className="grid place-items-center w-14 h-14 rounded-full bg-[#10182a] text-white shadow-xl hover:scale-105 transition-transform">
                <Mic className="w-5 h-5" />
              </button>
            </div>

            {/* input */}
            <div className="mt-auto flex items-center gap-3 bg-white rounded-full border border-black/10 pl-5 pr-2 py-2 shadow-sm">
              <Link2 className="w-4 h-4 text-[#10182a]/40 shrink-0" />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-[#10182a] placeholder:text-[#10182a]/40"
                placeholder="Ask your AI travel assistant…"
              />
              <button className="grid place-items-center w-10 h-10 rounded-full bg-[#10182a] text-white shrink-0 hover:bg-black transition-colors">
                <SendHorizontal className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* ── RIGHT column ────────────────────────────────────── */}
          <aside className="rounded-[24px] bg-white border border-black/5 p-6 flex flex-col shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[30px] leading-[1.1] font-light tracking-tight">
                Grand Canyon,
                <br />
                Arizona, USA
              </h2>
              <div className="text-right shrink-0 pt-1">
                <div className="text-[11px] text-[#10182a]/50">miles</div>
                <div className="text-2xl font-semibold tracking-tight">392</div>
              </div>
            </div>

            <img
              src="https://images.unsplash.com/photo-1615551043360-33de8b5f410c?q=80&w=900&auto=format&fit=crop"
              alt="Grand Canyon"
              className="w-full h-[150px] object-cover rounded-[18px] mt-5"
            />

            <p className="text-[13px] leading-relaxed text-[#10182a]/70 mt-5">
              The Grand Canyon is a vast gorge carved by the Colorado River over
              millions of years. Located in Arizona, USA, it is renowned for its
              immense size and colorful layers of rock that reveal Earth's
              geological history. The canyon is part of Grand Canyon National Park
              and is recognized as one of the natural wonders of the world.
            </p>

            <h3 className="text-lg font-medium mt-6">4 destinations</h3>

            {/* Arizona mini-map */}
            <div className="relative mt-3 flex-1 min-h-[220px] rounded-[20px] bg-[#f3f3f4] border border-black/5 overflow-hidden">
              <div className="absolute top-3 left-3 z-20 flex gap-2">
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm">
                  <Layers className="w-4 h-4" />
                </button>
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a]/60 shadow-sm">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-3 right-3 z-20 flex gap-2">
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a] shadow-sm">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#10182a] shadow-sm">
                  <Minus className="w-4 h-4" />
                </button>
              </div>

              <div
                className="usmap absolute inset-0 w-full h-full"
                dangerouslySetInnerHTML={{ __html: usZoom }}
              />
              <span className="absolute left-[16%] top-[34%] text-[11px] font-medium text-[#10182a]/60">
                California
              </span>
              <span className="absolute left-[41%] -translate-x-1/2 top-[70%] text-[12px] font-semibold text-[#10182a]">
                Arizona
              </span>
              <span className="absolute right-[8%] top-[34%] text-[11px] font-medium text-[#10182a]/60">
                New Mexico
              </span>

              {/* progress card */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3 rounded-[16px] bg-white/80 backdrop-blur border border-black/5 px-4 py-3 shadow-lg"
                style={{ boxShadow: `0 0 0 1.5px ${LIME}, 0 12px 30px -12px rgba(0,0,0,.35)` }}
              >
                <span className="text-xs font-medium text-[#10182a]">
                  Preparing the result
                </span>
                <span className="ml-auto text-lg font-semibold tracking-tight">
                  63%
                </span>
                <button className="grid place-items-center w-7 h-7 rounded-lg bg-white border border-black/10 text-[#10182a]/50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default AIAssistant;
