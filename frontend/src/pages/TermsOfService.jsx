import React, { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar decoration={true} />
      <main className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto font-sans text-gray-700 leading-relaxed">
        <h1 className="text-4xl font-bold text-[#10182A] mb-8">
          TERMS OF SERVICE
        </h1>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              These Terms of Service (“Terms”) constitute a legally binding
              agreement between you (“User”, “Subscriber”, “Company”, “Client”)
              and ViaItinerary (“Company”, “We”, “Us”, “Our”) governing access to
              and use of the ViaItinerary Itinerary Builder & CRM SaaS Platform
              (“Platform”, “Software”, “Service”).
            </p>
            <p className="mt-2">
              By registering, accessing, or using the Platform, you confirm
              that:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>You have legal authority to bind your organization.</li>
              <li>You agree to be bound by these Terms.</li>
              <li>
                You will comply with all applicable local and international
                laws.
              </li>
            </ul>
            <p className="mt-4 italic">
              If you do not agree, you must immediately discontinue use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              2. Nature of the Service
            </h2>
            <p>
              ViaItinerary provides a cloud-based Software-as-a-Service (SaaS)
              solution for itinerary creation, CRM, booking management, team
              reporting, and analytics.
            </p>
            <p className="mt-2">
              ViaItinerary is a technology provider only and does not act as a
              travel agency, handle bookings directly, or assume responsibility
              for end traveler disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              3. 3-Day Free Trial
            </h2>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Trial begins immediately upon registration.</li>
              <li>We may restrict features during trial.</li>
              <li>
                After 3 days, continued access requires an active paid
                subscription.
              </li>
              <li>
                No data retention is guaranteed for expired trial accounts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              4. Subscription & Payment Terms
            </h2>
            <p>
              Subscriptions may be offered per user seat, per organization, or
              via custom enterprise plans. All payments must be made in advance
              and are non-refundable unless explicitly agreed in writing.
              Failure to pay may result in immediate suspension.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              5. Account & Access Control
            </h2>
            <p>
              Each user seat is licensed to one individual only; account sharing
              is strictly prohibited. You are responsible for maintaining
              password confidentiality. ViaItinerary is not liable for
              unauthorized access caused by user negligence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              6. License Grant & Restrictions
            </h2>
            <p>
              We grant a limited, non-exclusive license for internal business
              purposes. You shall NOT reverse engineer the software, copy
              architecture, resell without permission, or use automated scraping
              tools.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              7. Intellectual Property
            </h2>
            <p>
              All software code, algorithms, CRM structure, templates, and
              branding remain the exclusive property of ViaItinerary.
              Unauthorized duplication may result in legal action.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              8. User Data & Compliance
            </h2>
            <p>
              You retain ownership of your uploaded data but are solely
              responsible for its accuracy and compliance with relevant data
              protection laws (GDPR, Indian IT Act, etc.). ViaItinerary acts as a
              Data Processor where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              9. Data Security & Availability
            </h2>
            <p>
              The Platform is provided on an “AS IS” and “AS AVAILABLE” basis.
              We do not guarantee uninterrupted access or immunity from cyber
              attacks. Users are advised to maintain independent backups.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              10. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, ViaItinerary shall not be
              liable for indirect damages, loss of revenue, or business
              interruption. Total liability shall not exceed the subscription
              fees paid in the preceding three (3) months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              11. Indemnification
            </h2>
            <p>
              You agree to indemnify ViaItinerary from claims arising from your
              misuse of the platform, violation of laws, or client disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              12. Suspension & Termination
            </h2>
            <p>
              We may suspend access for overdue payment or violation of terms.
              Upon termination, access is revoked immediately and data may be
              deleted after 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              13. Force Majeure
            </h2>
            <p>
              We shall not be liable for failure or delay due to natural
              disasters, government restrictions, war, or infrastructure
              failure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              14. Confidentiality
            </h2>
            <p>
              Both parties agree to maintain confidentiality of proprietary
              information and trade secrets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              15. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of India. Unresolved disputes
              shall be subject to arbitration in India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              16. Modifications
            </h2>
            <p>
              We reserve the right to update these Terms at any time. Continued
              use after updates constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              17. Severability & Entire Agreement
            </h2>
            <p>
              If any provision is unenforceable, the rest remain in effect.
              These Terms constitute the entire agreement between the parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#10182A] mb-4">
              18. Contact Information
            </h2>
            <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-gray-100">
              <p className="font-bold text-[#10182A]">ViaItinerary</p>
              <p>
                Website:{" "}
                <a
                  href="https://www.viaitinerary.in"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
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

export default TermsOfService;
