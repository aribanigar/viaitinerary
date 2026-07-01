import React from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  AlertCircle,
} from "lucide-react";

const PLAN_LABELS = {
  trial: "Trial",
  monthly: "Monthly",
  six_months: "6-Month",
  yearly: "Yearly",
};

/**
 * SubscriptionBanner
 * Reads the full subscription status object returned by GET /subscription/status
 * and renders the appropriate banner for the current account state.
 *
 * States handled:
 *  - bypass_subscription → violet   "Full Access"
 *  - trial (active)      → blue     "Trial Plan — X trips left"
 *  - trial (limit hit)   → amber    "Trial Limit Reached"
 *  - trial (expired)     → red      "Trial Expired"
 *  - paid (active)       → green    "Active: [Plan] — expires on …"
 *  - paid (expired)      → red      "Plan Expired"
 */
const SubscriptionBanner = ({ subscription }) => {
  if (!subscription) return null;

  const {
    plan_name,
    bypass_subscription,
    can_create_trip,
    is_trial_expired,
    trips_used,
    trips_limit,
    ends_at,
    trial_ends_at,
    status,
  } = subscription;

  const isTrial = plan_name === "trial";
  const isPaid = !isTrial && plan_name;
  const isExpiredPaid = isPaid && !can_create_trip;
  const trialLimitHit = isTrial && !can_create_trip && !is_trial_expired;
  const trialExpired = isTrial && is_trial_expired;
  const trialActive = isTrial && can_create_trip;
  const paidActive = isPaid && can_create_trip;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ── Bypass: full access granted by super admin ──────────────────────────
  if (bypass_subscription) {
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-violet-50 border border-violet-100 text-violet-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 fill-violet-500" />
          </div>
          <div className="text-sm font-medium">
            <strong>Full Access</strong> &mdash; All subscription restrictions
            have been removed for your account by an administrator.
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-600 shrink-0">
          Unrestricted
        </span>
      </div>
    );
  }

  // ── Paid active ──────────────────────────────────────────────────────────
  if (paidActive) {
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-green-50 border border-green-100 text-green-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium">
            <strong>{PLAN_LABELS[plan_name] ?? plan_name} Plan</strong> &mdash;
            Your subscription is active
            {ends_at ? ` and renews on ${formatDate(ends_at)}.` : "."}
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-600 shrink-0">
          Active
        </span>
      </div>
    );
  }

  // ── Paid expired ─────────────────────────────────────────────────────────
  if (isExpiredPaid) {
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-red-50 border border-red-100 text-red-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium">
            <strong>{PLAN_LABELS[plan_name] ?? plan_name} Plan Expired</strong>{" "}
            &mdash; Your plan expired on {formatDate(ends_at)}. Renew to restore
            full access.
          </div>
        </div>
        <Link
          to="/subscription"
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-600 text-white shrink-0 hover:bg-red-700 transition-colors"
        >
          Renew Now
        </Link>
      </div>
    );
  }

  // ── Trial active ─────────────────────────────────────────────────────────
  if (trialActive) {
    const tripsLeft = (trips_limit ?? 3) - (trips_used ?? 0);
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-blue-50 border border-blue-100 text-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium">
            <strong>Trial Plan</strong> &mdash; You have{" "}
            <strong>
              {tripsLeft} trip{tripsLeft !== 1 ? "s" : ""}
            </strong>{" "}
            remaining
            {trial_ends_at ? ` (trial ends ${formatDate(trial_ends_at)})` : ""}.
            Team members are locked on trial. Upgrade for full access.
          </div>
        </div>
        <Link
          to="/subscription"
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#c7f135] text-[#10182a] shrink-0 hover:bg-[#b0dc00] transition-colors"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  // ── Trial limit reached ───────────────────────────────────────────────────
  if (trialLimitHit) {
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-amber-50 border border-amber-100 text-amber-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium">
            <strong>Trial Limit Reached</strong> &mdash; You&apos;ve used all{" "}
            {trips_limit ?? 3} trial trips. Upgrade your plan to create more
            trips and add team members.
          </div>
        </div>
        <Link
          to="/subscription"
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500 text-white shrink-0 hover:bg-amber-600 transition-colors"
        >
          Upgrade Now
        </Link>
      </div>
    );
  }

  // ── Trial expired (time) ──────────────────────────────────────────────────
  if (trialExpired) {
    return (
      <div className="mb-8 p-4 rounded-2xl flex items-center justify-between bg-red-50 border border-red-100 text-red-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium">
            <strong>Trial Expired</strong> &mdash; Your 3-day trial ended on{" "}
            {formatDate(trial_ends_at)}. Upgrade to continue creating trips and
            adding team members.
          </div>
        </div>
        <Link
          to="/subscription"
          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-600 text-white shrink-0 hover:bg-red-700 transition-colors"
        >
          Upgrade Now
        </Link>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
