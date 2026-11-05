import React, { useEffect, useState } from "react";
import { FileStack, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
  fetchItineraryLimitSettings,
  updateItineraryLimitSettings,
} from "../../api/itineraryLimit";

/**
 * Super admin control for the platform-wide itinerary limit:
 * on/off, soft notice count and hard limit count.
 */
const SuperAdminItineraryLimit = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    soft_limit: 450,
    hard_limit: 500,
  });

  useEffect(() => {
    let active = true;
    fetchItineraryLimitSettings(token)
      .then((data) => {
        if (active && data) {
          setForm({
            enabled: !!data.enabled,
            soft_limit: data.soft_limit,
            hard_limit: data.hard_limit,
          });
        }
      })
      .catch((err) => toast.error(err.message || "Failed to load itinerary limit"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  const handleSave = async (e) => {
    e.preventDefault();
    const soft = parseInt(form.soft_limit, 10);
    const hard = parseInt(form.hard_limit, 10);

    if (!soft || soft < 1 || !hard || hard < 1) {
      toast.error("Both limits must be at least 1.");
      return;
    }
    if (hard < soft) {
      toast.error("The hard limit must be equal to or higher than the soft limit.");
      return;
    }

    try {
      setSaving(true);
      const resp = await updateItineraryLimitSettings(token, {
        enabled: form.enabled,
        soft_limit: soft,
        hard_limit: hard,
      });
      if (resp?.settings) {
        setForm({
          enabled: !!resp.settings.enabled,
          soft_limit: resp.settings.soft_limit,
          hard_limit: resp.settings.hard_limit,
        });
      }
      toast.success("Itinerary limit saved");
    } catch (err) {
      toast.error(err.message || "Failed to save itinerary limit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100 shrink-0">
            <FileStack className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Itinerary Limit</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Applies to every business. At the soft limit they see a warning;
              at the hard limit they must delete old itineraries before creating
              new ones. Team members count towards their business.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer shrink-0">
          <span className="text-sm font-semibold text-slate-700">
            {form.enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            disabled={loading}
            onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              form.enabled ? "bg-accent" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                form.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Soft notice at (itineraries)
          </label>
          <input
            type="number"
            min="1"
            value={form.soft_limit}
            disabled={loading}
            onChange={(e) => setForm((f) => ({ ...f, soft_limit: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="text-xs text-slate-400 mt-1">Warning only. Creating still works.</p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Hard limit at (itineraries)
          </label>
          <input
            type="number"
            min="1"
            value={form.hard_limit}
            disabled={loading}
            onChange={(e) => setForm((f) => ({ ...f, hard_limit: e.target.value }))}
            className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="text-xs text-slate-400 mt-1">New itineraries are blocked at this count.</p>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="submit"
          disabled={loading || saving}
          className="px-5 py-2.5 bg-accent text-white text-sm font-bold rounded-xl hover:bg-accent-hover disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Limit
        </button>
      </div>
    </form>
  );
};

export default SuperAdminItineraryLimit;
