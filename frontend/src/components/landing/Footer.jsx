import React from "react";
import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Linkedin,
  MessageSquare,
  Youtube,
  MapPin,
} from "lucide-react";
import logoDark from "../../assets/ViaKashmir logo for dark bg.png";

const Footer = () => {
  return (
    <footer className="bg-[#043b36] pt-24 pb-12 text-white/90 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row justify-between mb-24 gap-16 lg:gap-32">
          {/* Logo & Description */}
          <div className="max-w-sm">
            <div className="flex items-center">
              <img
                src={logoDark}
                alt="Viakashmir"
                className="h-26 w-auto object-contain block"
              />
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-10 max-w-[320px]">
              The preferred itinerary builder and CRM for forward-thinking
              travel agencies and DMCs worldwide.
            </p>
            <div className="flex gap-4">
              {[
                {
                  Icon: Facebook,
                  href: "https://www.facebook.com/people/Via-Kashmir/61581764279006/",
                  label: "Facebook",
                },
                {
                  Icon: Instagram,
                  href: "https://www.instagram.com/viakashmir_official/",
                  label: "Instagram",
                },
                {
                  Icon: Linkedin,
                  href: "https://www.linkedin.com/company/via-kashmir",
                  label: "LinkedIn",
                },
                {
                  Icon: Youtube,
                  href: "https://www.youtube.com/@ViaKashmir_official",
                  label: "YouTube",
                },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-[#faa81e] flex items-center justify-center text-white/70 hover:text-[#043b36] transition-all group"
                >
                  <social.Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          <div className="flex flex-wrap gap-20 lg:gap-32">
            <div className="min-w-[120px]">
              <h4 className="text-[#faa81e] font-bold text-base mb-8 uppercase tracking-wider">
                Support
              </h4>
              <ul className="space-y-6">
                <li className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-[#faa81e] shrink-0" />
                  <div className="text-white/70 text-sm">
                    <p className="font-semibold text-white">Support Chat</p>
                    <div className="flex flex-col gap-1">
                      <a
                        href="https://wa.me/919186051499"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#faa81e] transition-colors"
                      >
                        +91 9186051499
                      </a>
                      <a
                        href="mailto:contact@viakashmir.com"
                        className="hover:text-[#faa81e] transition-colors"
                      >
                        contact@viakashmir.com
                      </a>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#faa81e] shrink-0" />
                  <div className="text-white/70 text-sm">
                    <p className="font-semibold text-white">Google Business</p>
                    <a
                      href="https://share.google/LdYs7a1YDfGvx1Nkc"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#faa81e] transition-colors underline decoration-[#faa81e]/30 underline-offset-4"
                    >
                      View Location
                    </a>
                  </div>
                </li>
              </ul>
            </div>

            <div className="min-w-[120px]">
              <h4 className="text-[#faa81e] font-bold text-base mb-8 uppercase tracking-wider">
                Company
              </h4>
              <ul className="space-y-4">
                <li>
                  <Link
                    to="/about-us"
                    className="text-white/70 hover:text-[#faa81e] text-base transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <a
                    href="/blog"
                    className="text-white/70 hover:text-[#faa81e] text-base transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = "/blog";
                    }}
                  >
                    Blog
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-white/70 text-sm">
            © {new Date().getFullYear()} Via Kashmir. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link
              to="/refund-policy"
              className="text-white/70 hover:text-[#faa81e] text-sm transition-colors"
            >
              Refund Policy
            </Link>
            <Link
              to="/privacy-policy"
              className="text-white/70 hover:text-[#faa81e] text-sm transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-service"
              className="text-white/70 hover:text-[#faa81e] text-sm transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
