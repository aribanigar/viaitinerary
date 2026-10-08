import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Ticket,
  MapPin,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
  MessageCircle,
  Users,
  Clock,
  Briefcase,
  Pencil,
  Ban,
  AlertTriangle,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getActivityUsage,
  getActivityBlackouts,
  createActivityBlackout,
  deleteActivityBlackout,
} from "../../api/activities";
import { useAuth } from "../../context/AuthContext";

const CATEGORY_LABEL = {
  sightseeing: "Sightseeing",
  adventure: "Adventure",
  cultural: "Cultural",
  water: "Water",
  snow: "Snow",
  experience: "Experience",
  transfer: "Transfer / Ride",
  other: "Other",
};

const money = (n) => (n == null || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);

const Fact = ({ icon, label, value }) => (
  <div className="bg-[#f7f7f8] rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-[#8a93a2] mb-1.5">
      {React.createElement(icon, { className: "w-3.5 h-3.5" })}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-lg font-bold text-ink">{value}</p>
  </div>
);

// Inline detail card beside the Activities list — the same split as
// Accommodation's HotelDetailsPanel.
const ActivityDetailsPanel = ({ activity, onClose }) => {
  const { token } = useAuth();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [blackouts, setBlackouts] = useState([]);
  const [blackoutsLoading, setBlackoutsLoading] = useState(false);
  const [draft, setDraft] = useState({ type: "blackout", start_date: "", end_date: "", note: "" });
  const [saving, setSaving] = useState(false);

  const loadBlackouts = async () => {
    if (!activity || !token) return;
    try {
      setBlackoutsLoading(true);
      const resp = await getActivityBlackouts(activity.id, token);
      setBlackouts(resp.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load blocked dates");
    } finally {
      setBlackoutsLoading(false);
    }
  };

  useEffect(() => {
    setBlackouts([]);
    setUsage(null);
    loadBlackouts();
    if (!activity || !token) return;
    (async () => {
      try {
        setUsageLoading(true);
        setUsage(await getActivityUsage(activity.id, token));
      } catch (err) {
        toast.error(err.message || "Failed to load activity usage");
      } finally {
        setUsageLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id, token]);

  if (!activity) return null;
  const a = activity;

  const addBlackout = async () => {
    if (!draft.start_date || !draft.end_date) {
      toast.error("Pick a start and end date");
      return;
    }
    try {
      setSaving(true);
      await createActivityBlackout(a.id, draft, token);
      setDraft({ type: "blackout", start_date: "", end_date: "", note: "" });
      await loadBlackouts();
      toast.success("Date range added");
    } catch (err) {
      toast.error(err.message || "Failed to add date range");
    } finally {
      setSaving(false);
    }
  };

  const removeBlackout = async (blackoutId) => {
    try {
      await deleteActivityBlackout(a.id, blackoutId, token);
      setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
    } catch (err) {
      toast.error(err.message || "Failed to remove date range");
    }
  };

  const location = [a.city, a.state, a.country].filter(Boolean).join(", ") || a.destination_name || "";
  const inclusions = String(a.inclusions || "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="rounded-[24px] bg-white border border-black/5 shadow-sm h-full flex flex-col overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-[1.1] font-light tracking-tight text-ink truncate">{a.name}</h2>
          <div className="flex items-center gap-1.5 text-[#8a93a2] text-sm font-medium mt-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {location || "No location set"}
          </div>
          {a.address && <p className="text-[#9aa3b2] text-xs font-medium mt-1 truncate">{a.address}</p>}
        </div>
        <button
          onClick={onClose}
          className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-ink/60 shadow-sm hover:text-ink transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="px-2.5 py-1 rounded-full bg-[#f3f3f4] text-ink text-[10px] font-black uppercase tracking-widest">
          {CATEGORY_LABEL[a.category] || "Activity"}
        </span>
        {a.is_active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold shrink-0">
            <XCircle className="w-3 h-3" /> Unavailable
          </span>
        )}
      </div>

      <div className="relative h-[160px] rounded-xl bg-slate-100 overflow-hidden mt-4 shrink-0">
        {a.image_url ? (
          <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Ticket className="w-8 h-8 text-slate-300" />
          </div>
        )}
      </div>

      {a.description && <p className="text-[13px] leading-relaxed text-ink/70 mt-4">{a.description}</p>}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Fact
          icon={Calendar}
          label="Date Added"
          value={a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        />
        <Fact icon={Users} label="Capacity / Day" value={a.capacity_per_day ?? "Not set"} />
        <Fact icon={Briefcase} label="Persons Booked" value={usageLoading ? "…" : usage?.persons_booked ?? 0} />
        <Fact icon={Clock} label="Duration" value={a.duration_hours ? `${a.duration_hours} h` : "—"} />
      </div>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">Pricing (per person)</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 px-3 text-[9px] font-black uppercase tracking-widest text-[#9aa3b2]">
            <span>Rate</span>
            <span className="text-right">B2B cost</span>
            <span className="text-right">Selling</span>
          </div>
          {[
            ["Adult", a.cost, a.selling_price],
            ["Child (5–12)", a.child_cost, a.child_price],
          ].map(([label, cost, price]) => (
            <div key={label} className="grid grid-cols-3 gap-2 px-3 py-2.5 rounded-xl bg-[#f7f7f8] text-xs font-bold text-ink">
              <span>{label}</span>
              <span className="text-right text-[#8a93a2]">{money(cost)}</span>
              <span className="text-right">{money(price)}</span>
            </div>
          ))}
          {(a.price_sections || []).map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 px-3 py-2.5 rounded-xl bg-[#f7f7f8] text-xs font-bold text-ink">
              <span className="truncate" title={s.option}>
                {s.option || "Option"}
                {s.valid_from || s.valid_to ? (
                  <span className="block text-[10px] font-medium text-[#9aa3b2]">
                    {s.valid_from || "…"} → {s.valid_to || "…"}
                  </span>
                ) : null}
              </span>
              <span className="text-right text-[#8a93a2]">{money(s.cost)}</span>
              <span className="text-right">{money(s.price)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">Availability Blocks</h3>
        {blackoutsLoading ? (
          <p className="text-xs text-slate-300 font-medium">Loading…</p>
        ) : blackouts.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {blackouts.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f7f7f8]">
                <div className="flex items-center gap-2 min-w-0">
                  {b.type === "stop_sale" ? (
                    <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {b.start_date} → {b.end_date}
                    </p>
                    <p className="text-[10px] text-[#9aa3b2] font-medium capitalize">
                      {b.type.replace("_", " ")}
                      {b.note ? ` — ${b.note}` : ""}
                    </p>
                  </div>
                </div>
                <button onClick={() => removeBlackout(b.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-300 font-medium mb-3">No blocked dates.</p>
        )}
        <div className="space-y-2 bg-[#f7f7f8] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <select
              value={draft.type}
              onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
              className="px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-ink appearance-none"
            >
              <option value="blackout">Blackout (warn)</option>
              <option value="stop_sale">Stop Sale (block)</option>
            </select>
            <input type="date" value={draft.start_date} onChange={(e) => setDraft((p) => ({ ...p, start_date: e.target.value }))} className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-ink" />
            <input type="date" value={draft.end_date} onChange={(e) => setDraft((p) => ({ ...p, end_date: e.target.value }))} className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-ink" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft.note}
              onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
              placeholder="Note (optional)"
              className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-ink"
            />
            <button
              onClick={addBlackout}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-brand text-white rounded-lg text-[11px] font-bold disabled:opacity-60"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Supplier{a.supplier_name ? ` — ${a.supplier_name}` : ""}
        </h3>
        <div className="flex items-center gap-2">
          {a.email ? (
            <a href={`mailto:${a.email}`} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" /> {a.email}
            </a>
          ) : null}
          {a.phone ? (
            <a
              href={`https://wa.me/${a.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          ) : null}
          {!a.email && !a.phone && <span className="text-xs text-slate-300 italic">No contact on file</span>}
        </div>
      </div>

      {(inclusions.length > 0 || a.cancellation_policy) && (
        <div className="mt-6 pt-6 border-t border-black/5 space-y-3">
          {inclusions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-2">Inclusions</h3>
              <ul className="space-y-1">
                {inclusions.map((x, i) => (
                  <li key={i} className="flex gap-2 text-xs font-medium text-ink">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.cancellation_policy && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-2">Cancellation</h3>
              <p className="text-xs text-ink/70">{a.cancellation_policy}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Used in Trips {usage ? `(${usage.trips.length})` : ""}
        </h3>
        {usageLoading ? (
          <p className="text-xs text-slate-300 font-medium">Loading…</p>
        ) : usage && usage.trips.length > 0 ? (
          <div className="space-y-2">
            {usage.trips.map((t, i) => (
              <Link
                key={i}
                to={`/trip-builder/${t.trip_id}`}
                className="block px-3 py-2.5 rounded-xl bg-[#f7f7f8] hover:bg-[#f0f0f1] transition-colors no-underline"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink truncate">{t.trip_title || "Unnamed Trip"}</span>
                  <span className="text-[10px] font-bold text-[#9aa3b2] shrink-0">
                    {t.persons} person{t.persons === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-[10px] text-[#9aa3b2] font-medium">
                  {t.client_name || "Unknown client"}
                  {t.date ? ` • ${t.date}` : t.day_number ? ` • Day ${t.day_number}` : ""}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-300 font-medium">Not used in any trip yet.</p>
        )}
      </div>

      <Link
        to={`/activities/edit/${a.id}`}
        className="mt-6 w-full flex items-center justify-center gap-2 border border-black/10 text-ink py-3 rounded-2xl font-bold text-sm hover:bg-[#f7f7f8] transition-colors no-underline"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit Activity
      </Link>
    </div>
  );
};

export default ActivityDetailsPanel;
