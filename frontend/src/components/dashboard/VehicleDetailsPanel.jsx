import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Car,
  MapPin,
  Users,
  Briefcase as LuggageIcon,
  CheckCircle2,
  XCircle,
  Mail,
  MessageCircle,
  Send,
  Route,
  Pencil,
  Loader2,
  Ban,
  AlertTriangle,
  Trash2,
  Plus,
  Fuel,
  IndianRupee,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getVehicleUsage,
  requestVehicleAvailability,
  getVehicleBlackouts,
  createVehicleBlackout,
  deleteVehicleBlackout,
} from "../../api/vehicles";
import { useAuth } from "../../context/AuthContext";

const Fact = ({ icon: Icon, label, value }) => (
  <div className="bg-[#f7f7f8] rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-[#8a93a2] mb-1.5">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-lg font-bold text-[#181c22]">{value}</p>
  </div>
);

const rateTypeLabel = (rateType) =>
  ({ per_day: "Per Day", per_km: "Per KM", per_trip: "Per Trip" })[rateType] || "Rate";

// Inline detail card — the caller animates its mount/size as part of a
// two-column split (see Vehicles.jsx), matching HotelDetailsPanel.
const VehicleDetailsPanel = ({ vehicle, onClose }) => {
  const { token } = useAuth();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [overrides, setOverrides] = useState(null);
  const [blackouts, setBlackouts] = useState([]);
  const [blackoutsLoading, setBlackoutsLoading] = useState(false);
  const [blackoutDraft, setBlackoutDraft] = useState({
    type: "blackout",
    start_date: "",
    end_date: "",
    note: "",
  });
  const [savingBlackout, setSavingBlackout] = useState(false);

  useEffect(() => {
    setOverrides(null);
    setUsage(null);
    setBlackouts([]);
  }, [vehicle?.id]);

  const loadBlackouts = async () => {
    if (!vehicle || !token) return;
    try {
      setBlackoutsLoading(true);
      const resp = await getVehicleBlackouts(vehicle.id, token);
      setBlackouts(resp.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load blocked dates");
    } finally {
      setBlackoutsLoading(false);
    }
  };

  useEffect(() => {
    loadBlackouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id, token]);

  useEffect(() => {
    if (!vehicle || !token) return;
    (async () => {
      try {
        setUsageLoading(true);
        const resp = await getVehicleUsage(vehicle.id, token);
        setUsage(resp);
      } catch (err) {
        toast.error(err.message || "Failed to load vehicle usage");
      } finally {
        setUsageLoading(false);
      }
    })();
  }, [vehicle, token]);

  if (!vehicle) return null;

  const live = overrides ? { ...vehicle, ...overrides } : vehicle;

  const handleRequest = async () => {
    try {
      setRequesting(true);
      const resp = await requestVehicleAvailability(vehicle.id, token);
      setOverrides((prev) => ({ ...prev, ...resp.vehicle }));
      if (resp.emailed) {
        toast.success("Availability request emailed to the vendor");
      } else if (resp.whatsapp_url) {
        toast.success("Request logged — open WhatsApp to send it");
        window.open(resp.whatsapp_url, "_blank", "noopener,noreferrer");
      } else {
        toast.success("Request logged");
      }
    } catch (err) {
      toast.error(err.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const addBlackout = async () => {
    if (!blackoutDraft.start_date || !blackoutDraft.end_date) {
      toast.error("Pick a start and end date");
      return;
    }
    try {
      setSavingBlackout(true);
      await createVehicleBlackout(vehicle.id, blackoutDraft, token);
      setBlackoutDraft({ type: "blackout", start_date: "", end_date: "", note: "" });
      await loadBlackouts();
      toast.success("Date range added");
    } catch (err) {
      toast.error(err.message || "Failed to add date range");
    } finally {
      setSavingBlackout(false);
    }
  };

  const removeBlackout = async (blackoutId) => {
    try {
      await deleteVehicleBlackout(vehicle.id, blackoutId, token);
      setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
    } catch (err) {
      toast.error(err.message || "Failed to remove date range");
    }
  };

  const location = [live.city, live.state, live.country].filter(Boolean).join(", ");
  const rateExtras = [
    live.extra_km_rate != null && `₹${Number(live.extra_km_rate).toLocaleString("en-IN")}/extra km`,
    live.extra_hour_rate != null && `₹${Number(live.extra_hour_rate).toLocaleString("en-IN")}/extra hr`,
    live.driver_allowance != null && `₹${Number(live.driver_allowance).toLocaleString("en-IN")} driver allowance`,
    live.night_halt_charges != null && `₹${Number(live.night_halt_charges).toLocaleString("en-IN")} night halt`,
  ].filter(Boolean);

  return (
    <div className="rounded-[24px] bg-white border border-black/5 shadow-sm h-full flex flex-col overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-[1.1] font-light tracking-tight text-[#181c22] truncate">
            {live.name}
          </h2>
          <div className="flex items-center gap-1.5 text-[#8a93a2] text-sm font-medium mt-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {location || "No base location set"}
          </div>
          {live.registration_number && (
            <p className="text-[#9aa3b2] text-xs font-medium mt-1 truncate uppercase tracking-wide">
              {live.registration_number}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#181c22]/60 shadow-sm hover:text-[#181c22] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs font-bold text-[#181c22] capitalize">
          {(live.vehicle_type || "Vehicle").replace(/_/g, " ")}
          {live.is_ac != null && <span className="text-[#9aa3b2]"> · {live.is_ac ? "AC" : "Non-AC"}</span>}
        </span>
        {live.is_available ? (
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
        {live.image_url ? (
          <img src={live.image_url} alt={live.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Car className="w-8 h-8 text-slate-300" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Fact
          icon={Users}
          label="Seating Capacity"
          value={live.seating_capacity != null ? live.seating_capacity : "Not set"}
        />
        <Fact
          icon={LuggageIcon}
          label="Luggage Capacity"
          value={live.luggage_capacity != null ? live.luggage_capacity : "Not set"}
        />
        <Fact icon={Fuel} label="Fuel Type" value={live.fuel_type ? live.fuel_type.replace(/_/g, " ") : "Not set"} />
        <Fact icon={Send} label="Requests Sent" value={live.request_count || 0} />
      </div>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Rate &amp; Charges
        </h3>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#f7f7f8] mb-2">
          <span className="text-xs font-bold text-[#181c22] flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> {rateTypeLabel(live.rate_type)}
          </span>
          <span className="text-xs font-bold text-[#181c22]">
            ₹{Number(live.price || 0).toLocaleString("en-IN")}
          </span>
        </div>
        {live.min_km_per_day != null && (
          <p className="text-[10px] text-[#9aa3b2] font-medium px-1">
            Minimum {live.min_km_per_day} km/day
          </p>
        )}
        {rateExtras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rateExtras.map((r, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-lg bg-[#f7f7f8] text-[10px] font-bold text-[#5b6472]"
              >
                {r}
              </span>
            ))}
          </div>
        )}
        {live.toll_parking_included != null && (
          <p className="text-[10px] font-bold text-[#9aa3b2] mt-2 px-1">
            Toll &amp; parking {live.toll_parking_included ? "included" : "extra"}
          </p>
        )}
      </div>

      {live.features?.length > 0 && (
        <div className="mt-6 pt-6 border-t border-black/5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
            Features
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {live.features.map((f, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full bg-[#181c22] text-white text-[10px] font-bold"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          <Route className="w-3 h-3 inline -mt-0.5 mr-1" />
          Unavailable Dates
        </h3>
        {blackoutsLoading ? (
          <p className="text-xs text-slate-300 font-medium">Loading…</p>
        ) : blackouts.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {blackouts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f7f7f8]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {b.type === "stop_sale" ? (
                    <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#181c22] truncate">
                      {b.start_date} → {b.end_date}
                    </p>
                    <p className="text-[10px] text-[#9aa3b2] font-medium capitalize">
                      {b.type.replace("_", " ")}
                      {b.note ? ` — ${b.note}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeBlackout(b.id)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
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
              value={blackoutDraft.type}
              onChange={(e) => setBlackoutDraft((prev) => ({ ...prev, type: e.target.value }))}
              className="px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-[#181c22] appearance-none"
            >
              <option value="blackout">Blackout (warn)</option>
              <option value="stop_sale">Stop Sale (block)</option>
            </select>
            <input
              type="date"
              value={blackoutDraft.start_date}
              onChange={(e) => setBlackoutDraft((prev) => ({ ...prev, start_date: e.target.value }))}
              className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-[#181c22]"
            />
            <input
              type="date"
              value={blackoutDraft.end_date}
              onChange={(e) => setBlackoutDraft((prev) => ({ ...prev, end_date: e.target.value }))}
              className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-[#181c22]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={blackoutDraft.note}
              onChange={(e) => setBlackoutDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Note (optional, e.g. Maintenance)"
              className="flex-1 px-2 py-1.5 bg-white rounded-lg text-[11px] font-bold text-[#181c22]"
            />
            <button
              onClick={addBlackout}
              disabled={savingBlackout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#181c22] text-white rounded-lg text-[11px] font-bold disabled:opacity-60"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      </div>

      {live.last_requested_at && (
        <p className="text-[10px] font-bold text-[#9aa3b2] mt-2 px-1">
          Last requested{" "}
          {new Date(live.last_requested_at).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}

      <button
        onClick={handleRequest}
        disabled={requesting}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-[#181c22] text-white py-3 rounded-2xl font-bold text-sm hover:bg-black transition-colors disabled:opacity-60"
      >
        {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Request Vehicle Availability
      </button>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Contact
        </h3>
        <div className="flex items-center gap-2">
          {live.email ? (
            <a
              href={`mailto:${live.email}`}
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold truncate"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" /> {live.email}
            </a>
          ) : null}
          {live.phone ? (
            <a
              href={`https://wa.me/${live.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          ) : null}
          {!live.email && !live.phone && (
            <span className="text-xs text-slate-300 italic">No contact on file</span>
          )}
        </div>
      </div>

      {live.notes && (
        <div className="mt-6 pt-6 border-t border-black/5">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
            Notes
          </h3>
          <p className="text-xs text-[#5b6472] font-medium leading-relaxed whitespace-pre-wrap">
            {live.notes}
          </p>
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
                  <span className="text-xs font-bold text-[#181c22] truncate">
                    {t.trip_title || "Unnamed Trip"}
                  </span>
                  <span className="text-[10px] font-bold text-[#9aa3b2] shrink-0">
                    {t.quantity || "?"} vehicle{t.quantity == 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-[10px] text-[#9aa3b2] font-medium">
                  {t.client_name || "Unknown client"}
                  {t.date ? ` • ${t.date}` : ""}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-300 font-medium">Not used in any trip yet.</p>
        )}
      </div>

      <Link
        to={`/transportation/edit/${vehicle.id}`}
        className="mt-6 w-full flex items-center justify-center gap-2 border border-black/10 text-[#181c22] py-3 rounded-2xl font-bold text-sm hover:bg-[#f7f7f8] transition-colors no-underline"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit Vehicle
      </Link>
    </div>
  );
};

export default VehicleDetailsPanel;
