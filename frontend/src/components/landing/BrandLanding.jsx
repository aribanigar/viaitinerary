import React from "react";
import { Link } from "react-router-dom";
import { Map, Users, LayoutTemplate, FileText, ArrowRight } from "lucide-react";

// "Minimalist Editorial" brand landing — faithful to the uploaded brand system:
// monochrome, airy, Noto Serif headlines + Manrope body, pill buttons, 20px media.

const Label = ({ children }) => (
  <p className="text-[13px] font-semibold tracking-[0.05em] uppercase text-secondary">{children}</p>
);

const PillLink = ({ to, children, dark = true }) => (
  <Link
    to={to}
    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80 ${
      dark ? "bg-black text-white" : "border border-outline-variant text-on-surface"
    }`}
  >
    {children}
  </Link>
);

const CAPABILITIES = [
  {
    label: "Itineraries",
    heading: "Craft beautiful itineraries in minutes",
    body:
      "Build day-by-day plans, pull hotels and cabs from your catalog, and watch the cost calculate itself — no spreadsheets.",
    steps: ["Add days & destinations", "Attach hotels & transport", "Quote instantly"],
    img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=70&w=1100",
  },
  {
    label: "Clients",
    heading: "Every lead, one calm inbox",
    body:
      "Capture inquiries from your website, assign them to your team, and convert them into trips without losing a thread.",
    steps: ["Capture inquiries", "Assign & track", "Convert to trips"],
    img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=70&w=1100",
  },
];

const FEATURES = [
  { icon: Map, title: "Itinerary Builder", body: "Day-wise plans with live pricing, hotels, cabs and inclusions." },
  { icon: Users, title: "Lead CRM", body: "Website inquiries, assignments and follow-ups in one place." },
  { icon: LayoutTemplate, title: "Package Templates", body: "Build once, reuse forever — quote clients in seconds." },
  { icon: FileText, title: "PDF & Invoicing", body: "Branded itineraries, vouchers and invoices, ready to send." },
];

const BrandLanding = () => {
  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen">
      <style>{`
        @keyframes brand-scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .brand-logo-track { display:flex; width:max-content; animation: brand-scroll 32s linear infinite; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur border-b border-outline-variant/50">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
            ViaItinerary
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-on-surface-variant">
            <a href="#capabilities" className="hover:text-on-surface">Product</a>
            <a href="#features" className="hover:text-on-surface">Features</a>
            <Link to="/login" className="hover:text-on-surface">Sign in</Link>
          </nav>
          <PillLink to="/signup">Get started</PillLink>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-6 sm:px-8 pt-10 sm:pt-16">
          <div className="relative overflow-hidden rounded-[20px]">
            <img
              src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=70&w=1600"
              alt="Mountain landscape at dusk"
              className="w-full h-[380px] sm:h-[520px] object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <p className="text-[13px] font-semibold tracking-[0.05em] uppercase text-white/70 mb-4">ViaItinerary</p>
              <h1 className="font-serif text-white text-4xl sm:text-6xl font-semibold leading-[1.1] tracking-[-0.02em] max-w-3xl">
                Master the art of effortless itineraries
              </h1>
              <div className="mt-8">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-90 transition"
                >
                  Start free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Intro two-column */}
        <section className="max-w-[1200px] mx-auto px-6 sm:px-8 py-20 sm:py-28 grid md:grid-cols-2 gap-10">
          <Label>The platform</Label>
          <p className="font-serif text-2xl sm:text-3xl leading-[1.4] text-on-surface">
            ViaItinerary strips away the busywork — so you can design beautiful trips, quote clients in
            minutes, and spend your time on the journey, not the paperwork.
          </p>
        </section>

        {/* Logo strip */}
        <section className="border-y border-outline-variant/50 overflow-hidden py-8">
          <div className="brand-logo-track">
            {[...Array(2)].map((_, r) => (
              <div key={r} className="flex items-center gap-16 px-8 text-secondary/60 font-serif text-xl tracking-wide">
                {["Voyages", "Meridian", "Atlas & Co", "Nomad", "Wanderlust", "Summit", "Odyssey"].map((n) => (
                  <span key={n} className="whitespace-nowrap">{n}</span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities (alternating) */}
        <div id="capabilities">
          {CAPABILITIES.map((c, i) => (
            <section key={c.label} className="max-w-[1200px] mx-auto px-6 sm:px-8 py-20 sm:py-28">
              <Label>Core capabilities</Label>
              <div className={`mt-8 grid md:grid-cols-2 gap-10 lg:gap-16 items-center ${i % 2 ? "md:[direction:rtl]" : ""}`}>
                <div className="md:[direction:ltr]">
                  <h2 className="font-serif text-3xl sm:text-4xl font-semibold leading-[1.2] tracking-[-0.01em]">
                    {c.heading}
                  </h2>
                  <p className="mt-4 text-on-surface-variant leading-relaxed max-w-md">{c.body}</p>
                  <ul className="mt-8 max-w-sm">
                    {c.steps.map((s) => (
                      <li key={s} className="py-4 border-t border-outline-variant/60 text-sm font-medium text-on-surface">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:[direction:ltr] overflow-hidden rounded-[20px] bg-black">
                  <img src={c.img} alt={c.heading} className="w-full h-[300px] sm:h-[380px] object-cover" />
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Full-width image band */}
        <section className="max-w-[1200px] mx-auto px-6 sm:px-8">
          <div className="relative overflow-hidden rounded-[20px]">
            <img
              src="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&q=70&w=1600"
              alt="Calm mountains"
              className="w-full h-[280px] sm:h-[360px] object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center text-center px-6">
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-on-surface max-w-2xl">
                Beautiful itineraries. Effortless workflow.
              </h2>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section id="features" className="max-w-[1200px] mx-auto px-6 sm:px-8 py-20 sm:py-28">
          <Label>Everything you need</Label>
          <h2 className="mt-6 font-serif text-3xl sm:text-4xl font-semibold leading-[1.2]">
            One quiet workspace for the whole trip
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="border-t border-outline-variant/60 pt-6">
                <Icon className="w-5 h-5 text-on-surface" strokeWidth={1.5} />
                <h3 className="mt-4 font-semibold text-on-surface">{title}</h3>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="max-w-[1200px] mx-auto px-6 sm:px-8 pb-20 sm:pb-28">
          <div className="relative overflow-hidden rounded-[20px]">
            <img
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=70&w=1600"
              alt="Mountain range"
              className="w-full h-[320px] sm:h-[420px] object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <h2 className="font-serif text-white text-3xl sm:text-5xl font-semibold leading-[1.1] max-w-2xl">
                Ready to elevate your travel business?
              </h2>
              <div className="mt-8">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-3 text-sm font-semibold hover:opacity-90 transition"
                >
                  Start free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/60">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 py-16">
          <p className="font-serif text-xl text-on-surface">Travel, simplified.</p>
          <p className="mt-2 text-sm text-on-surface-variant max-w-md">
            Focus on what matters. ViaItinerary strips away the busywork so crafting and closing trips feels effortless.
          </p>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
            <span className="font-serif text-6xl sm:text-8xl font-semibold tracking-tight text-on-surface">
              ViaItinerary
            </span>
            <div className="flex items-center gap-6 text-sm text-on-surface-variant">
              <Link to="/login" className="hover:text-on-surface">Sign in</Link>
              <Link to="/signup" className="hover:text-on-surface">Get started</Link>
              <Link to="/privacy-policy" className="hover:text-on-surface">Privacy</Link>
            </div>
          </div>
          <p className="mt-10 text-xs text-secondary">© {new Date().getFullYear()} ViaItinerary. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default BrandLanding;
