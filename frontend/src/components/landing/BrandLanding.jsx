import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ShieldCheck, Users, Headphones, Mic, Pencil, FileText, Hand } from "lucide-react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Seo from "./Seo";
import { softwareSchema, faqSchema } from "./schema";
import {
  MODULES,
  FEATURE_GROUPS,
  STEPS,
  AUDIENCES,
  TRUST_PILLARS,
  FAQS,
  VOICE,
} from "./siteContent";

// Home page. Layout follows a compact B2B SaaS pattern: hero with product
// preview, module tabs, workflow, full feature grid, audiences, trust, FAQ, CTA.
// Product previews are lightweight HTML mocks of the real screens (sample data).

const Section = ({ id, className = "", children }) => (
  <section id={id} className={`px-4 sm:px-6 py-16 md:py-20 scroll-mt-16 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const SectionHead = ({ title, text, center = false }) => (
  <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
    <h2 className="text-[28px] md:text-[34px] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink">
      {title}
    </h2>
    {text && <p className="mt-3 text-[16px] leading-relaxed text-[#5e5e5e]">{text}</p>}
  </div>
);

/* ── Product preview mocks ─────────────────────────────────────────────── */

const Frame = ({ label, children }) => (
  <div className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)] overflow-hidden">
    <div className="h-9 px-4 flex items-center gap-1.5 border-b border-black/[0.06] bg-[#fafafa]">
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
      <span className="ml-3 text-[11px] text-[#7e7576]">{label}</span>
    </div>
    <div className="p-4 sm:p-5 text-[13px] text-ink">{children}</div>
  </div>
);

const Pill = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-black/[0.05] text-[#4c4546]",
    lime: "bg-accent text-ink",
    dark: "bg-brand text-white",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};

const LeadsPreview = () => (
  <Frame label="Lead inquiries">
    <div className="flex items-center justify-between mb-3">
      <span className="font-semibold">Today</span>
      <Pill>12 open</Pill>
    </div>
    <div className="divide-y divide-black/[0.06]">
      {[
        ["Rahul Mehta", "Kashmir, 6N / 4 pax", "Website", "New", "lime"],
        ["Sana Qureshi", "Ladakh, 7N / 2 pax", "WhatsApp", "Quoted", "gray"],
        ["Arjun Nair", "Gulmarg, 3N / 5 pax", "Referral", "Follow-up", "gray"],
        ["Priya Shah", "Pahalgam, 4N / 2 pax", "Instagram", "Confirmed", "dark"],
      ].map(([name, trip, src, status, tone]) => (
        <div key={name} className="py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-black/[0.05] flex items-center justify-center text-[11px] font-semibold shrink-0">
            {name.split(" ").map((p) => p[0]).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{name}</div>
            <div className="text-[12px] text-[#7e7576] truncate">{trip} &middot; {src}</div>
          </div>
          <Pill tone={tone}>{status}</Pill>
        </div>
      ))}
    </div>
  </Frame>
);

const ItineraryPreview = () => (
  <Frame label="Trip builder">
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="font-semibold">Kashmir Valley Escape</div>
        <div className="text-[12px] text-[#7e7576]">6 nights &middot; 2 adults</div>
      </div>
      <Pill tone="lime">Draft</Pill>
    </div>
    <div className="space-y-2">
      {[
        ["Day 1", "Arrive Srinagar, Dal Lake shikara ride", "Houseboat, Deluxe"],
        ["Day 2", "Gulmarg day trip, Gondola Phase 1", "Sedan, full day"],
        ["Day 3", "Transfer to Pahalgam via Awantipora", "Hotel, CP plan"],
      ].map(([d, t, s]) => (
        <div key={d} className="flex gap-3 p-2.5 rounded-lg bg-[#fafafa] border border-black/[0.05]">
          <span className="text-[11px] font-semibold text-[#7e7576] w-10 shrink-0 pt-0.5">{d}</span>
          <div className="min-w-0">
            <div className="font-medium truncate">{t}</div>
            <div className="text-[12px] text-[#7e7576]">{s}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-3 border-t border-black/[0.06] flex justify-between items-baseline">
      <span className="text-[#7e7576]">Package total</span>
      <span className="text-[17px] font-semibold">&#8377;58,400</span>
    </div>
  </Frame>
);

const PackagesPreview = () => (
  <Frame label="Packages">
    <div className="grid grid-cols-2 gap-2.5">
      {[
        ["Honeymoon in Kashmir", "5N", "₹42,000"],
        ["Ladakh Bike Expedition", "8N", "₹61,500"],
        ["Family Gulmarg Snow", "4N", "₹36,800"],
        ["Pahalgam Weekend", "2N", "₹14,900"],
      ].map(([n, d, p]) => (
        <div key={n} className="p-3 rounded-lg border border-black/[0.07]">
          <div className="font-medium leading-snug">{n}</div>
          <div className="mt-2 flex justify-between text-[12px] text-[#7e7576]">
            <span>{d}</span>
            <span className="text-ink font-semibold">{p}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-brand text-white">
      <span className="text-[12px]">Quote PDF ready for Rahul Mehta</span>
      <span className="text-[11px] font-semibold text-accent">Send</span>
    </div>
  </Frame>
);

const InventoryPreview = () => (
  <Frame label="Accommodation">
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 items-center">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7e7576]">Hotel</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7e7576]">Room</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7e7576] text-right">Rate</span>
      {[
        ["Lake View Houseboat", "Deluxe", "₹6,500"],
        ["Pine Ridge Resort, Gulmarg", "Super Deluxe", "₹9,200"],
        ["River Bend, Pahalgam", "Deluxe", "₹5,800"],
        ["Sedan, Srinagar local", "Per day", "₹3,000"],
      ].map(([h, r, p]) => (
        <React.Fragment key={h}>
          <span className="font-medium truncate">{h}</span>
          <span className="text-[#5e5e5e]">{r}</span>
          <span className="font-semibold text-right">{p}</span>
        </React.Fragment>
      ))}
    </div>
    <div className="mt-4 grid grid-cols-7 gap-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className={`h-6 rounded ${[2, 3, 4, 9, 10].includes(i) ? "bg-brand" : i === 6 ? "bg-accent" : "bg-black/[0.05]"}`}
        />
      ))}
    </div>
  </Frame>
);

const PaymentsPreview = () => (
  <Frame label="Booking ledger">
    <div className="flex items-baseline justify-between">
      <span className="font-semibold">Booking VI-2041</span>
      <Pill tone="lime">Part paid</Pill>
    </div>
    <div className="mt-3 h-2 rounded-full bg-black/[0.06] overflow-hidden">
      <div className="h-full w-[60%] bg-brand" />
    </div>
    <div className="mt-2 flex justify-between text-[12px] text-[#7e7576]">
      <span>Received &#8377;35,000</span>
      <span>Balance &#8377;23,400</span>
    </div>
    <div className="mt-4 divide-y divide-black/[0.06]">
      {[
        ["Advance, UPI", "12 Sep", "+₹20,000"],
        ["Second instalment", "20 Sep", "+₹15,000"],
        ["Hotel voucher issued", "21 Sep", "Sent"],
      ].map(([a, d, v]) => (
        <div key={a} className="py-2 flex justify-between">
          <span>{a} <span className="text-[#7e7576]">&middot; {d}</span></span>
          <span className="font-semibold">{v}</span>
        </div>
      ))}
    </div>
  </Frame>
);

const ReportsPreview = () => (
  <Frame label="Team report">
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        ["Leads", "148"],
        ["Quoted", "96"],
        ["Confirmed", "41"],
      ].map(([l, v]) => (
        <div key={l} className="p-2.5 rounded-lg bg-[#fafafa] border border-black/[0.05]">
          <div className="text-[11px] text-[#7e7576]">{l}</div>
          <div className="text-[18px] font-semibold">{v}</div>
        </div>
      ))}
    </div>
    {[
      ["Aamir", 82],
      ["Nisha", 64],
      ["Faizan", 47],
    ].map(([n, w]) => (
      <div key={n} className="flex items-center gap-3 py-1.5">
        <span className="w-14 text-[12px] text-[#5e5e5e]">{n}</span>
        <div className="flex-1 h-2 rounded-full bg-black/[0.06] overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${w}%` }} />
        </div>
        <span className="w-8 text-right text-[12px] font-semibold">{w}%</span>
      </div>
    ))}
  </Frame>
);

const PREVIEWS = {
  leads: LeadsPreview,
  itinerary: ItineraryPreview,
  packages: PackagesPreview,
  inventory: InventoryPreview,
  payments: PaymentsPreview,
  reports: ReportsPreview,
};

/* ── Sections ──────────────────────────────────────────────────────────── */

const Hero = () => (
  <section className="px-4 sm:px-6 pt-28 md:pt-32 pb-14 md:pb-20">
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
      <div>
        <h1 className="text-[36px] sm:text-[44px] lg:text-[52px] leading-[1.06] font-extrabold tracking-[-0.03em] text-ink">
          Quote faster. Book more trips. Get paid on time.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-[#5e5e5e] max-w-xl">
          Your leads, itineraries, quotes and payments, all in one place. Build a priced trip in minutes from
          your own hotel and cab rates, send a branded PDF and collect the advance. No spreadsheets, no missed
          follow-ups.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup" className="btn-primary !h-11 !px-5">
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/schedule-demo" className="btn-secondary !h-11 !px-5">
            Book a Free Demo
          </Link>
        </div>
        <a
          href="#voice"
          className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-accent pl-1.5 pr-4 py-1.5 text-[13px] font-medium text-ink hover:bg-accent-hover transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-accent" />
          </span>
          Newly launched: say the trip, it builds itself
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[#5e5e5e]">
          {["Free trial to start", "Works on phone & desktop", "Your logo on every PDF"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <Check className="w-4 h-4 text-ink" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative isolate">
        <div className="absolute -inset-4 rounded-[28px] bg-accent-soft -z-10 hidden sm:block" aria-hidden="true" />
        <ItineraryPreview />
      </div>
    </div>
  </section>
);

const ModuleTabs = () => {
  const [active, setActive] = useState(MODULES[0].key);
  const mod = MODULES.find((m) => m.key === active);
  const Preview = PREVIEWS[active];

  return (
    <Section id="features" className="bg-white border-y border-black/[0.06]">
      <SectionHead
        title="Everything you need to sell more trips"
        text="Say goodbye to spreadsheets, scattered WhatsApp chats and Word files. Six tools, one login."
      />

      <div role="tablist" aria-label="Modules" className="mt-10 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const on = m.key === active;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(m.key)}
              className={`shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full text-[14px] font-medium border transition-colors ${
                on
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-[#4c4546] border-black/[0.1] hover:border-black/30"
              }`}
            >
              <Icon className="w-4 h-4" />
              {m.title}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-8 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h3 className="text-[22px] font-semibold tracking-tight text-ink">{mod.title}</h3>
          <p className="mt-3 text-[16px] leading-relaxed text-[#5e5e5e]">{mod.summary}</p>
          <ul className="mt-5 space-y-2.5">
            {mod.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px] text-ink">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <Preview />
      </div>

      {/* All module copy stays in the DOM for crawlers; only the active one is shown above. */}
      <div className="sr-only">
        {MODULES.filter((m) => m.key !== active).map((m) => (
          <div key={m.key}>
            <h3>{m.title}</h3>
            <p>{m.summary}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};

/* Voice: Ching ------------------------------------------------------- */

const DEMO_CHUNKS = [
  { text: "Create a 5 day trip for ", field: null },
  { text: "Rahul Sharma", field: "client" },
  { text: ", 2 adults and 1 child", field: "guests" },
  { text: ", from 10 November", field: "dates" },
  { text: ", 2 nights in Srinagar, 2 nights in Pahalgam", field: "stays" },
  { text: ", with Innova, breakfast and dinner.", field: "cab" },
];

const DEMO_FIELDS = [
  ["client", "Client", "Rahul Sharma"],
  ["guests", "Guests", "2 adults, 1 child"],
  ["dates", "Dates", "10 Nov, 5 days"],
  ["stays", "Stays", "Srinagar 2N, Pahalgam 2N"],
  ["cab", "Cab and meals", "Innova, breakfast + dinner"],
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const VoiceDemo = () => {
  const last = DEMO_CHUNKS.length;
  const [step, setStep] = useState(prefersReducedMotion() ? last + 1 : 0);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    // Reveal one phrase per tick, hold the finished state a little, then replay.
    const id = window.setInterval(() => setStep((n) => (n >= last + 3 ? 0 : n + 1)), 1100);
    return () => window.clearInterval(id);
  }, [last]);

  const spoken = DEMO_CHUNKS.slice(0, Math.min(step, last));
  const filled = new Set(spoken.map((c) => c.field).filter(Boolean));
  const done = step > last;
  const listening = step <= last;

  return (
    <div aria-hidden="true" className="rounded-2xl bg-white text-ink overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-black/[0.06] bg-[#fafafa]">
        <div className="flex items-center gap-2.5">
          <span className="relative w-8 h-8 rounded-full bg-brand flex items-center justify-center">
            {listening && <span className="absolute inset-0 rounded-full bg-accent/50 animate-ping" />}
            <Mic className="relative w-4 h-4 text-accent" />
          </span>
          <div>
            <div className="text-[13px] font-semibold leading-tight">Ching</div>
            <div className="text-[11px] text-[#7e7576] leading-tight">{listening ? "Listening..." : "Done"}</div>
          </div>
        </div>
        <span className="text-[11px] text-[#7e7576]">Sample data</span>
      </div>

      <div className="px-4 pt-4 pb-3 min-h-[92px] text-[14px] leading-relaxed">
        {spoken.length === 0 ? (
          <span className="text-[#7e7576]">Say &ldquo;Hello Ching&rdquo;...</span>
        ) : (
          spoken.map((c) => (
            <span key={c.text} className={c.field ? "rounded-sm bg-accent/70" : ""}>
              {c.text}
            </span>
          ))
        )}
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-black/[0.08] divide-y divide-black/[0.06]">
        {DEMO_FIELDS.map(([key, label, value]) => (
          <div key={key} className="px-3 py-2 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-[#7e7576]">{label}</span>
            <span
              className={`font-medium text-right transition-all duration-500 ${
                filled.has(key) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className={`px-4 pb-4 transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center justify-between rounded-full bg-brand text-white pl-4 pr-1.5 py-1.5 text-[12px]">
          <span>Filled the trip</span>
          <span className="rounded-full bg-accent text-ink font-semibold px-3 py-1">Undo</span>
        </div>
      </div>
    </div>
  );
};

const VOICE_ICONS = [Mic, Pencil, FileText, Hand];

const VoiceSection = () => (
  <section id="voice" className="px-4 sm:px-6 py-16 md:py-20 scroll-mt-16 bg-brand text-white">
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
      <div>
        <h2 className="text-[30px] md:text-[40px] leading-[1.1] font-extrabold tracking-[-0.03em]">
          Say the trip. Ching builds it.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-white/70 max-w-xl">
          Client on the phone? Just speak the trip and watch it fill in, priced from your own hotel and cab
          rates. No forms, no waiting.
        </p>

        <blockquote className="mt-6 border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-white/85 max-w-xl">
          &ldquo;{VOICE.example}&rdquo;
        </blockquote>

        <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-6">
          {VOICE.capabilities.map((c, i) => {
            const Icon = VOICE_ICONS[i];
            return (
              <li key={c.title} className="flex gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold">{c.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/65">{c.text}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/signup" className="btn-primary !bg-accent !text-ink hover:!bg-accent-hover !h-11 !px-5">
            Try It Free <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[13px] text-white/50 max-w-xs">
            Works in English (India) in browsers with speech recognition, like Chrome and Edge. You can always type the same request.
          </p>
        </div>
      </div>

      <VoiceDemo />
    </div>
  </section>
);

const Workflow = () => (
  <Section>
    <SectionHead
      title="Enquiry to paid booking in 4 easy steps"
    />
    <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STEPS.map((s, i) => (
        <li key={s.title} className="p-5 rounded-2xl bg-white border border-black/[0.07]">
          <span className="text-[12px] font-semibold text-[#7e7576]">0{i + 1}</span>
          <h3 className="mt-2 text-[17px] font-semibold text-ink">{s.title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e5e5e]">{s.text}</p>
        </li>
      ))}
    </ol>
  </Section>
);

const FeatureGrid = () => (
  <Section className="bg-white border-y border-black/[0.06]">
    <SectionHead
      title="Packed with everything your agency needs"
    />
    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-10">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title}>
          <h3 className="text-[15px] font-semibold text-ink pb-3 border-b border-black/[0.08]">{g.title}</h3>
          <ul className="mt-3 space-y-2">
            {g.items.map((it) => (
              <li key={it} className="flex gap-2 text-[14px] text-[#4c4546]">
                <Check className="w-4 h-4 mt-0.5 text-ink shrink-0" />
                {it}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </Section>
);

const Audiences = () => (
  <Section>
    <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10">
      <SectionHead
        title="Made for your kind of travel business"
        text="DMC, tour operator, agency or a busy sales team: ViaItinerary fits the way you already quote and book."
      />
      <div className="grid sm:grid-cols-2 gap-4">
        {AUDIENCES.map((a) => (
          <div key={a.title} className="p-5 rounded-2xl bg-white border border-black/[0.07]">
            <h3 className="text-[16px] font-semibold text-ink">{a.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e5e5e]">{a.text}</p>
          </div>
        ))}
        <Link to="/solutions" className="sm:col-span-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink hover:underline underline-offset-4">
          Find the right fit for you <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </Section>
);

const TRUST_ICONS = [Users, ShieldCheck, Headphones];

const Trust = () => (
  <Section className="bg-brand text-white">
    <h2 className="text-[28px] md:text-[34px] leading-[1.15] font-extrabold tracking-[-0.03em] max-w-2xl">
      Made by travel people, for travel people
    </h2>
    <div className="mt-10 grid md:grid-cols-3 gap-4">
      {TRUST_PILLARS.map((t, i) => {
        const Icon = TRUST_ICONS[i];
        return (
          <div key={t.title} className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
            <Icon className="w-5 h-5 text-accent" />
            <h3 className="mt-4 text-[17px] font-semibold">{t.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-white/70">{t.text}</p>
          </div>
        );
      })}
    </div>
  </Section>
);

const Faq = () => (
  <Section id="faq">
    <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10">
      <SectionHead
        title="Got questions? We've got answers."
        text="Still unsure? Chat with us on WhatsApp and talk to the team that builds it."
      />
      <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown className="w-4 h-4 shrink-0 text-[#7e7576] transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5e5e5e]">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </Section>
);

export const CtaBand = () => (
  <section className="px-4 sm:px-6 pb-16 md:pb-20">
    <div className="max-w-6xl mx-auto rounded-3xl bg-accent px-6 py-12 md:px-12 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div>
        <h2 className="text-[26px] md:text-[32px] font-extrabold tracking-[-0.03em] text-ink leading-tight">
          Ready to sell more trips?
        </h2>
        <p className="mt-2 text-[16px] text-ink/75">
          Start your free trial today, or book a 30-minute demo with your own trips.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/signup" className="btn-primary !h-11 !px-5">
          Start Free Trial <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/schedule-demo" className="btn-secondary !h-11 !px-5 !border-black/20">
          Book a Free Demo
        </Link>
      </div>
    </div>
  </section>
);

const BrandLanding = () => (
  <div className="bg-[#f9f9f9] text-ink font-sans antialiased">
    <Seo
      title="ViaItinerary: Travel CRM, Itinerary Builder & Lead Management Software"
      description="Travel CRM and itinerary builder for travel agencies, tour operators and DMCs. Manage leads, build priced itineraries by voice or form, send branded quotes and track payments in one place."
      path="/"
      schema={[
        softwareSchema(FEATURE_GROUPS.flatMap((g) => g.items)),
        faqSchema(FAQS),
      ]}
    />
    <Navbar />
    <main>
      <Hero />
      <VoiceSection />
      <ModuleTabs />
      <Workflow />
      <FeatureGrid />
      <Audiences />
      <Trust />
      <Faq />
      <CtaBand />
    </main>
    <Footer />
  </div>
);

export default BrandLanding;
