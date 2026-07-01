import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

const SuperAdminPlans = () => {
  const { token } = useAuth();
  const [plans, setPlans] = useState([]);
  const [countryOptions, setCountryOptions] = useState([
    { code: "", name: "Global (All Countries)" },
  ]);
  const [countrySearch, setCountrySearch] = useState("");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    price: "",
    original_price: "",
    duration_months: "",
    trip_limit: "",
    hotel_limit: "",
    cab_limit: "",
    destination_limit: "",
    features: [""],
    badge_label: "",
    recommended: false,
    is_active: true,
    is_offer: false,
    offer_starts_at: "",
    offer_expires_at: "",
    team_member_limit: "",
    offer_image_file: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadCountries = async () => {
      try {
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=cca2,name",
        );
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
          throw new Error("Unable to load country list");
        }

        const mapped = data
          .filter((country) => country?.cca2 && country?.name?.common)
          .map((country) => ({
            code: country.cca2.toUpperCase(),
            name: country.name.common,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (isMounted) {
          setCountryOptions([
            { code: "", name: "Global (All Countries)" },
            ...mapped,
          ]);
        }
      } catch (error) {
        if (isMounted) {
          setCountryOptions([
            { code: "", name: "Global (All Countries)" },
            { code: "IN", name: "India" },
            { code: "US", name: "United States" },
            { code: "AE", name: "United Arab Emirates" },
            { code: "GB", name: "United Kingdom" },
            { code: "SG", name: "Singapore" },
          ]);
        }
      }
    };

    loadCountries();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleStatus = async (plan) => {
    try {
      setPlans(
        plans.map((p) =>
          p.id === plan.id ? { ...p, is_active: !p.is_active } : p,
        ),
      );
      const resp = await fetch(`${API_URL}/plans/${plan.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...plan,
          is_active: !plan.is_active,
        }),
      });
      if (!resp.ok) throw new Error("Failed to update status");
    } catch (err) {
      toast.error(err.message);
      fetchPlans();
    }
  };

  const handleEdit = (plan) => {
    let parsedFeatures = [""];
    if (plan.features) {
      if (Array.isArray(plan.features)) {
        parsedFeatures = plan.features;
      } else if (typeof plan.features === "string") {
        try {
          const secondParse = JSON.parse(plan.features);
          parsedFeatures = Array.isArray(secondParse)
            ? secondParse
            : [plan.features];
        } catch (e) {
          parsedFeatures = [plan.features];
        }
      }
    }

    const selectedCountryCode = plan.country || "";
    const selectedCountryOption = countryOptions.find(
      (option) => option.code === selectedCountryCode,
    );

    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      country: selectedCountryCode,
      price: plan.price,
      original_price: plan.original_price || "",
      duration_months: plan.duration_months,
      trip_limit: plan.trip_limit || "",
      hotel_limit: plan.hotel_limit || "",
      cab_limit: plan.cab_limit || "",
      destination_limit: plan.destination_limit || "",
      features: parsedFeatures.length > 0 ? parsedFeatures : [""],
      badge_label: plan.badge_label || "",
      recommended: plan.recommended || false,
      is_active: plan.is_active,
      is_offer: plan.is_offer || false,
      offer_starts_at: plan.offer_starts_at
        ? plan.offer_starts_at.split("T")[0]
        : "",
      offer_expires_at: plan.offer_expires_at
        ? plan.offer_expires_at.split("T")[0]
        : "",
      team_member_limit: plan.team_member_limit || "",
      offer_image_file: null,
    });
    setCountrySearch(
      selectedCountryOption?.name ||
        (selectedCountryCode ? selectedCountryCode : "Global (All Countries)"),
    );
    setIsCountryDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleAddFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, ""],
    });
  };

  const handleRemoveFeature = (index) => {
    const newFeatures = [...formData.features];
    newFeatures.splice(index, 1);
    setFormData({
      ...formData,
      features: newFeatures.length > 0 ? newFeatures : [""],
    });
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({
      ...formData,
      features: newFeatures,
    });
  };

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

  const fetchPlans = async () => {
    try {
      const resp = await fetch(`${API_URL}/plans`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const data = await resp.json();
      if (resp.ok) {
        setPlans(data);
      } else {
        throw new Error(data.message || "Failed to fetch plans");
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPlans();
  }, [token]);

  const filteredCountryOptions = countryOptions.filter((option) => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      option.name.toLowerCase().includes(query) ||
      option.code.toLowerCase().includes(query)
    );
  });

  const handleCountrySelect = (option) => {
    setFormData((prev) => ({ ...prev, country: option.code }));
    setCountrySearch(option.name);
    setIsCountryDropdownOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingId
        ? `${API_URL}/plans/${editingId}`
        : `${API_URL}/plans`;
      const method = "POST"; // Use POST + _method=PUT for multipart updates

      const form = new FormData();

      // Basic fields
      form.append("name", formData.name);
      form.append("country", formData.country || "");
      form.append("original_price", formData.original_price);
      form.append("price", formData.price || "");
      form.append("duration_months", formData.duration_months);
      form.append("trip_limit", formData.trip_limit || "");
      form.append("hotel_limit", formData.hotel_limit || "");
      form.append("cab_limit", formData.cab_limit || "");
      form.append("destination_limit", formData.destination_limit || "");
      form.append("badge_label", formData.badge_label || "");
      form.append("recommended", formData.recommended ? "1" : "0");
      form.append("is_active", formData.is_active ? "1" : "0");
      form.append("is_offer", formData.is_offer ? "1" : "0");
      form.append("offer_starts_at", formData.offer_starts_at || "");
      form.append("offer_expires_at", formData.offer_expires_at || "");
      form.append("team_member_limit", formData.team_member_limit || "");

      // Handle features nested array
      formData.features.forEach((feature, index) => {
        form.append(`features[${index}]`, feature);
      });

      // Handle file
      if (formData.offer_image_file) {
        form.append("offer_image_file", formData.offer_image_file);
      }

      // Method spoofing for PUT
      if (editingId) {
        form.append("_method", "PUT");
      }

      if (!editingId) {
        form.append("key", formData.name.toLowerCase().replace(/\s+/g, "_"));
      }

      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      const data = await resp.json();

      if (resp.ok) {
        toast.success(`Plan ${editingId ? "updated" : "created"} successfully`);
        setIsModalOpen(false);
        setEditingId(null);
        setCountrySearch("Global (All Countries)");
        setIsCountryDropdownOpen(false);
        setFormData({
          name: "",
          country: "",
          price: "",
          original_price: "",
          duration_months: "",
          trip_limit: "",
          hotel_limit: "",
          cab_limit: "",
          destination_limit: "",
          features: [""],
          badge_label: "",
          recommended: false,
          is_active: true,
          is_offer: false,
          offer_starts_at: "",
          offer_expires_at: "",
          team_member_limit: "",
          offer_image_file: null,
        });
        fetchPlans();
      } else {
        throw new Error(data.message || "Failed to save plan");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this plan?")) return;

    try {
      const resp = await fetch(`${API_URL}/plans/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (resp.ok) {
        toast.success("Plan deleted successfully");
        fetchPlans();
      } else {
        const data = await resp.json();
        throw new Error(data.message || "Failed to delete plan");
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Subscription Plans
            </h1>
            <p className="text-slate-500 mt-1">
              Manage packages available for businesses
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setCountrySearch("Global (All Countries)");
              setIsCountryDropdownOpen(false);
              setFormData({
                name: "",
                country: "",
                price: "",
                original_price: "",
                duration_months: "",
                trip_limit: "",
                hotel_limit: "",
                cab_limit: "",
                destination_limit: "",
                features: [""],
                badge_label: "",
                recommended: false,
                is_active: true,
                is_offer: false,
                offer_starts_at: "",
                offer_expires_at: "",
                team_member_limit: "",
                offer_image_file: null,
              });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Plan</span>
          </button>
        </div>

        {/* Plans Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="mt-4 text-slate-500 font-medium">Loading plans...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Plans Yet</h3>
            <p className="text-slate-500 mt-1 max-w-xs">
              Create your first subscription package to start onboarding
              businesses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 transition-all p-6 shadow-sm flex flex-col ${
                  plan.is_active
                    ? "border-slate-100 hover:border-blue-200"
                    : "border-slate-100 opacity-75"
                } ${plan.recommended ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
              >
                {plan.badge_label && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">
                    {plan.badge_label}
                  </div>
                )}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 uppercase tracking-wider">
                        {plan.key}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                        {plan.country || "GLOBAL"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {plan.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Plan"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">
                      ₹
                      {Number(
                        plan.price || plan.original_price,
                      ).toLocaleString()}
                    </span>{" "}
                    {plan.original_price &&
                      Number(plan.original_price) > Number(plan.price) && (
                        <span className="text-slate-400 line-through text-sm">
                          ₹{Number(plan.original_price).toLocaleString()}
                        </span>
                      )}{" "}
                    <span className="text-slate-500 text-sm">
                      / {plan.duration_months}{" "}
                      {plan.duration_months === 1 ? "month" : "months"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      Valid for {plan.duration_months} months
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-slate-600">
                      {plan.trip_limit
                        ? `${plan.trip_limit} trips included`
                        : "Unlimited trips!"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      {plan.features?.length || 0} Features active
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    {plan.is_active ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">
                          Active - Visible to Users
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-500">
                          Inactive - Hidden
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleStatus(plan)}
                  className={`mt-auto w-full py-2.5 rounded-xl font-bold transition-all border-2 ${
                    plan.is_active
                      ? "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  }`}
                >
                  {plan.is_active ? "Deactivate Plan" : "Activate Plan"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Plan"
          isEditing={!!editingId}
          submitting={submitting}
          onSubmit={handleSubmit}
        >
          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Display Name*
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Premium Monthly"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Country
              </label>
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setIsCountryDropdownOpen(false);
                  }
                }}
              >
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search and select country"
                    className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                    value={countrySearch}
                    onFocus={() => setIsCountryDropdownOpen(true)}
                    onChange={(e) => {
                      const query = e.target.value;
                      const normalizedQuery = query.trim().toLowerCase();

                      setCountrySearch(query);
                      setIsCountryDropdownOpen(true);

                      if (!normalizedQuery) {
                        setFormData((prev) => ({ ...prev, country: "" }));
                        return;
                      }

                      const exactMatch = countryOptions.find((option) => {
                        const normalizedCode = option.code.toLowerCase();
                        const normalizedName = option.name.toLowerCase();
                        const combined = option.code
                          ? `${option.name} (${option.code})`.toLowerCase()
                          : normalizedName;

                        return (
                          normalizedCode === normalizedQuery ||
                          normalizedName === normalizedQuery ||
                          combined === normalizedQuery
                        );
                      });

                      setFormData((prev) => ({
                        ...prev,
                        country: exactMatch ? exactMatch.code : "",
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsCountryDropdownOpen(false);
                      }

                      if (
                        e.key === "Enter" &&
                        isCountryDropdownOpen &&
                        filteredCountryOptions.length > 0
                      ) {
                        e.preventDefault();
                        handleCountrySelect(filteredCountryOptions[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Toggle country options"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isCountryDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {isCountryDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredCountryOptions.length > 0 ? (
                      filteredCountryOptions.map((option) => (
                        <button
                          type="button"
                          key={option.code || "GLOBAL"}
                          className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors flex items-center justify-between gap-2 ${
                            formData.country === option.code
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={() => handleCountrySelect(option)}
                        >
                          <span className="truncate">{option.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {option.code || "GLOBAL"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm font-medium text-slate-400">
                        No countries found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {filteredCountryOptions.length} matching countries
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                Choose Global to use this plan as the fallback for all
                countries.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Actual Price (INR)*
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="3000"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                    value={formData.original_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        original_price: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Discounted Price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="2500"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Duration (Months)*
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="1"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                  value={formData.duration_months}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_months: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Badge Label
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                  value={formData.badge_label}
                  onChange={(e) =>
                    setFormData({ ...formData, badge_label: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pb-1">
                Module Limits
              </label>
              <p className="text-[11px] text-slate-400 -mt-0.5 mb-1">
                Numeric caps per plan. Leave blank for unlimited.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "trip_limit", label: "Itineraries" },
                  { key: "hotel_limit", label: "Hotels" },
                  { key: "cab_limit", label: "Cabs" },
                  { key: "destination_limit", label: "Destinations" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Unlimited"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={formData[key]}
                      onChange={(e) =>
                        setFormData({ ...formData, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Team Member Limit
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g., 5"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                value={formData.team_member_limit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    team_member_limit: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block pb-1">
                Plan Features*
              </label>
              <div className="space-y-2">
                {(Array.isArray(formData.features)
                  ? formData.features
                  : [""]
                ).map((feature, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Priority Support"
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-medium text-slate-900"
                      value={feature}
                      onChange={(e) =>
                        handleFeatureChange(index, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="w-full py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all"
                >
                  <Plus className="w-4 h-4 inline-block mr-1" /> Add Feature
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recommended"
                  className="w-5 h-5 text-blue-600 rounded-lg border-slate-200 focus:ring-blue-500 transition-all cursor-pointer"
                  checked={formData.recommended}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recommended: e.target.checked,
                    })
                  }
                />
                <label
                  htmlFor="recommended"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none"
                >
                  Recommend
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-5 h-5 text-blue-600 rounded-lg border-slate-200 focus:ring-blue-500 transition-all cursor-pointer"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                />
                <label
                  htmlFor="is_active"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none"
                >
                  Active
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_offer"
                  className="w-5 h-5 text-blue-600 rounded-lg border-slate-200 focus:ring-blue-500 transition-all cursor-pointer"
                  checked={formData.is_offer}
                  onChange={(e) =>
                    setFormData({ ...formData, is_offer: e.target.checked })
                  }
                />
                <label
                  htmlFor="is_offer"
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none"
                >
                  IS OFFER
                </label>
              </div>
            </div>

            {formData.is_offer && (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      Offer Validity (Starts at)
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={formData.offer_starts_at}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          offer_starts_at: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      Offer Validity (Ends at)
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-bold text-slate-900"
                      value={formData.offer_expires_at}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          offer_expires_at: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    Offer Image (for Popup)
                  </label>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Accepted formats: JPG, JPEG, PNG, WebP
                  </p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl text-xs font-medium text-slate-900"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        offer_image_file: e.target.files[0],
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminPlans;
