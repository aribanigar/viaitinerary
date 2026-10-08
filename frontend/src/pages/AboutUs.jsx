import React from "react";
import { Mail, MessageCircle, Globe } from "lucide-react";
import MarketingPage from "../components/landing/MarketingPage";
import { CtaBand } from "../components/landing/BrandLanding";
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_URL, AUDIENCES } from "../components/landing/siteContent";

const PRINCIPLES = [
  {
    title: "Structure over chaos",
    text: "Travel businesses rarely fail for lack of enquiries. They lose money in missed follow-ups, mispriced quotes and payments nobody chased. We build the structure that stops those leaks.",
  },
  {
    title: "Your rates, your brand",
    text: "Quotes are priced from the hotel and transport rates you negotiated, and every document carries your logo, colours and policies.",
  },
  {
    title: "Simple enough for the whole team",
    text: "If a new agent cannot build a quote on day one, the software has failed. We keep screens focused and workflows short.",
  },
];

const AboutUs = () => (
  <MarketingPage
    title="About ViaItinerary | Travel CRM Built by Travel Operators"
    description="ViaItinerary is a travel CRM and itinerary builder made by people who run travel operations. Learn why we built it, how we work and how to reach us."
    path="/about-us"
    crumb="About us"
    pageType="AboutPage"
    heading="We build the software we wanted when we were quoting trips on WhatsApp"
    intro="ViaItinerary is a travel CRM and itinerary builder for travel agencies, tour operators and DMCs. It brings leads, quotes, bookings and payments into one system."
  >
    <section className="px-4 sm:px-6 py-14 md:py-16">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.4fr_1fr] gap-12">
        <div className="space-y-10">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">Why we built ViaItinerary</h2>
            <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-[#4c4546]">
              <p>
                Enquiries come in every day from WhatsApp, Instagram, ads, website forms and referrals. Without a
                system, follow-ups slip, pricing gets inconsistent between agents, and leads go cold before anyone
                notices.
              </p>
              <p>
                ViaItinerary started as an internal tool to fix exactly that inside a working travel business. Every
                module, from the lead inbox to the booking ledger, was shaped by real bookings before it was offered
                to other agencies.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">What we believe</h2>
            <div className="mt-5 grid gap-4">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="p-5 rounded-2xl bg-white border border-black/[0.07]">
                  <h3 className="text-[16px] font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#5e5e5e]">{p.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">Who uses it</h2>
            <ul className="mt-5 grid sm:grid-cols-2 gap-3">
              {AUDIENCES.map((a) => (
                <li key={a.title} className="p-4 rounded-xl bg-white border border-black/[0.07] text-[15px] font-medium">
                  {a.title}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 self-start p-6 rounded-2xl bg-white border border-black/[0.07]">
          <h2 className="text-[18px] font-semibold">Talk to us</h2>
          <p className="mt-1.5 text-[14px] text-[#5e5e5e]">Questions, a demo or help setting up. You will reach the team directly.</p>
          <ul className="mt-5 space-y-3 text-[15px]">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 hover:underline underline-offset-4">
                <Mail className="w-4 h-4 text-[#7e7576]" /> {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:underline underline-offset-4">
                <MessageCircle className="w-4 h-4 text-[#7e7576]" /> {CONTACT_PHONE} (WhatsApp)
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-[#7e7576]" /> viaitinerary.in
            </li>
          </ul>
        </aside>
      </div>
    </section>
    <CtaBand />
  </MarketingPage>
);

export default AboutUs;
