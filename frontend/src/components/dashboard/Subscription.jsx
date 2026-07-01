import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  Check,
  Zap,
  Shield,
  Star,
  Crown,
  User,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import Loader from "../common/Loader";
import { toast } from "react-toastify";

let razorpayScriptPromise;

const loadRazorpayScript = () => {
  if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
    return Promise.resolve(true);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.setAttribute("data-razorpay", "true");
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

const detectCountryCode = () => {
  try {
    const locale =
      navigator?.languages?.[0] ||
      navigator?.language ||
      navigator?.userLanguage;

    if (!locale) {
      return "IN";
    }

    const normalized = locale.replace("_", "-");
    const parts = normalized.split("-");
    const region = parts.length > 1 ? parts[parts.length - 1] : "";

    return region ? region.toUpperCase() : "IN";
  } catch {
    return "IN";
  }
};

const Subscription = () => {
  const { token, user } = useAuth();
  const { targetMember, clearSubscriptionTarget } = useSubscription();
  const [searchParams] = useSearchParams();

  // member_user_id from URL is the primary source (survives refresh / direct navigation).
  // Context (targetMember) provides display metadata (name, email).
  const memberUserId =
    searchParams.get("member_user_id") ??
    (targetMember?.user_id != null ? String(targetMember.user_id) : null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [countryCode, setCountryCode] = useState(detectCountryCode);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

  useEffect(() => {
    loadRazorpayScript().catch(() => false);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        if (memberUserId) {
          params.set("member_user_id", memberUserId);
        }
        if (countryCode) {
          params.set("country", countryCode);
        }
        const query = params.toString();
        const url = query
          ? `/subscription/status?${query}`
          : `/subscription/status`;

        const response = await fetch(`${API_URL}${url}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-Country-Code": countryCode,
          },
        });
        const data = await response.json();

        // If data contains available_plans, use it. Otherwise, if it's an error but we need plans,
        // we might want a separate endpoint, but for now we ensure state is set.
        if (data && (data.available_plans || data.active_offer !== undefined)) {
          setSubscription(data);
          if (data.country && data.country !== countryCode) {
            setCountryCode(data.country);
          }
        } else {
          console.error("Incomplete data received:", data);
          // Optional: handle showing an error if no plans at all
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchData();
    } else {
      // If no token, we still want to try to show plans if possible
      // (though this page is protected, just in case)
      setLoading(false);
    }

    return () => {
      clearSubscriptionTarget();
    };
  }, [token, memberUserId, countryCode]);

  const calculateTotalCost = (plan, seatsNeeded) => {
    // Look up the actual price from the API response configuration
    const planConfig = subscription?.available_plans?.[plan.key];
    const pricePerUser =
      planConfig?.price || parseInt(plan.price.toString().replace(/,/g, ""));
    return Number(pricePerUser).toLocaleString();
  };

  const handleUpgrade = async (planKey) => {
    if (typeof window.Razorpay !== "function") {
      console.error("Razorpay script not loaded. Checking...");
      toast.error("Payment system is loading. Please try again in a moment.");

      // Try to reload the Razorpay script
      setTimeout(() => {
        if (typeof window.Razorpay === "function") {
          toast.success("Payment system ready. You can try again now.");
        } else {
          toast.error(
            "Payment system failed to load. Please refresh the page.",
          );
        }
      }, 2000);
      return;
    }

    console.log("Initiating payment for plan:", planKey);
    setProcessingPlan(planKey);
    try {
      const payload = {
        plan: planKey,
        country: countryCode || subscription?.country || null,
      };
      if (memberUserId) {
        payload.member_user_id = Number(memberUserId);
      } else if (subscription?.seats_needed) {
        payload.seats_needed = subscription.seats_needed;
      }

      // 1. Create Order on Backend
      console.log("Creating Razorpay order with payload:", payload);
      const orderResponse = await fetch(`${API_URL}/razorpay/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let orderData;
      try {
        orderData = await orderResponse.json();
        console.log("Order response:", orderData);
      } catch {
        console.error("Failed to parse order response");
        throw new Error("Invalid response from server. Please try again.");
      }

      if (!orderResponse.ok) {
        throw new Error(
          orderData.error ||
            orderData.message ||
            "Failed to create payment order",
        );
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ViaItinerary",
        order_id: orderData.order_id,
        prefill: {
          // Use target member details when subscribing for a member,
          // otherwise fall back to the authenticated user's info.
          name: (targetMember?.name || user?.name || "").trim(),
          email: (targetMember?.email || user?.email || "").trim(),
          contact: String(
            targetMember?.phone ||
              targetMember?.contact ||
              user?.phone ||
              user?.contact ||
              "",
          ).replace(/\D/g, ""),
        },
        handler: async function (response) {
          try {
            // 3. Verify Payment on Backend
            const verifyResponse = await fetch(
              `${API_URL}/razorpay/verify-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: planKey,
                  country: countryCode || subscription?.country || null,
                  member_user_id: memberUserId ? Number(memberUserId) : null,
                }),
              },
            );

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok) {
              if (memberUserId) {
                toast.success(
                  `Successfully subscribed ${targetMember?.name || "member"} to ${planKey} plan.`,
                );
                clearSubscriptionTarget();
                window.location.href = "/team";
              } else {
                toast.success(`Successfully upgraded to ${planKey}!`);
                setSubscription((prev) => ({
                  ...prev,
                  plan_name: planKey,
                  can_create_trip: true,
                  status: "active",
                }));
              }
            } else {
              throw new Error(
                verifyData.message || "Payment verification failed",
              );
            }
          } catch (err) {
            toast.error(err.message);
          }
        },
        theme: {
          color: "#0f172a", // Match your slate-900 theme
        },
      };

      const rzp1 = new window.Razorpay(options);

      rzp1.on("payment.failed", function (response) {
        console.error("Razorpay payment failed:", response);
        toast.error(
          `Payment failed: ${response.error.description || response.error.reason || "Unknown error"}`,
        );
        setProcessingPlan(null);
      });

      // Add error handler for checkout loading issues
      try {
        rzp1.open();
      } catch (openError) {
        console.error("Failed to open Razorpay checkout:", openError);
        toast.error(
          "Failed to open payment window. Please try again or use a different browser.",
        );
        setProcessingPlan(null);
      }
    } catch (err) {
      console.error("Payment initialization error:", err);
      toast.error(err.message || "Failed to initialize payment");
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading)
    return (
      <DashboardLayout>
        <Loader text="Loading plans..." />
      </DashboardLayout>
    );

  const pansRaw = subscription?.available_plans
    ? Object.values(subscription.available_plans)
    : [];

  // If there's an active offer that isn't already in standard plans
  if (
    subscription?.active_offer &&
    !pansRaw.find((p) => p.key === subscription.active_offer.key)
  ) {
    pansRaw.unshift(subscription.active_offer);
  }

  // If currently on a plan that is not in any list (legacy plan)
  if (
    subscription?.plan?.plan_name &&
    !pansRaw.find((p) => p.key === subscription.plan.plan_name)
  ) {
    pansRaw.unshift({
      key: subscription.plan.plan_name,
      name: subscription.plan.plan_name.replace(/_/g, " "),
      price: 0, // We don't know the price of legacy plans
      duration_months: 0,
      features: ["Active Subscription", "Legacy Plan Support"],
      is_legacy: true,
    });
  }

  const plans = pansRaw.map((plan) => ({
    key: plan.key,
    name: plan.name,
    price: plan.price ? plan.price.toString() : "0",
    original_price: plan.original_price ? plan.original_price.toString() : null,
    period:
      plan.duration_months === 1
        ? "per user / month"
        : plan.duration_months === 0
          ? "active"
          : `per user / ${plan.duration_months} months`,
    icon:
      plan.key === "yearly" ? (
        <Crown className="w-6 h-6 text-amber-500" />
      ) : plan.key === "six_months" ? (
        <Star className="w-6 h-6 text-purple-500" />
      ) : plan.is_offer ? (
        <Zap className="w-6 h-6 text-emerald-500" />
      ) : (
        <Zap className="w-6 h-6 text-blue-500" />
      ),
    features: Array.isArray(plan.features)
      ? plan.features
      : typeof plan.features === "string"
        ? JSON.parse(plan.features)
        : [
            "Unlimited Trip Creation",
            "PDF Itinerary Downloads",
            "Team Collaboration",
            "Priority Support",
          ],
    color:
      plan.key === "yearly"
        ? "amber"
        : plan.key === "six_months"
          ? "purple"
          : plan.is_offer
            ? "emerald"
            : "blue",
    recommended: !!plan.recommended || !!plan.is_offer,
    badge_label: plan.badge_label || (plan.is_offer ? "SPECIAL OFFER" : null),
    is_legacy: !!plan.is_legacy,
    is_active_plan:
      subscription?.plan?.plan_name === plan.key &&
      !subscription?.plan?.is_expired &&
      !subscription?.plan?.is_trial,
    is_expired:
      subscription?.plan?.plan_name === plan.key &&
      subscription?.plan?.is_expired,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {memberUserId && (
          <div className="mb-8 flex items-center justify-between bg-blue-50 border border-blue-100 p-6 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#c7f135] flex items-center justify-center text-white shadow-lg shadow-[#c7f135]/40">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Subscribing for{" "}
                  {targetMember?.name || `Member #${memberUserId}`}
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Team Member:{" "}
                  {targetMember?.email || `user_id = ${memberUserId}`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-16">
          <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">
            Pricing
          </h2>
          <p className="mt-2 text-4xl font-black text-slate-900 sm:text-5xl">
            {memberUserId
              ? "Select a plan for your team member"
              : "Choose the right plan for your business"}
          </p>
          <p className="mt-3 text-xs text-slate-500 font-semibold uppercase tracking-widest">
            Showing prices for country:{" "}
            {subscription?.country || countryCode || "GLOBAL"}
          </p>
          {!memberUserId && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="max-w-2xl text-xl text-slate-500 mx-auto font-medium">
                Currently on:{" "}
                <span
                  className={`font-bold uppercase ${subscription?.plan?.is_expired ? "text-red-500" : "text-blue-600"}`}
                >
                  {subscription?.plan?.plan_name || "Free/Trial"}
                </span>
              </p>
              {subscription?.plan?.expires_at &&
                !subscription?.plan?.is_trial && (
                  <p className="text-sm text-slate-400 font-bold flex items-center gap-1.5 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 uppercase tracking-widest">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Expires:{" "}
                    {new Date(subscription.plan.expires_at).toLocaleDateString(
                      undefined,
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </p>
                )}
              {subscription?.plan?.is_expired && (
                <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full border border-red-100">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Subscription Expired
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative bg-white rounded-xl border-2 ${
                plan.recommended
                  ? "border-[#c7f135] shadow-2xl shadow-[#c7f135]/40"
                  : "border-slate-100 shadow-xl shadow-slate-200/50"
              } p-8 flex flex-col transition-all hover:scale-[1.02]`}
            >
              {(plan.recommended || plan.badge_label) && (
                <div className="absolute top-0 right-8 transform -translate-y-1/2">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-[#c7f135] text-white shadow-lg">
                    {plan.badge_label || (plan.recommended ? "BEST VALUE" : "")}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl bg-${plan.color}-50`}>
                  {plan.icon}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {plan.name}
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    {plan.is_legacy ? (
                      "Active"
                    ) : (
                      <>
                        ₹{" "}
                        {memberUserId
                          ? Number(
                              plan.price || plan.original_price,
                            ).toLocaleString()
                          : subscription?.seats_needed
                            ? calculateTotalCost(
                                plan,
                                subscription.seats_needed,
                              )
                            : Number(
                                plan.price || plan.original_price,
                              ).toLocaleString()}
                      </>
                    )}
                  </span>

                  {!plan.is_legacy &&
                    plan.original_price &&
                    Number(plan.original_price) > Number(plan.price) && (
                      <div className="flex flex-col ml-3">
                        <span className="text-slate-400 line-through text-sm font-bold opacity-75">
                          ₹{Number(plan.original_price).toLocaleString()}
                        </span>
                        <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-md mt-0.5">
                          {Math.round(
                            ((Number(plan.original_price) -
                              Number(plan.price)) /
                              Number(plan.original_price)) *
                              100,
                          )}
                          % OFF
                        </span>
                      </div>
                    )}
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-2">
                  {memberUserId
                    ? plan.period
                    : subscription?.seats_needed
                      ? plan.period
                      : plan.period}
                </p>
                {!memberUserId && subscription?.seats_needed > 1 && (
                  <p className="text-slate-500 text-xs mt-1">
                    Select a plan to upgrade your business
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-10 grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="mt-1 p-0.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-slate-600 text-[14px] font-medium">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={
                  processingPlan !== null ||
                  plan.is_active_plan ||
                  (memberUserId && plan.is_active_plan && subscription?.is_paid)
                }
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  plan.is_active_plan ||
                  (memberUserId && plan.is_active_plan && subscription?.is_paid)
                    ? plan.color === "emerald"
                      ? "bg-emerald-100 text-emerald-600 cursor-not-allowed shadow-none"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                    : plan.color === "emerald"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-900/10 active:scale-95"
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 active:scale-95"
                } disabled:opacity-50`}
              >
                {processingPlan === plan.key
                  ? "Processing..."
                  : plan.is_active_plan ||
                      (memberUserId &&
                        plan.is_active_plan &&
                        subscription?.is_paid)
                    ? "Current Plan"
                    : memberUserId
                      ? "Subscribe Member"
                      : plan.color === "emerald"
                        ? "Claim Offer Now"
                        : "Upgrade Now"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-20 p-10 bg-slate-900 rounded-xl text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-white/10 rounded-xl">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black">Per-User Pricing</h3>
              <p className="text-slate-400 font-medium">
                Pay for each team member. Current team size:{" "}
                {subscription?.seats_needed || 1} user
                {subscription?.seats_needed > 1 ? "s" : ""}. Add team members
                and upgrade to unlock full access.
              </p>
            </div>
          </div>
          <p className="text-slate-400 text-sm max-w-xs text-center md:text-right font-medium">
            Payment handled securely via Razorpay. Choose your plan to proceed.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Subscription;
