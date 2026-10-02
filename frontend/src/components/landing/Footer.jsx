import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Youtube, Mail, MessageCircle } from "lucide-react";
import { Wordmark } from "./Navbar";
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_URL } from "./siteContent";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { name: "Lead management", to: "/#features" },
      { name: "Itinerary builder", to: "/#features" },
      { name: "Voice trip builder", to: "/#voice" },
      { name: "Packages & quotes", to: "/#features" },
      { name: "Payments & vouchers", to: "/#features" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { name: "For DMCs", to: "/solutions#dmc" },
      { name: "For tour operators", to: "/solutions#tour-operators" },
      { name: "For travel agencies", to: "/solutions#agencies" },
      { name: "For sales teams", to: "/solutions#teams" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About us", to: "/about-us" },
      { name: "Book a demo", to: "/schedule-demo" },
      { name: "Plan a trip", to: "/lead-inquiry" },
      { name: "FAQ", to: "/#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy policy", to: "/privacy-policy" },
      { name: "Terms of service", to: "/terms-of-service" },
      { name: "Refund policy", to: "/refund-policy" },
    ],
  },
];

const Footer = () => (
  <footer className="bg-white border-t border-black/[0.06] font-sans">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-3 text-sm leading-relaxed text-[#5e5e5e]">
            Travel CRM and itinerary builder for travel agencies, tour operators and DMCs.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-[#4c4546]">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2 hover:text-[#181c22]">
                <Mail className="w-4 h-4" /> {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#181c22]">
                <MessageCircle className="w-4 h-4" /> {CONTACT_PHONE}
              </a>
            </li>
          </ul>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#181c22]">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.name}>
                  {link.to.includes("#") ? (
                    <a href={link.to} className="text-sm text-[#5e5e5e] hover:text-[#181c22]">
                      {link.name}
                    </a>
                  ) : (
                    <Link to={link.to} className="text-sm text-[#5e5e5e] hover:text-[#181c22]">
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-6 border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[#5e5e5e]">&copy; {new Date().getFullYear()} ViaItinerary. All rights reserved.</p>
        <div className="flex items-center gap-2">
          <a
            href="https://www.instagram.com/viaitinerary_official/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5e5e5e] hover:text-[#181c22] hover:bg-black/5"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="https://www.youtube.com/@ViaItinerary_official"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5e5e5e] hover:text-[#181c22] hover:bg-black/5"
          >
            <Youtube className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
