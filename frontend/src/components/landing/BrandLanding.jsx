import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ShieldCheck, Users, Headphones } from "lucide-react";
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
} from "./siteContent";

// Home page. Layout follows a compact B2B SaaS pattern: hero with product
// preview, module tabs, workflow, full feature grid, audiences, trust, FAQ, CTA.
// Product previews are lightweight HTML mocks of the real screens (sample data).

const Section = ({ id, className = "", children }) => (
  <section id={id} className={`px-4 sm:px-6 py-16 md:py-20 scroll-mt-16 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const SectionHead = ({ eyebrow, title, text, center = false }) => (
  <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
    <p className="eyebrow">{eyebrow}</p>
    <h2 className="mt-3 text-[28px] md:text-[34px] leading-[1.15] font-semibold tracking-tight text-[#181c22]">
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
    <div className="p-4 sm:p-5 text-[13px] text-[#181c22]">{children}</div>
  </div>
);

const Pill = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-black/[0.05] text-[#4c4546]",
    lime: "bg-[#e7f63c] text-[#181c22]",
    dark: "bg-[#181c22] text-white",
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
            <span className="text-[#181c22] font-semibold">{p}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-[#181c22] text-white">
      <span className="text-[12px]">Quote PDF ready for Rahul Mehta</span>
      <span className="text-[11px] font-semibold text-[#e7f63c]">Send</span>
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
          className={`h-6 rounded ${[2, 3, 4, 9, 10].includes(i) ? "bg-[#181c22]" : i === 6 ? "bg-[#e7f63c]" : "bg-black/[0.05]"}`}
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
      <div className="h-full w-[60%] bg-[#181c22]" />
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
          <div className="h-full bg-[#181c22]" style={{ width: `${w}%` }} />
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
        <p className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12px] font-medium text-[#4c4546]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#b5c400]" />
          Travel CRM for agencies, tour operators and DMCs
        </p>
        <h1 className="mt-5 text-[36px] sm:text-[44px] lg:text-[52px] leading-[1.06] font-semibold tracking-tight text-[#181c22]">
          Manage leads, itineraries and payments{" "}
          <span className="font-serif italic font-normal">in one place</span>
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-[#5e5e5e] max-w-xl">
          ViaItinerary is the travel CRM and itinerary builder that takes an enquiry from first message to
          confirmed, paid booking. Quote faster from your own hotel and transport rates, and never lose a
          follow-up again.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup" className="btn-primary !h-11 !px-5">
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/schedule-demo" className="btn-secondary !h-11 !px-5">
            Book a 30 min demo
          </Link>
        </div>
        <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[#5e5e5e]">
          {["Free trial to start", "Works on phone and desktop", "Your branding on every PDF"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#181c22]" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative isolate">
        <div className="absolute -inset-4 rounded-[28px] bg-[#f7fbc8] -z-10 hidden sm:block" aria-hidden="true" />
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
        eyebrow="The platform"
        title="Everything a travel business runs on, in one software"
        text="Six connected modules replace the spreadsheets, WhatsApp threads and Word files your team juggles today."
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
                  ? "bg-[#181c22] text-white border-[#181c22]"
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
          <h3 className="text-[22px] font-semibold tracking-tight text-[#181c22]">{mod.title}</h3>
          <p className="mt-3 text-[16px] leading-relaxed text-[#5e5e5e]">{mod.summary}</p>
          <ul className="mt-5 space-y-2.5">
            {mod.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[15px] text-[#181c22]">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#e7f63c] flex items-center justify-center shrink-0">
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

const Workflow = () => (
  <Section>
    <SectionHead
      eyebrow="How it works"
      title="From enquiry to paid booking in four steps"
    />
    <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STEPS.map((s, i) => (
        <li key={s.title} className="p-5 rounded-2xl bg-white border border-black/[0.07]">
          <span className="text-[12px] font-semibold text-[#7e7576]">0{i + 1}</span>
          <h3 className="mt-2 text-[17px] font-semibold text-[#181c22]">{s.title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e5e5e]">{s.text}</p>
        </li>
      ))}
    </ol>
  </Section>
);

const FeatureGrid = () => (
  <Section className="bg-white border-y border-black/[0.06]">
    <SectionHead
      eyebrow="All features"
      title="Built for the way travel companies actually work"
    />
    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-10">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title}>
          <h3 className="text-[15px] font-semibold text-[#181c22] pb-3 border-b border-black/[0.08]">{g.title}</h3>
          <ul className="mt-3 space-y-2">
            {g.items.map((it) => (
              <li key={it} className="flex gap-2 text-[14px] text-[#4c4546]">
                <Check className="w-4 h-4 mt-0.5 text-[#181c22] shrink-0" />
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
        eyebrow="Who it is for"
        title="One system, shaped around your business"
        text="Whether you run inbound tours, sell packages or manage a sales floor, ViaItinerary fits how you already quote and book."
      />
      <div className="grid sm:grid-cols-2 gap-4">
        {AUDIENCES.map((a) => (
          <div key={a.title} className="p-5 rounded-2xl bg-white border border-black/[0.07]">
            <h3 className="text-[16px] font-semibold text-[#181c22]">{a.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e5e5e]">{a.text}</p>
          </div>
        ))}
        <Link to="/solutions" className="sm:col-span-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#181c22] hover:underline underline-offset-4">
          See solutions by business type <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </Section>
);

const TRUST_ICONS = [Users, ShieldCheck, Headphones];

const Trust = () => (
  <Section className="bg-[#181c22] text-white">
    <p className="eyebrow !text-white/60">Why agencies trust us</p>
    <h2 className="mt-3 text-[28px] md:text-[34px] leading-[1.15] font-semibold tracking-tight max-w-2xl">
      Made by travel people, for travel people
    </h2>
    <div className="mt-10 grid md:grid-cols-3 gap-4">
      {TRUST_PILLARS.map((t, i) => {
        const Icon = TRUST_ICONS[i];
        return (
          <div key={t.title} className="p-6 rounded-2xl bg-white/[0.04] border border-white/10">
            <Icon className="w-5 h-5 text-[#e7f63c]" />
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
        eyebrow="FAQ"
        title="Questions agencies ask us"
        text="Still unsure? Message us on WhatsApp and talk to the team."
      />
      <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[16px] font-semibold text-[#181c22] [&::-webkit-details-marker]:hidden">
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
    <div className="max-w-6xl mx-auto rounded-3xl bg-[#e7f63c] px-6 py-12 md:px-12 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div>
        <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-[#181c22] leading-tight">
          See ViaItinerary with your own trips
        </h2>
        <p className="mt-2 text-[16px] text-[#181c22]/75">
          Start a free trial, or book a 30 minute walkthrough with our team.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/signup" className="btn-primary !h-11 !px-5">
          Start free trial <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/schedule-demo" className="btn-secondary !h-11 !px-5 !border-black/20">
          Book a demo
        </Link>
      </div>
    </div>
  </section>
);

const BrandLanding = () => (
  <div className="bg-[#f9f9f9] text-[#181c22] font-sans antialiased">
    <Seo
      title="ViaItinerary: Travel CRM, Itinerary Builder & Lead Management Software"
      description="Travel CRM and itinerary builder for travel agencies, tour operators and DMCs. Manage leads, build priced itineraries, send branded quotes and track payments in one place."
      path="/"
      schema={[
        softwareSchema(FEATURE_GROUPS.flatMap((g) => g.items)),
        faqSchema(FAQS),
      ]}
    />
    <Navbar />
    <main>
      <Hero />
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
