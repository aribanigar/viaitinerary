import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Hotel,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
  MessageCircle,
  BedDouble,
  Send,
  Briefcase,
  Pencil,
  Loader2,
  Ban,
  AlertTriangle,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getHotelUsage,
  requestHotelAvailability,
  getHotelBlackouts,
  createHotelBlackout,
  deleteHotelBlackout,
} from "../../api/hotels";
import { useAuth } from "../../context/AuthContext";
import HotelLocationMap from "./HotelLocationMap";

const StarRow = ({ count }) => {
  const n = parseInt(count, 10) || 0;
  if (!n) return <span className="text-slate-300 text-xs">No rating set</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="w-4 h-4 fill-[#e7f63c] text-[#181c22]" strokeWidth={1.5} />
      ))}
    </div>
  );
};

const Fact = ({ icon: Icon, label, value }) => (
  <div className="bg-[#f7f7f8] rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-[#8a93a2] mb-1.5">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-lg font-bold text-[#181c22]">{value}</p>
  </div>
);

// Inline detail card — the caller animates its mount/size as part of a
// two-column split (see Accommodation.jsx), matching how the AI Assistant
// page always shows a map card alongside a destination-details card rather
// than overlaying one on top of the other.
const HotelDetailsPanel = ({ hotel, onClose }) => {
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
  }, [hotel?.id]);

  const loadBlackouts = async () => {
    if (!hotel || !token) return;
    try {
      setBlackoutsLoading(true);
      const resp = await getHotelBlackouts(hotel.id, token);
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
  }, [hotel?.id, token]);

  useEffect(() => {
    if (!hotel || !token) return;
    (async () => {
      try {
        setUsageLoading(true);
        const resp = await getHotelUsage(hotel.id, token);
        setUsage(resp);
      } catch (err) {
        toast.error(err.message || "Failed to load hotel usage");
      } finally {
        setUsageLoading(false);
      }
    })();
  }, [hotel, token]);

  if (!hotel) return null;

  const live = overrides ? { ...hotel, ...overrides } : hotel;
  const roomsBooked = usage?.rooms_booked ?? 0;
  const roomsAvailable =
    live.total_rooms != null ? Math.max(0, live.total_rooms - roomsBooked) : null;

  const handleRequest = async () => {
    try {
      setRequesting(true);
      const resp = await requestHotelAvailability(hotel.id, token);
      setOverrides((prev) => ({ ...prev, ...resp.hotel }));
      if (resp.emailed) {
        toast.success("Availability request emailed to the hotel");
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
      await createHotelBlackout(hotel.id, blackoutDraft, token);
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
      await deleteHotelBlackout(hotel.id, blackoutId, token);
      setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
    } catch (err) {
      toast.error(err.message || "Failed to remove date range");
    }
  };

  const location = [live.city, live.state, live.country].filter(Boolean).join(", ");

  return (
    <div className="rounded-[24px] bg-white border border-black/5 shadow-sm h-full flex flex-col overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-[1.1] font-light tracking-tight text-[#181c22] truncate">
            {live.name}
          </h2>
          <div className="flex items-center gap-1.5 text-[#8a93a2] text-sm font-medium mt-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {location || "No location set"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 text-[#181c22]/60 shadow-sm hover:text-[#181c22] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <StarRow count={live.category} />
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
            <Hotel className="w-8 h-8 text-slate-300" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Fact
          icon={Calendar}
          label="Date Added"
          value={
            live.created_at
              ? new Date(live.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
        />
        <Fact
          icon={BedDouble}
          label="Rooms Available"
          value={roomsAvailable != null ? roomsAvailable : "Not set"}
        />
        <Fact
          icon={Briefcase}
          label="Rooms Booked (all time)"
          value={usageLoading ? "…" : roomsBooked}
        />
        <Fact icon={Send} label="Requests Sent" value={live.request_count || 0} />
      </div>

      <div className="mt-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Location
        </h3>
        <HotelLocationMap
          latitude={live.latitude}
          longitude={live.longitude}
          name={live.name}
          location={location}
        />
      </div>

      <div className="mt-6 pt-6 border-t border-black/5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
          Availability Blocks
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
                      {b.room_type ? ` · ${b.room_type}` : ""}
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
              placeholder="Note (optional)"
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
          Request Room Availability
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

        {live.price_sections?.length > 0 && (
          <div className="mt-6 pt-6 border-t border-black/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8a93a2] mb-3">
              Pricing Tiers
            </h3>
            <div className="space-y-2">
              {live.price_sections.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#f7f7f8]"
                >
                  <span className="text-xs font-bold text-[#181c22] capitalize">
                    {(s.room_type || "Room").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-bold text-[#181c22]">
                    ₹{Number(s.price || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
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
                      {t.rooms || "?"} room{t.rooms == 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9aa3b2] font-medium">
                    {t.client_name || "Unknown client"}
                    {t.check_in ? ` • ${t.check_in}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-300 font-medium">Not used in any trip yet.</p>
          )}
        </div>

        <Link
          to={`/accommodation/edit/${hotel.id}`}
          className="mt-6 w-full flex items-center justify-center gap-2 border border-black/10 text-[#181c22] py-3 rounded-2xl font-bold text-sm hover:bg-[#f7f7f8] transition-colors no-underline"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit Accommodation
        </Link>
    </div>
  );
};

export default HotelDetailsPanel;
