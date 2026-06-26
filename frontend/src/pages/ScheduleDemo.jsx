import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  Send,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { submitDemoRequest } from "../api/demo";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import DatePicker from "../components/common/DatePicker";

const ScheduleDemo = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact_number: "",
    invite_guests: "",
    company_name: "",
    no_of_employees: "",
    agency_type: "",
    destinations: "",
    processes: [],
    office_location: "",
    referral_source: "",
    scheduled_at: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const agencyTypes = [
    "DMC",
    "Travel Agency",
    "Tour Operator",
    "B2B Wholesaler",
    "Corporate Travel",
  ];

  const discoverySources = [
    "Google Search",
    "Social Media",
    "Referral",
    "Email",
    "Other",
  ];

  const automationProcesses = [
    "Itinerary Builder",
    "Reservations & Tour Operations",
    "Payment Tracking & Collection",
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (process) => {
    setFormData((prev) => ({
      ...prev,
      processes: prev.processes.includes(process)
        ? prev.processes.filter((p) => p !== process)
        : [...prev.processes, process],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formData.processes.length === 0) {
        throw new Error("Please select at least one process to automate.");
      }

      const response = await submitDemoRequest(formData);

      if (response.status === "success" || response.id) {
        setSubmitted(true);
        window.scrollTo(0, 0);
      } else {
        throw new Error(
          response.message || "Something went wrong. Please try again.",
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Failed to submit request. Please check your connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50"
          >
            {submitted ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">
                  Request Received!
                </h2>
                <p className="text-xl text-slate-600 mb-8 max-w-md italic">
                  Thank you for your interest. We'll get back to you shortly to
                  schedule your personalized demo.
                </p>
                <Link
                  to="/"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25"
                >
                  Return to Home
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-10">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">
                    Schedule a Demo
                  </h1>
                  <p className="text-slate-600 font-medium text-lg">
                    See how we can help you scale your travel business. Fill out
                    the form below and we'll reach out to you.
                  </p>
                </div>

                {error && (
                  <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium italic">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Name */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Name *
                      </label>
                      <input
                        required
                        name="name"
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Your Name"
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    {/* Email */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Email *
                      </label>
                      <input
                        required
                        name="email"
                        type="email"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="work@company.com"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Contact Number */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Contact Number *
                      </label>
                      <div className="phone-input-container">
                        <PhoneInput
                          defaultCountry="in"
                          value={formData.contact_number}
                          onChange={(phone) =>
                            setFormData((prev) => ({
                              ...prev,
                              contact_number: phone,
                            }))
                          }
                          inputClassName="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all"
                          containerClassName="w-full"
                          className="w-full"
                        />
                      </div>
                    </div>
                    {/* Invite Guest(s) */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                        Invite Guest(s)
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-500 uppercase tracking-wider font-bold">
                          Optional
                        </span>
                      </label>
                      <input
                        name="invite_guests"
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Add guest emails"
                        value={formData.invite_guests}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Date and Time Picker */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Pick a Date & Time *
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2.5">
                        <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Preferred Date & Time
                        </label>
                        <DatePicker
                          enableTime={true}
                          required
                          value={formData.scheduled_at}
                          onChange={(dateString) => {
                            setFormData((prev) => ({
                              ...prev,
                              scheduled_at: dateString,
                            }));
                          }}
                          placeholder="Select Date & Time"
                          options={{
                            dateFormat: "d-m-Y H:i",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Company Name */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Company Name *
                      </label>
                      <input
                        required
                        name="company_name"
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Company Name"
                        value={formData.company_name}
                        onChange={handleInputChange}
                      />
                    </div>
                    {/* No of Employees */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        No of Employees *
                      </label>
                      <input
                        required
                        name="no_of_employees"
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g. 10"
                        value={formData.no_of_employees}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Agency Type */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">
                      Specify the type of Travel agency *
                    </label>
                    <div className="relative">
                      <select
                        required
                        name="agency_type"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        value={formData.agency_type}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        {agencyTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Destinations */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">
                      Name of Destinations you serve *
                    </label>
                    <textarea
                      required
                      name="destinations"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-none"
                      placeholder="Enter destinations..."
                      value={formData.destinations}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Processes */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 ml-1 block">
                      Processes you want to automate with Software *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      {automationProcesses.map((process) => (
                        <label
                          key={process}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            className="w-5 h-5 border-slate-300 rounded-md bg-white text-blue-600 focus:ring-blue-500/20 transition-all"
                            checked={formData.processes.includes(process)}
                            onChange={() => handleCheckboxChange(process)}
                          />
                          <span className="text-slate-600 group-hover:text-slate-900 font-medium transition-colors">
                            {process}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Office Location */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">
                      Office Location *
                    </label>
                    <input
                      required
                      name="office_location"
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="City, Country"
                      value={formData.office_location}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Referral Source */}
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">
                      How did you first hear about us? *
                    </label>
                    <div className="relative">
                      <select
                        required
                        name="referral_source"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                        value={formData.referral_source}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Option</option>
                        {discoverySources.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-black text-lg py-4.5 rounded-2xl flex items-center justify-center gap-3 transition-all mt-8 shadow-xl shadow-blue-600/25"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {loading ? "Submitting..." : "Schedule Appointment"}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ScheduleDemo;
