import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { toast } from "react-toastify";
import { getHotelUsage, requestHotelAvailability } from "../../api/hotels";
import { useAuth } from "../../context/AuthContext";

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

const HotelDetailsPanel = ({ hotel, open, onClose }) => {
  const { token } = useAuth();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [overrides, setOverrides] = useState(null);

  useEffect(() => {
    setOverrides(null);
    setUsage(null);
  }, [hotel?.id]);

  useEffect(() => {
    if (!open || !hotel || !token) return;
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
  }, [open, hotel, token]);

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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[110] shadow-2xl overflow-y-auto rounded-l-[28px]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="relative h-40 bg-slate-100">
              {live.image_url ? (
                <img
                  src={live.image_url}
                  alt={live.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <Hotel className="w-10 h-10 text-slate-300" />
                </div>
              )}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 grid place-items-center w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-black/5 text-[#181c22] shadow-sm hover:bg-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-2xl font-bold text-[#181c22] leading-tight">{live.name}</h2>
                {live.is_available ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold shrink-0 mt-1">
                    <XCircle className="w-3 h-3" /> Unavailable
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[#8a93a2] text-sm font-medium mb-3">
                <MapPin className="w-3.5 h-3.5" />
                {[live.city, live.state].filter(Boolean).join(", ") || "No location set"}
              </div>
              <StarRow count={live.category} />

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
                <Fact
                  icon={Send}
                  label="Requests Sent"
                  value={live.request_count || 0}
                />
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
                {requesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
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
                        onClick={onClose}
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
                  <p className="text-xs text-slate-300 font-medium">
                    Not used in any trip yet.
                  </p>
                )}
              </div>

              <Link
                to={`/accommodation/edit/${hotel.id}`}
                className="mt-6 w-full flex items-center justify-center gap-2 border border-black/10 text-[#181c22] py-3 rounded-2xl font-bold text-sm hover:bg-[#f7f7f8] transition-colors no-underline"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Accommodation
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default HotelDetailsPanel;
