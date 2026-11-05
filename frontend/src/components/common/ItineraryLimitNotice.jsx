import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchItineraryLimit } from "../../api/itineraryLimit";

/**
 * ItineraryLimitNotice
 * Warns an agency when its saved itineraries approach the platform limit.
 *  - soft level → amber notice, creating still works
 *  - hard level → red notice, new itineraries are blocked until some are deleted
 *
 * Pass a changing `refreshKey` to re-check after trips are deleted or duplicated.
 * Renders nothing when the limit is off, below the soft limit, or on any error.
 */
const ItineraryLimitNotice = ({ refreshKey = 0, showLink = true, compact = false }) => {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchItineraryLimit(token)
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  if (!status || !status.enabled || status.level === "none") return null;

  const isHard = status.level === "hard";
  const count = Number(status.count || 0).toLocaleString();
  const hardLimit = Number(status.hard_limit || 0).toLocaleString();
  const remaining = Number(status.remaining || 0).toLocaleString();

  const tone = isHard
    ? "bg-red-50 border-red-100 text-red-700"
    : "bg-amber-50 border-amber-100 text-amber-800";
  const iconTone = isHard ? "bg-red-100" : "bg-amber-100";
  const Icon = isHard ? AlertCircle : AlertTriangle;

  return (
    <div
      role={isHard ? "alert" : "status"}
      className={`${compact ? "mb-4 p-3" : "mb-8 p-4 sm:flex-row sm:items-center"} rounded-2xl flex flex-col justify-between gap-3 border ${tone}`}
    >
      <div className={`flex items-start gap-3 ${compact ? "" : "sm:items-center"}`}>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
          {isHard ? (
            <>
              <strong>Itinerary limit reached.</strong> You have {count} of{" "}
              {hardLimit} itineraries saved. Please delete a few old
              itineraries to create new ones.
            </>
          ) : (
            <>
              <strong>You are close to your itinerary limit.</strong> You have{" "}
              {count} of {hardLimit} itineraries saved ({remaining} left). At{" "}
              {hardLimit} you will need to delete old itineraries before
              creating new ones.
            </>
          )}
        </div>
      </div>
      {showLink && (
        <Link
          to="/my-trips"
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 text-center ${compact ? "self-start" : ""} ${
            isHard
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
          }`}
        >
          Manage Itineraries
        </Link>
      )}
    </div>
  );
};

export default ItineraryLimitNotice;
