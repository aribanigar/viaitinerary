import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DatePicker from "../../components/common/DatePicker";
import {
  ArrowLeft,
  Plus,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  Users,
  Calendar,
  IndianRupee,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { createManualLeadInquiry } from "../../api/leadInquiries";
import { toast } from "react-toastify";

const CreateLead = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    destination: "",
    adults: 1,
    kids_cnb: 0,
    kids_5_to_12: 0,
    start_date: "",
    duration: "",
    approximate_budget: "",
    special_requests: "",
    status: "new",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createManualLeadInquiry(token, formData);
      toast.success("Lead created successfully");
      navigate("/lead-inquiries");
    } catch (error) {
      console.error("Error creating manual lead:", error);
      toast.error(error.message || "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses =
    "w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:outline-none text-slate-700 placeholder:text-slate-400 transition-all";
  const labelClasses = "block text-sm font-bold text-slate-700 mb-2 px-1";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 leading-tight">
                Add New Lead
              </h1>
              <p className="text-slate-400 font-medium mt-1">
                Create a new inquiry record for your agency
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/lead-inquiries")}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm w-fit"
              >
                Back to List
              </button>
              <button
                type="submit"
                form="create-lead-form"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all text-sm w-fit shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Lead
              </button>
            </div>
          </div>
        </div>

        <form
          id="create-lead-form"
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Client Info */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Client Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={labelClasses}>Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        required
                        value={formData.client_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            client_name: e.target.value,
                          })
                        }
                        className={`${inputClasses} pl-11`}
                        placeholder="Enter client's full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="email"
                        required
                        value={formData.client_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            client_email: e.target.value,
                          })
                        }
                        className={`${inputClasses} pl-11`}
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>Phone Number</label>
                    <div className="phone-input-container">
                      <PhoneInput
                        defaultCountry="in"
                        value={formData.client_phone}
                        onChange={(phone) =>
                          setFormData({
                            ...formData,
                            client_phone: phone,
                          })
                        }
                        inputClassName={inputClasses}
                        containerClassName="w-full"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-purple-500" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Trip Requirements
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className={labelClasses}>Destination *</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="text"
                        required
                        value={formData.destination}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            destination: e.target.value,
                          })
                        }
                        className={`${inputClasses} pl-11`}
                        placeholder="e.g. Bali, Indonesia"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className={labelClasses}>Adults</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="number"
                          min="1"
                          value={formData.adults}
                          onChange={(e) =>
                            setFormData({ ...formData, adults: e.target.value })
                          }
                          className={`${inputClasses} pl-11`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Kids (CNB)</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="number"
                          min="0"
                          value={formData.kids_cnb}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              kids_cnb: e.target.value,
                            })
                          }
                          className={`${inputClasses} pl-11`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Kids (5-12 yrs)</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="number"
                          min="0"
                          value={formData.kids_5_to_12}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              kids_5_to_12: e.target.value,
                            })
                          }
                          className={`${inputClasses} pl-11`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Start Date</label>
                      <DatePicker
                        value={formData.start_date}
                        onChange={(dateString) =>
                          setFormData({
                            ...formData,
                            start_date: dateString,
                          })
                        }
                        placeholder="Select Start Date"
                        className="w-full"
                        inputClassName={inputClasses}
                        options={{
                          dateFormat: "d-m-Y",
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Duration (Nights)</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="number"
                          min="1"
                          value={formData.duration}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              duration: e.target.value,
                            })
                          }
                          className={`${inputClasses} pl-11`}
                          placeholder="e.g. 5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Status & Budget */}
            <div className="space-y-8">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Lead Details
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className={labelClasses}>Budget Details</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input
                        type="number"
                        min="0"
                        value={formData.approximate_budget}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            approximate_budget: e.target.value,
                          })
                        }
                        className={`${inputClasses} pl-11`}
                        placeholder="Amount"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>
                      Special Requests / Details
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-slate-300" />
                      <textarea
                        rows={4}
                        value={formData.special_requests}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            special_requests: e.target.value,
                          })
                        }
                        className={`${inputClasses} pl-11 resize-none`}
                        placeholder="Describe client's requirements..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Remove bottom buttons as they are now in the header */}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default CreateLead;
