import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import PageHeader from "../common/PageHeader";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Hotel } from "lucide-react";
import { getBookingCalendar } from "../../api/accommodations";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import Loader from "../common/Loader";

const STATUS_STYLES = {
  cancelled: "bg-red-50 text-red-600",
  confirmed: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
  pending: "bg-amber-50 text-amber-700",
};

const statusClass = (status) => STATUS_STYLES[status] || STATUS_STYLES.pending;

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const HotelBookingCalendar = () => {
  const { token } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const resp = await getBookingCalendar(monthKey(cursor), token);
        setStays(resp.data || []);
      } catch (err) {
        toast.error(err.message || "Failed to load booking calendar");
      } finally {
        setLoading(false);
      }
    })();
  }, [cursor, token]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = {};
    stays.forEach((s) => {
      if (s.check_in) {
        (map[s.check_in] = map[s.check_in] || []).push({ ...s, kind: "in" });
      }
      if (s.check_out) {
        (map[s.check_out] = map[s.check_out] || []).push({ ...s, kind: "out" });
      }
    });
    return map;
  }, [stays]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout>
      <PageHeader
        title="Hotel Booking Calendar"
        description="Check-in and check-out density across every hotel, at a glance."
      >
        <Link
          to="/accommodation"
          className="text-sm font-bold text-[#181c22]/60 hover:text-[#181c22] no-underline"
        >
          Back to Accommodation
        </Link>
      </PageHeader>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5 flex items-center justify-between bg-[#f3f3f4]/60">
          <button
            onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 shadow-sm hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest">
            {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </h3>
          <button
            onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="grid place-items-center w-9 h-9 rounded-xl bg-white border border-black/5 shadow-sm hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader text="Loading calendar..." />
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[110px]" />;
                const dayStr = day.toISOString().slice(0, 10);
                const events = eventsByDay[dayStr] || [];
                const isToday = dayStr === todayStr;
                return (
                  <div
                    key={i}
                    className={`min-h-[110px] rounded-xl border p-2 ${
                      isToday ? "border-[#e7f63c] bg-[#e7f63c]/5" : "border-black/5 bg-[#f7f7f8]"
                    }`}
                  >
                    <div className="text-[11px] font-bold text-[#8a93a2] mb-1.5">{day.getDate()}</div>
                    <div className="space-y-1">
                      {events.slice(0, 3).map((ev, idx) => (
                        <div
                          key={idx}
                          title={`${ev.hotel_name} — ${ev.client_name || "Unknown client"}`}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-bold truncate ${statusClass(ev.status)}`}
                        >
                          {ev.kind === "in" ? (
                            <LogIn className="w-2.5 h-2.5 shrink-0" />
                          ) : (
                            <LogOut className="w-2.5 h-2.5 shrink-0" />
                          )}
                          <span className="truncate">{ev.hotel_name}</span>
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div className="text-[9px] font-bold text-slate-400 px-1.5">
                          +{events.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {stays.length === 0 && (
              <div className="text-center py-16 text-slate-300">
                <Hotel className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  No bookings this month
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HotelBookingCalendar;
