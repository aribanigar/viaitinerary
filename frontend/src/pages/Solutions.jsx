import React from "react";
import { Check, Download } from "lucide-react";
import MarketingPage from "../components/landing/MarketingPage";
import { CtaBand } from "../components/landing/BrandLanding";
import pdfFile from "../assets/itinerary-solutions.pdf";

const SOLUTIONS = [
  {
    id: "dmc",
    title: "For Destination Management Companies",
    lead: "You know your destination better than anyone. ViaItinerary turns that knowledge into fast, accurate quotes.",
    points: [
      "Load your contracted hotels, room categories and meal plans once",
      "Price transfers and sightseeing from your own vehicle rates",
      "Quote B2B partners and direct clients from the same catalog",
      "Track room availability on the hotel booking calendar",
    ],
  },
  {
    id: "tour-operators",
    title: "For Tour Operators",
    lead: "Your best-selling routes are already proven. Stop rebuilding them for every enquiry.",
    points: [
      "Save fixed and custom trips as reusable packages",
      "Clone a package into a client quote and adjust dates and pax",
      "Inclusions, exclusions and policies attached automatically",
      "Vouchers and confirmations sent once the client pays",
    ],
  },
  {
    id: "agencies",
    title: "For Travel Agencies",
    lead: "Enquiries arrive on WhatsApp, Instagram, your website and the phone. Bring them into one inbox.",
    points: [
      "Embed an enquiry form on your own website",
      "Every lead with its status, owner and follow-up date",
      "Branded PDF itineraries that look like your agency, not a template",
      "Send quotes and confirmations from your own Gmail",
    ],
  },
  {
    id: "teams",
    title: "For Multi-agent Sales Teams",
    lead: "When several agents sell, you need to see who is handling what and where deals stall.",
    points: [
      "Assign leads to agents and reassign in one click",
      "Admin and team roles with scoped access",
      "Team reports on leads, quotes and conversions",
      "Ledger and accounting summary across all bookings",
    ],
  },
];

const Solutions = () => (
  <MarketingPage
    title="Solutions for DMCs, Tour Operators & Travel Agencies | ViaItinerary"
    description="How ViaItinerary's travel CRM and itinerary builder works for DMCs, tour operators, travel agencies and multi-agent sales teams."
    path="/solutions"
    crumb="Solutions"
    heading="Built for every kind of travel business"
    intro="The same core platform, set up around how your business quotes, books and collects payments."
  >
    <section className="px-4 sm:px-6 py-14 md:py-16">
      <div className="max-w-6xl mx-auto">
        <nav aria-label="On this page" className="flex flex-wrap gap-2 mb-10">
          {SOLUTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="h-9 px-4 inline-flex items-center rounded-full border border-black/[0.1] bg-white text-[14px] font-medium text-[#4c4546] hover:border-black/30">
              {s.title.replace("For ", "")}
            </a>
          ))}
        </nav>

        <div className="grid md:grid-cols-2 gap-5">
          {SOLUTIONS.map((s) => (
            <article id={s.id} key={s.id} className="scroll-mt-24 p-6 md:p-7 rounded-2xl bg-white border border-black/[0.07]">
              <h2 className="text-[21px] font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5e5e5e]">{s.lead}</p>
              <ul className="mt-5 space-y-2.5">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px]">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 p-5 rounded-2xl bg-white border border-black/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold">Solutions brochure</h2>
            <p className="text-[14px] text-[#5e5e5e]">A printable overview to share with your partners or team.</p>
          </div>
          <a href={pdfFile} download="viaitinerary-solutions.pdf" className="btn-secondary self-start sm:self-auto">
            <Download className="w-4 h-4" /> Download PDF
          </a>
        </div>
      </div>
    </section>
    <CtaBand />
  </MarketingPage>
);

export default Solutions;
