import React, { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";

const AboutUs = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-700 font-sans">
      <Navbar decoration={true} />
      <main className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-[#1a1c1c] mb-8 uppercase">
          About ViaItinerary
        </h1>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              Enterprise-Grade CRM & Itinerary Automation
            </h2>
            <p className="text-xl font-medium text-gray-900 mb-6">
              Stop Losing Travel Leads. Start Closing More Bookings.
            </p>
            <p>
              India’s Smart CRM & Itinerary Builder for Travel Companies. All
              your leads. All your follow-ups. All your bookings. Inside one
              powerful system.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-4">
              The Problem We Solve
            </h3>
            <p>
              You receive inquiries daily from WhatsApp, Instagram, Facebook
              Ads, Website Forms, and Referrals. But without structure:
            </p>
            <ul className="list-disc ml-6 mt-4忽视 space-y-2">
              <li>Follow-ups get missed</li>
              <li>Pricing gets confused</li>
              <li>Leads go cold</li>
              <li>Revenue leaks silently</li>
            </ul>
            <p className="mt-4 font-bold text-red-600 uppercase tracking-wide">
              That ends now.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-4">
              Built for Travel Sales Teams
            </h3>
            <p>
              ViaItinerary is a complete system engineered for serious travel
              companies that want structured growth and operational control.
            </p>
            <ul className="list-disc ml-6 mt-4忽视 space-y-2">
              <li>Track every inquiry from source to confirmation</li>
              <li>Assign leads to specific agents & monitor performance</li>
              <li>Set automated follow-up reminders</li>
              <li>Build professional itineraries instantly</li>
              <li>Monitor payments & booking confirmations</li>
              <li>Track conversion rates and revenue growth</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-4">
              Engineered for Scale
            </h3>
            <p className="italic border-l-4 border-[#1b1b1b] pl-4 py-2 bg-gray-50">
              "Travel businesses don’t fail due to lack of inquiries. They fail
              due to lack of structure."
            </p>
            <div className="mt-6">
              <p className="font-semibold mb-2 text-[#1a1c1c]">
                Core Capabilities:
              </p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Advanced Lead Pipeline Management</li>
                <li>Intelligent Follow-up Automation</li>
                <li>Dynamic Itinerary Generation Engine</li>
                <li>Revenue & Conversion Analytics</li>
                <li>Multi-User Role-Based Access</li>
                <li>Admin-Level Control Dashboard</li>
              </ul>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-4">
              Itinerary Automation Engine
            </h3>
            <p>
              Create structured, client-ready itineraries in minutes, not hours:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Modular day-wise builder</li>
              <li>Dynamic pricing control</li>
              <li>Reusable itinerary templates</li>
              <li>PDF export for client delivery</li>
              <li>Centralized package database</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-4">
              Who is it for?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Domestic Tour Operators",
                "International Travel Planners",
                "Growing Travel Agencies",
                "Multi-Agent Sales Teams",
                "DMCs",
                "Corporate Travel Firms",
              ].map((item) => (
                <div
                  key={item}
                  className="p-4 border border-gray-100 rounded-lg bg-gray-50 font-medium text-[#1a1c1c]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#1a1c1c] text-white p-8 rounded-2xl shadow-sm">
            <h3 className="text-2xl font-bold mb-4 text-[#1b1b1b]">
              Operate like a modern travel brand.
            </h3>
            <p className="mb-6 opacity-90">
              The Travel Industry Is Competitive. Your System Shouldn’t Be Weak.
              Scale with structure. Sell with confidence.
            </p>
            <a
              href="/signup"
              className="inline-block bg-[#1b1b1b] text-[#1a1c1c] px-8 py-3 rounded-lg font-bold hover:scale-[1.02] transition-transform shadow-md"
            >
              Start Your Free Trial
            </a>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4 border-t pt-8">
              Contact Information
            </h2>
            <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-gray-100">
              <p className="font-bold text-[#1a1c1c]">ViaItinerary</p>
              <p>
                Website:{" "}
                <a
                  href="https://www.viaitinerary.in"
                  className="text-blue-600 hover:underline"
                >
                  https://www.viaitinerary.in
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:contact@viaitinerary.com"
                  className="text-blue-600 hover:underline"
                >
                  contact@viaitinerary.com
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AboutUs;
