import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { fetchDestinations } from "../../api/destinations";
import { generateItinerary, commitItinerary } from "../../api/itinerary";
import {
  Sparkles,
  MapPin,
  Users,
  Baby,
  CalendarDays,
  IndianRupee,
  Percent,
  Loader2,
  Hotel,
  Car,
  Gift,
  CheckCircle2,
  XCircle,
  Minus,
  Plus,
  ArrowRight,
} from "lucide-react";

const MEAL_PLANS = [
  { value: "", label: "Any meal plan" },
  { value: "room_only", label: "Room Only" },
  { value: "breakfast_only", label: "Breakfast Only" },
  { value: "breakfast_dinner", label: "Breakfast & Dinner" },
  { value: "all_meals", label: "All Meals" },
];

const Counter = ({ label, icon: Icon, value, onChange, min = 0 }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
      <Icon className="w-3.5 h-3.5" /> {label}
    </label>
    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-2.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-100 transition-colors"
      >
        <Minus className="w-3.5 h-3.5 text-slate-600" />
      </button>
      <span className="font-bold text-slate-900 w-6 text-center text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-100 transition-colors"
      >
        <Plus className="w-3.5 h-3.5 text-slate-600" />
      </button>
    </div>
  </div>
);

const TierCard = ({ tier, onChoose, choosing }) => {
  const c = tier.costBreakdown;
  const accentByKey = {
    budget: "border-slate-200",
    recommended: "border-[#e7f63c] ring-2 ring-[#e7f63c]/40",
    premium: "border-purple-200",
  };
  return (
    <div
      className={`bg-white rounded-2xl border ${accentByKey[tier.key] || "border-slate-200"} shadow-sm p-6 flex flex-col`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
          {tier.label}
        </h3>
        {tier.budgetFit === "under" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" /> Within Budget
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold">
            <XCircle className="w-3 h-3" /> Over by ₹{Math.round(tier.overBy).toLocaleString("en-IN")}
          </span>
        )}
      </div>

      <div className="text-3xl font-black text-slate-900 mb-1">
        ₹{Math.round(c.sellingPrice).toLocaleString("en-IN")}
      </div>
      <p className="text-[11px] text-slate-400 font-medium mb-5">
        for {tier.travelerCount} traveler{tier.travelerCount === 1 ? "" : "s"} ·{" "}
        {tier.nights} night{tier.nights === 1 ? "" : "s"}
      </p>

      <div className="space-y-2 mb-5">
        <div className="flex items-start gap-2.5 text-xs">
          <Hotel className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          {tier.hotel ? (
            <span className="text-slate-700 font-bold">
              {tier.hotel.name}
              <span className="text-slate-400 font-medium">
                {" "}
                · {tier.hotel.category ? `${tier.hotel.category}★` : "—"} ·{" "}
                {tier.rooms} room{tier.rooms === 1 ? "" : "s"}
              </span>
            </span>
          ) : (
            <span className="text-slate-300 italic">No matching hotel found</span>
          )}
        </div>
        <div className="flex items-start gap-2.5 text-xs">
          <Car className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          {tier.vehicle ? (
            <span className="text-slate-700 font-bold">{tier.vehicle.name}</span>
          ) : (
            <span className="text-slate-300 italic">No matching vehicle found</span>
          )}
        </div>
        {tier.complementary?.length > 0 && (
          <div className="flex items-start gap-2.5 text-xs">
            <Gift className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span className="text-slate-700 font-bold">
              {tier.complementary.map((s) => s.name).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl p-3 space-y-1 mb-5 text-[11px]">
        <div className="flex justify-between text-slate-500">
          <span>Hotel</span>
          <span className="font-bold text-slate-700">
            ₹{Math.round(c.hotelCost).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Vehicle</span>
          <span className="font-bold text-slate-700">
            ₹{Math.round(c.vehicleCost).toLocaleString("en-IN")}
          </span>
        </div>
        {c.activityCost > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>Activities</span>
            <span className="font-bold text-slate-700">
              ₹{Math.round(c.activityCost).toLocaleString("en-IN")}
            </span>
          </div>
        )}
        {c.complementaryCost > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>Complementary</span>
            <span className="font-bold text-slate-700">
              ₹{Math.round(c.complementaryCost).toLocaleString("en-IN")}
            </span>
          </div>
        )}
        {c.gstAmount > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>GST</span>
            <span className="font-bold text-slate-700">
              ₹{Math.round(c.gstAmount).toLocaleString("en-IN")}
            </span>
          </div>
        )}
        <div className="flex justify-between text-emerald-600 pt-1 border-t border-slate-100">
          <span>Your profit</span>
          <span className="font-bold">
            ₹{Math.round(c.profitAmount).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <button
        onClick={() => onChoose(tier.key)}
        disabled={choosing}
        className="mt-auto w-full flex items-center justify-center gap-2 bg-[#181c22] text-white py-3 rounded-2xl font-bold text-sm hover:bg-black transition-colors disabled:opacity-60"
      >
        {choosing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
        Choose {tier.label}
      </button>
    </div>
  );
};

const GenerateItinerary = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);

  const [form, setForm] = useState({
    destinationId: "",
    adults: 2,
    kids5to12: 0,
    kidsCnb: 0,
    days: 4,
    budget: "",
    profitType: "percentage",
    profitValue: 10,
    mealPlan: "",
  });

  const [generating, setGenerating] = useState(false);
  const [tiers, setTiers] = useState(null);

  const [chosenTierKey, setChosenTierKey] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    startDate: "",
  });
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoadingDestinations(true);
        const resp = await fetchDestinations(token, { per_page: 1000 });
        const india = (resp.data || []).filter(
          (d) => !d.country || d.country === "India",
        );
        setDestinations(india);
      } catch (error) {
        toast.error(error.message || "Failed to load destinations");
      } finally {
        setLoadingDestinations(false);
      }
    })();
  }, [token]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.destinationId) {
      toast.error("Pick a destination");
      return;
    }
    if (!form.budget || Number(form.budget) <= 0) {
      toast.error("Enter a budget");
      return;
    }
    try {
      setGenerating(true);
      setTiers(null);
      const resp = await generateItinerary(
        {
          destination_id: form.destinationId,
          adults: form.adults,
          kids_5_to_12: form.kids5to12,
          kids_cnb: form.kidsCnb,
          days: form.days,
          budget: form.budget,
          profit_type: form.profitType,
          profit_value: form.profitValue,
          meal_plan: form.mealPlan || undefined,
        },
        token,
      );
      setTiers(resp.tiers);
    } catch (error) {
      toast.error(error.message || "Failed to generate itinerary");
    } finally {
      setGenerating(false);
    }
  };

  const handleChoose = (tierKey) => {
    setChosenTierKey(tierKey);
  };

  const handleCommit = async (e) => {
    e.preventDefault();
    try {
      setCommitting(true);
      const resp = await commitItinerary(
        {
          destination_id: form.destinationId,
          adults: form.adults,
          kids_5_to_12: form.kids5to12,
          kids_cnb: form.kidsCnb,
          days: form.days,
          budget: form.budget,
          profit_type: form.profitType,
          profit_value: form.profitValue,
          meal_plan: form.mealPlan || undefined,
          tier_key: chosenTierKey,
          client_name: confirmForm.clientName || undefined,
          client_phone: confirmForm.clientPhone || undefined,
          client_email: confirmForm.clientEmail || undefined,
          start_date: confirmForm.startDate || undefined,
        },
        token,
      );
      toast.success("Itinerary created — opening in Trip Builder");
      navigate(`/trip-builder/${resp.trip_id}`);
    } catch (error) {
      toast.error(error.message || "Failed to create the itinerary");
      setCommitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#e7f63c]" /> Generate Itinerary
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Automatically pick hotels, a cab, and activities from your own
            catalog — within budget, at your margin. No AI, just your data.
          </p>
        </div>
        <button
          onClick={() => navigate("/my-trips")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Back to trips
        </button>
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-[#181c22]" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
              Trip Basics
            </h3>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
              Destination (India)
            </label>
            <select
              value={form.destinationId}
              onChange={(e) => setField("destinationId", e.target.value)}
              disabled={loadingDestinations}
              className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer disabled:cursor-not-allowed"
              required
            >
              <option value="">
                {loadingDestinations ? "Loading destinations…" : "Select a destination…"}
              </option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {!loadingDestinations && destinations.length === 0 && (
              <p className="text-[10px] text-red-500 font-bold mt-2 px-1">
                No destinations yet — add one first from the Destinations page.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Counter
              label="Adults"
              icon={Users}
              value={form.adults}
              min={1}
              onChange={(v) => setField("adults", v)}
            />
            <Counter
              label="Kids (5-12)"
              icon={Baby}
              value={form.kids5to12}
              onChange={(v) => setField("kids5to12", v)}
            />
            <Counter
              label="Kids (Under 5)"
              icon={Baby}
              value={form.kidsCnb}
              onChange={(v) => setField("kidsCnb", v)}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
              <CalendarDays className="w-3.5 h-3.5" /> Days
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={form.days}
              onChange={(e) => setField("days", parseInt(e.target.value, 10) || 1)}
              className="w-full sm:w-40 px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <IndianRupee className="w-4 h-4 text-[#181c22]" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
              Budget &amp; Profit
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                Client Budget (₹)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={(e) => setField("budget", e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                  placeholder="e.g. 80000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
                Profit
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-50 rounded-2xl p-1.5 shrink-0">
                  {[
                    { value: "percentage", label: "%", icon: Percent },
                    { value: "fixed", label: "₹", icon: IndianRupee },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField("profitType", opt.value)}
                      className={`flex items-center justify-center gap-1 w-11 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                        form.profitType === opt.value
                          ? "bg-[#181c22] text-white"
                          : "text-slate-500"
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  value={form.profitValue}
                  onChange={(e) => setField("profitValue", e.target.value)}
                  className="flex-1 px-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                  placeholder={form.profitType === "percentage" ? "e.g. 20" : "e.g. 16000"}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">
              Meal Plan Preference
            </label>
            <select
              value={form.mealPlan}
              onChange={(e) => setField("mealPlan", e.target.value)}
              className="w-full sm:w-64 px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 appearance-none cursor-pointer"
            >
              {MEAL_PLANS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#e7f63c] text-[#181c22] px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[#e7f63c]/40 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {generating ? "Generating…" : "Generate Itinerary"}
        </button>
      </form>

      {tiers && (
        <div className="mt-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 px-1">
            3 Package Options
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {tiers.map((tier) => (
              <TierCard
                key={tier.key}
                tier={tier}
                onChoose={handleChoose}
                choosing={chosenTierKey === tier.key && committing}
              />
            ))}
          </div>
        </div>
      )}

      {chosenTierKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-xl font-black text-slate-900 mb-1">
              Create the {tiers.find((t) => t.key === chosenTierKey)?.label} Itinerary
            </h2>
            <p className="text-slate-400 text-xs font-bold mb-6 uppercase tracking-wider">
              Client details are optional — add them now or later in Trip Builder
            </p>
            <form onSubmit={handleCommit} className="space-y-3">
              <input
                type="text"
                placeholder="Client name (optional)"
                value={confirmForm.clientName}
                onChange={(e) =>
                  setConfirmForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
              />
              <input
                type="text"
                placeholder="Client phone (optional)"
                value={confirmForm.clientPhone}
                onChange={(e) =>
                  setConfirmForm((prev) => ({ ...prev, clientPhone: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
              />
              <input
                type="email"
                placeholder="Client email (optional)"
                value={confirmForm.clientEmail}
                onChange={(e) =>
                  setConfirmForm((prev) => ({ ...prev, clientEmail: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
              />
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={confirmForm.startDate}
                  onChange={(e) =>
                    setConfirmForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={committing}
                  className="flex-1 bg-[#e7f63c] text-[#181c22] py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {committing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {committing ? "Creating…" : "Create Itinerary"}
                </button>
                <button
                  type="button"
                  onClick={() => setChosenTierKey(null)}
                  disabled={committing}
                  className="text-slate-500 font-bold text-sm px-4 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default GenerateItinerary;
