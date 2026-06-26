import React, { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar decoration={true} />
      <main className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto font-sans">
        <h1 className="text-4xl font-bold text-[#10182A] mb-8">
          PRIVACY POLICY
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              1. Introduction
            </h2>
            <p>
              Via Kashmir (“Company”, “We”, “Us”, “Our”) operates the Via
              Kashmir Itinerary Builder & CRM SaaS Platform (“Platform”,
              “Service”).
            </p>
            <p className="mt-2">
              This Privacy Policy explains how we collect, use, process, store,
              and protect personal data when you:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Visit our website</li>
              <li>Register for a 3-day free trial</li>
              <li>Subscribe to our paid plans</li>
              <li>Use our software services</li>
            </ul>
            <p className="mt-4">
              We are committed to protecting your privacy in compliance with:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Indian Information Technology Act, 2000</li>
              <li>GDPR (EU & UK users)</li>
              <li>UAE & GCC Data Protection Regulations</li>
              <li>Other applicable international privacy laws</li>
            </ul>
            <p className="mt-4">
              By using the Platform, you agree to this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              2. Definitions
            </h2>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>
                <strong>Personal Data:</strong> Any information that identifies
                a person.
              </li>
              <li>
                <strong>User:</strong> Travel agents, companies, or individuals
                using our SaaS.
              </li>
              <li>
                <strong>Client Data:</strong> Data uploaded by users (end
                traveler details).
              </li>
              <li>
                <strong>Data Controller:</strong> The entity determining how
                data is processed.
              </li>
              <li>
                <strong>Data Processor:</strong> The entity processing data on
                behalf of controller.
              </li>
            </ul>
            <p className="mt-4">Via Kashmir typically acts as:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Data Controller for account and billing information.</li>
              <li>
                Data Processor for client/traveler data uploaded by users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              3. Information We Collect
            </h2>
            <h3 className="text-xl font-medium text-[#10182A] mt-4 mb-2">
              3.1 Information You Provide
            </h3>
            <p>When you register or subscribe:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Full name, Company name, Email address, Phone number</li>
              <li>Billing details and Login credentials</li>
            </ul>
            <p className="mt-4">When using the platform:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Itinerary details, Client names and travel data</li>
              <li>Booking records and Team performance data</li>
            </ul>
            <h3 className="text-xl font-medium text-[#10182A] mt-6 mb-2">
              3.2 Automatically Collected Information
            </h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>IP address, Browser type, Device information</li>
              <li>Login activity, Usage logs, Cookies & tracking data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              4. How We Use Your Information
            </h2>
            <p>We process data to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide access to the Platform and Manage subscriptions</li>
              <li>Improve system performance and Provide technical support</li>
              <li>
                Monitor security and fraud, Send service-related communications
              </li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-4 font-semibold text-[#10182A]">
              We do NOT sell your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              5. Legal Basis for Processing (GDPR Compliance)
            </h2>
            <p>For EU/UK users, processing is based on:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Contractual necessity</li>
              <li>Legitimate business interests</li>
              <li>Legal compliance</li>
              <li>User consent (where applicable)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              6. Client Data Responsibility
            </h2>
            <p>Users who upload traveler or customer data:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Are solely responsible for obtaining proper consent.</li>
              <li>
                Must comply with applicable privacy laws and act as Data
                Controllers for such data.
              </li>
            </ul>
            <p className="mt-4 italic">
              Via Kashmir processes such data strictly under user instruction.
              We are not responsible for incorrect data entered by users, legal
              violations by travel agencies, or end-customer disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              7. Data Sharing & Third Parties
            </h2>
            <p>
              We may share data with hosting, cloud infrastructure, payment, and
              analytics providers, or legal authorities when required by law.
              All third-party partners are bound by confidentiality.
            </p>
            <p className="mt-4 font-semibold text-[#10182A]">
              We do NOT sell or rent data to advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              8. International Data Transfers
            </h2>
            <p>
              Your data may be processed outside your residence. Where required
              (e.g., GDPR regions), we ensure Standard Contractual Clauses
              (SCCs) and adequate safeguards are in place.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              9. Data Retention
            </h2>
            <p>
              We retain data during active subscription and up to 30 days after
              account termination, or as required by law. Trial accounts may
              have data deleted immediately after expiration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              10. Data Security
            </h2>
            <p>
              We implement reasonable security measures including SSL encryption
              and access controls. However, no system is 100% secure, and we do
              not guarantee absolute protection against cyber threats.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              11. Your Rights
            </h2>
            <p>
              Depending on your jurisdiction, you may have the right to access,
              correct, delete, or restrict processing of your data. Requests may
              be sent to:{" "}
              <a
                href="mailto:contact@viakashmir.com"
                className="text-blue-600 hover:underline"
              >
                contact@viakashmir.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              12. Cookies & Tracking
            </h2>
            <p>
              We use cookies to improve user experience and track performance.
              Users may disable cookies via browser settings, though
              functionality may be affected.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              13. Children's Privacy
            </h2>
            <p>
              The Platform is not intended for individuals under 12 years of
              age. We do not knowingly collect data from minors.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              14. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy at any time. Material changes
              will be communicated via email or website notification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              15. Limitation of Liability
            </h2>
            <p>
              Via Kashmir shall not be liable for user mishandling of client
              data, regulatory penalties caused by user non-compliance, or
              indirect damages/data loss caused by user negligence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              16. Governing Law
            </h2>
            <p>
              This Privacy Policy shall be governed by the laws of India.
              Disputes shall be subject to jurisdiction in Jammu & Kashmir,
              India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              17. Contact Information
            </h2>
            <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-gray-100">
              <p className="font-bold text-[#10182A]">Via Kashmir</p>
              <p>
                Website:{" "}
                <a
                  href="https://www.viakashmiritinerary.in"
                  className="text-blue-600 hover:underline"
                >
                  https://www.viakashmiritinerary.in
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:contact@viakashmir.com"
                  className="text-blue-600 hover:underline"
                >
                  contact@viakashmir.com
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

export default PrivacyPolicy;
