import React, { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";

const RefundPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar decoration={true} />
      <main className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-[#1a1c1c] mb-8">
          REFUND & CANCELLATION POLICY
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              1. Overview
            </h2>
            <p>
              This Refund & Cancellation Policy governs subscription payments
              made for access to the ViaItinerary Itinerary Builder & CRM SaaS
              Platform (“Platform”, “Service”).
            </p>
            <p className="mt-2">
              By subscribing to our Platform, you agree to this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              2. Free Trial – 3 Days
            </h2>
            <p>
              We offer a 3-day free trial to allow users to evaluate the
              Platform.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>
                No payment is required during the trial (unless otherwise
                specified).
              </li>
              <li>
                Users are responsible for cancelling before trial expiration if
                they do not wish to subscribe.
              </li>
              <li>
                Upon trial expiration, access may be suspended unless a paid
                plan is activated.
              </li>
              <li>
                Trial data may be deleted without notice after expiration.
              </li>
            </ul>
            <p className="mt-2 font-medium text-[#1a1c1c]">
              No refund applies to free trial access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              3. Subscription Payments
            </h2>
            <p>All subscription fees:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>Are payable in advance.</li>
              <li>
                Are billed per seat or per company, depending on selected plan.
              </li>
              <li>
                Are non-refundable except as expressly stated in this Policy.
              </li>
              <li>Exclude applicable taxes (VAT/GST/etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              4. No Refund Policy (Standard Rule)
            </h2>
            <p>
              Due to the digital and instantly accessible nature of SaaS
              services:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>All payments are final.</li>
              <li>
                No refunds will be issued for:
                <ul className="list-circle ml-6 mt-1 space-y-1">
                  <li>Partial use of the subscription period</li>
                  <li>Change of mind</li>
                  <li>Business slowdown</li>
                  <li>Failure to use the system</li>
                  <li>Team resignation or internal staffing changes</li>
                  <li>Lack of technical knowledge</li>
                </ul>
              </li>
            </ul>
            <p className="mt-2 italic">
              Once access is granted, the service is considered delivered.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              5. Early Cancellation
            </h2>
            <p>You may cancel your subscription at any time.</p>
            <p className="mt-2">However:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>Cancellation stops future billing only.</li>
              <li>
                No pro-rated refunds will be provided for the remaining unused
                period.
              </li>
              <li>
                Access remains active until the end of the paid billing cycle.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              6. Exceptional Refund Circumstances
            </h2>
            <p>Refunds may be considered only if:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>Duplicate payment is proven.</li>
              <li>Unauthorized billing is verified.</li>
              <li>
                Technical failure from our side results in total service
                inaccessibility for more than 7 consecutive days.
              </li>
            </ul>
            <p className="mt-2">
              Refund requests must be submitted within 7 days of the charge.
            </p>
            <p>Approval is at the sole discretion of ViaItinerary.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              7. Chargebacks & Payment Disputes
            </h2>
            <p>
              Initiating a chargeback without first contacting us may result in:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>Immediate account suspension.</li>
              <li>Permanent termination.</li>
              <li>Legal recovery action for unpaid amounts.</li>
            </ul>
            <p className="mt-2">
              We encourage users to contact support before filing disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              8. Subscription Downgrades
            </h2>
            <p>If you downgrade your plan:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>Changes will apply at the next billing cycle.</li>
              <li>
                No partial refunds will be issued for the current billing
                period.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              9. Enterprise & Custom Contracts
            </h2>
            <p>
              Enterprise clients operating under a signed service agreement
              shall follow refund and cancellation terms outlined in their
              executed contract.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              10. Currency & International Payments
            </h2>
            <p>Refunds (if approved) will be processed:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>In the original payment method.</li>
              <li>In the original transaction currency.</li>
              <li>Net of any transaction or processing fees.</li>
            </ul>
            <p className="mt-2">
              We are not responsible for foreign exchange fluctuations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              11. Policy Updates
            </h2>
            <p>
              ViaItinerary reserves the right to modify this Policy at any time.
            </p>
            <p>
              Continued use of the Platform constitutes acceptance of updates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-[#1a1c1c] mb-4">
              12. Contact for Refund Requests
            </h2>
            <p>All refund requests must be submitted in writing to:</p>
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

export default RefundPolicy;
