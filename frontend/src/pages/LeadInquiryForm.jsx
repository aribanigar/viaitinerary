import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  submitLeadInquiry,
  submitPublicLeadInquiry,
} from "../api/leadInquiries";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import bannerImg from "../assets/1317c3a6549106afbc99a737dff77704.jpg.jpeg";
import {
  Calendar,
  Users,
  MapPin,
  IndianRupee,
  MessageSquare,
  CheckCircle,
  Loader2,
  Phone,
  Plus,
  Minus,
} from "lucide-react";
import { toast } from "react-toastify";
import DatePicker from "../components/common/DatePicker";

const LeadInquiryForm = () => {
  useEffect(() => {
    // Add Poppins font for this page
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const [searchParams] = useSearchParams();
  const agencyId = searchParams.get("agency");
  const isIframe =
    searchParams.get("iframe") === "true" || window.self !== window.top;

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inquiryId, setInquiryId] = useState("");

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    destination: "",
    startDate: "",
    duration: "",
    adults: "1",
    kidsUpto5: "0",
    kids5to12: "0",
    approximateBudget: "",
    currency: "INR (₹)",
    specialRequests: "",
    website: "", // honeypot — must stay empty; bots fill it
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Simulate initial loading to ensure everything is ready
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isIframe) {
      const sendHeight = () => {
        // Automatically send the real document height instead of a hardcoded value
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: "setHeight", height }, "*");
      };

      // Send height on mount and after a small delay to ensure rendering
      sendHeight();
      const timer = setTimeout(sendHeight, 500);

      // Create an observer to watch for content changes
      const observer = new ResizeObserver(sendHeight);
      observer.observe(document.body);

      return () => {
        clearTimeout(timer);
        observer.disconnect();
      };
    }
  }, [isIframe, currentStep, submitted]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.clientName.trim()) {
        newErrors.clientName = "Name is required";
      }
      if (!formData.clientEmail.trim()) {
        newErrors.clientEmail = "Email is required";
      } else if (!/\S+@\S+\.\S+/.test(formData.clientEmail)) {
        newErrors.clientEmail = "Email is invalid";
      }
      if (!formData.clientPhone) {
        newErrors.clientPhone = "Phone number is required";
      } else if (!/^([0-9\s\-\+\(\)]*)$/.test(formData.clientPhone)) {
        newErrors.clientPhone = "Invalid phone number format";
      }
    }

    if (step === 2) {
      if (!formData.destination.trim()) {
        newErrors.destination = "Destination is required";
      }
      if (!formData.startDate) {
        newErrors.startDate = "Start date is required";
      }
      if (!formData.duration) {
        newErrors.duration = "Duration is required";
      }
      if (!formData.adults && parseInt(formData.adults) < 1) {
        newErrors.adults = "Number of adults is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    setLoading(true);

    try {
      // Prepare payload to include separate adults and kids counts
      const payload = {
        ...formData,
        adults: parseInt(formData.adults),
        kidsUpto5: parseInt(formData.kidsUpto5),
        kids5to12: parseInt(formData.kids5to12),
      };

      // If agencyId is present, submit to specific agency, otherwise submit as public inquiry
      const response = agencyId
        ? await submitLeadInquiry(agencyId, payload)
        : await submitPublicLeadInquiry(payload);
      setInquiryId(response.inquiry_id);
      setSubmitted(true);
      toast.success("Your trip inquiry has been submitted successfully!");
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      toast.error(
        error.message || "Failed to submit inquiry. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Remove the agencyId validation - form now works for both agency-specific and public inquiries

  if (isInitialLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f7f3ec" }}
      >
        <Loader2 className="w-12 h-12 text-[#2f3131] animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex flex-col ${isIframe ? "" : "pt-20"}`}>
        {!isIframe && <Navbar />}
        <div
          className="flex-grow flex items-center justify-center p-4"
          style={{ backgroundColor: "#f7f3ec" }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Thank You!
              </h2>
              <p className="text-gray-600 mb-4">
                Your trip inquiry has been submitted successfully.
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Your Inquiry ID</p>
                <p className="text-xl font-bold text-blue-600">{inquiryId}</p>
              </div>
              <p className="text-sm text-gray-500">
                The travel agency will contact you within 24 hours. Please check
                your email for confirmation.
              </p>
            </div>
          </div>
        </div>
        {!isIframe && <Footer />}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${isIframe ? "overflow-hidden" : "pt-20"}`}
      style={{ backgroundColor: "#f7f3ec" }}
    >
      {!isIframe && <Navbar />}

      <div className="flex-grow py-8 px-4" style={{ color: "#2f3131" }}>
        <div className="max-w-2xl mx-auto">
          {/* Hero Banner */}
          <div
            className="mb-8 relative h-32 md:h-40 flex items-center justify-center overflow-hidden rounded-2xl shadow-sm"
            style={{
              backgroundImage: `url(${bannerImg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
            <h1 className="relative text-2xl md:text-3xl font-bold text-white tracking-tight text-center px-4 leading-tight">
              Tell Us Your Travel Details And Get A Personalized Itinerary
              Instantly.
            </h1>
          </div>

          {/* Progress Indicator */}
          <div className="mb-12 relative px-4">
            <div className="absolute top-[calc(100%-20px)] left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full" />
            <div
              className="absolute top-[calc(100%-20px)] left-0 h-1 bg-[#2f3131] -translate-y-1/2 transition-all duration-500 rounded-full"
              style={{
                width: `${((currentStep - 1) / 2) * 100}%`,
              }}
            />

            <div className="relative flex justify-between items-end">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <p
                    className={`text-sm mb-3 font-bold transition-colors ${
                      currentStep === step ? "text-[#2f3131]" : "text-gray-500"
                    }`}
                  >
                    {step === 1 && "Contact"}
                    {step === 2 && "Trip Details"}
                    {step === 3 && "Preferences"}
                  </p>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all border-4 z-10 ${
                      currentStep >= step
                        ? "bg-white border-[#2f3131] text-[#2f3131] shadow-md"
                        : "bg-gray-100 border-gray-200 text-gray-400"
                    }`}
                  >
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit}>
              {/* Honeypot: hidden from real users; bots fill it and get silently rejected server-side */}
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: "none" }}
              />
              {/* Step 1: Contact Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Contact Information
                  </h2>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      autoComplete="name"
                      className={`w-full px-4 py-3 border ${
                        errors.clientName ? "border-red-500" : "border-gray-300"
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                      placeholder="John Doe"
                    />
                    {errors.clientName && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.clientName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="clientEmail"
                      value={formData.clientEmail}
                      onChange={handleChange}
                      autoComplete="email"
                      className={`w-full px-4 py-3 border ${
                        errors.clientEmail
                          ? "border-red-500"
                          : "border-gray-300"
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                      placeholder="john@example.com"
                    />
                    {errors.clientEmail && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.clientEmail}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="phone-input-container">
                      <PhoneInput
                        defaultCountry="in"
                        value={formData.clientPhone}
                        onChange={(phone) =>
                          setFormData((prev) => ({
                            ...prev,
                            clientPhone: phone,
                          }))
                        }
                        inputClassName={`w-full px-4 py-3 border-none rounded-lg focus:outline-none transition-all`}
                        containerClassName="w-full"
                        className="w-full"
                        autoComplete="tel"
                      />
                    </div>
                    {errors.clientPhone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.clientPhone}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="bg-[#1b1b1b] text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Trip Details */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Trip Details
                  </h2>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="inline w-4 h-4 mr-1" />
                      Destination *
                    </label>
                    <input
                      type="text"
                      name="destination"
                      value={formData.destination}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border ${
                        errors.destination
                          ? "border-red-500"
                          : "border-gray-300"
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                      placeholder="e.g., Paris, Tokyo, Bali"
                    />
                    {errors.destination && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.destination}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Calendar className="inline w-4 h-4 mr-1" />
                        Start Date *
                      </label>
                      <DatePicker
                        value={formData.startDate}
                        onChange={(dateString) => {
                          setFormData((prev) => ({
                            ...prev,
                            startDate: dateString,
                          }));
                          if (errors.startDate) {
                            setErrors((prev) => ({ ...prev, startDate: "" }));
                          }
                        }}
                        placeholder="Select Start Date"
                        options={{
                          dateFormat: "d-m-Y",
                        }}
                        className={errors.startDate ? "border-red-500" : ""}
                      />
                      {errors.startDate && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.startDate}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Duration (Nights) *
                      </label>
                      <input
                        type="number"
                        name="duration"
                        value={formData.duration}
                        onChange={handleChange}
                        min="1"
                        max="365"
                        className={`w-full px-4 py-3 border ${
                          errors.duration ? "border-red-500" : "border-gray-300"
                        } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        placeholder="e.g., 5"
                      />
                      {errors.duration && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.duration}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex flex-col gap-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          Number of Adults *
                        </label>
                        <div className="flex items-center gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 w-full justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = Math.max(
                                1,
                                parseInt(formData.adults || 0) - 1,
                              );
                              setFormData((prev) => ({
                                ...prev,
                                adults: newVal.toString(),
                              }));
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-gray-800 text-lg">
                            {formData.adults}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = parseInt(formData.adults || 0) + 1;
                              setFormData((prev) => ({
                                ...prev,
                                adults: newVal.toString(),
                              }));
                              if (errors.adults) {
                                setErrors((prev) => ({ ...prev, adults: "" }));
                              }
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex flex-col gap-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          Kids (CNB)
                        </label>
                        <div className="flex items-center gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 w-full justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = Math.max(
                                0,
                                parseInt(formData.kidsUpto5 || 0) - 1,
                              );
                              setFormData((prev) => ({
                                ...prev,
                                kidsUpto5: newVal.toString(),
                              }));
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-gray-800 text-lg">
                            {formData.kidsUpto5}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newVal =
                                parseInt(formData.kidsUpto5 || 0) + 1;
                              setFormData((prev) => ({
                                ...prev,
                                kidsUpto5: newVal.toString(),
                              }));
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex flex-col gap-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-600" />
                          Kids (5-12 yrs)
                        </label>
                        <div className="flex items-center gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 w-full justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const newVal = Math.max(
                                0,
                                parseInt(formData.kids5to12 || 0) - 1,
                              );
                              setFormData((prev) => ({
                                ...prev,
                                kids5to12: newVal.toString(),
                              }));
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-gray-800 text-lg">
                            {formData.kids5to12}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newVal =
                                parseInt(formData.kids5to12 || 0) + 1;
                              setFormData((prev) => ({
                                ...prev,
                                kids5to12: newVal.toString(),
                              }));
                            }}
                            className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {errors.adults && (
                      <p className="text-red-500 text-sm mt-[-1rem] md:col-span-2">
                        {errors.adults}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="bg-gray-100 text-[#2f3131] px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all flex items-center gap-2"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="bg-[#1b1b1b] text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Budget & Preferences */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Budget & Special Requests
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <IndianRupee className="inline w-4 h-4 mr-1" />
                        Approximate Budget
                      </label>
                      <input
                        type="number"
                        name="approximateBudget"
                        value={formData.approximateBudget}
                        onChange={handleChange}
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="50000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <MessageSquare className="inline w-4 h-4 mr-1" />
                      Special Requests or Preferences
                    </label>
                    <textarea
                      name="specialRequests"
                      value={formData.specialRequests}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      placeholder="Any specific requirements, activities you'd like to include, dietary restrictions, etc."
                    />
                  </div>

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="bg-gray-100 text-[#2f3131] px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all flex items-center gap-2"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#1b1b1b] text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Inquiry ✓"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Footer UI - replacing with actual Footer component */}
          <div className="text-center mt-8 text-sm text-gray-600">
            <p>
              Your information is secure and will only be used to provide you
              with travel quotes.
            </p>
          </div>
        </div>
      </div>
      {!isIframe && <Footer />}
    </div>
  );
};

export default LeadInquiryForm;
