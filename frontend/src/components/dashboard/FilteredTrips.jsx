import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  Briefcase,
  Calendar,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTrips } from "../../api/trips";
import Loader from "../common/Loader";
import Pagination from "../common/Pagination";

const FilteredTrips = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const filterType = searchParams.get("filter") || "all";

  const getTitle = () => {
    switch (filterType) {
      case "confirmed":
        return "Confirmed Trips";
      case "completed":
        return "Completed Trips";
      case "total":
        return "All Itineraries";
      case "revenue":
        return "Confirmed & Completed Trips";
      default:
        return "Trips";
    }
  };

  const getSubtitle = () => {
    switch (filterType) {
      case "confirmed":
        return "Manage your confirmed travel bookings.";
      case "completed":
        return "Review successfully finalized journeys.";
      case "total":
        return "View and manage all your agency itineraries.";
      case "revenue":
        return "High-value itineraries contributing to your growth.";
      default:
        return "Showing filtered results for your agency.";
    }
  };

  const loadTrips = async (page = 1) => {
    try {
      setLoading(true);
      const resp = await fetchTrips(token, { page, per_page: pageSize });

      setTrips(resp.data || []);
      setPagination({
        currentPage: resp.current_page,
        lastPage: resp.last_page,
        total: resp.total,
        from: resp.from,
        to: resp.to,
        perPage: resp.per_page ?? pageSize,
      });
    } catch (err) {
      console.error("Failed to load filtered trips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadTrips(1);
    }
  }, [token, filterType, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const displayTrips = trips.filter((t) => {
    const status = t.status?.toLowerCase();
    const title = (t.trip_title || t.tripTitle || "").toLowerCase();
    const client = (t.client_name || t.clientName || "").toLowerCase();
    const matchesSearch =
      title.includes(searchQuery.toLowerCase()) ||
      client.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "confirmed") return status === "confirmed";
    if (filterType === "completed") return status === "completed";
    if (filterType === "revenue")
      return status === "confirmed" || status === "completed";
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mb-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest no-underline mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {getTitle()}
            </h1>
            <p className="text-slate-400 font-medium mt-1">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search trips or clients..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Trip Details
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Client
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                  Total Cost
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                      <div className="font-bold text-slate-900">
                        Loading itineraries...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : displayTrips.length > 0 ? (
                displayTrips.map((trip) => (
                  <tr
                    key={trip.trip_id || trip.tripId}
                    className="hover:bg-slate-50/50 group transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden border border-blue-100/50">
                          {trip.image_url || trip.image ? (
                            <img
                              src={trip.image_url || trip.image}
                              alt={trip.trip_title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Briefcase className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 line-clamp-1">
                            {trip.trip_title || "Unnamed Trip"}
                          </div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            {parseInt(trip.duration || 0) + 1} Days
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-600">
                        {trip.client_name || trip.clientName || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-tight">
                          {new Date(trip.start_date).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-slate-200">
                        {trip.status || "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="font-black text-slate-900 inline-flex items-center justify-end gap-0.5">
                        <IndianRupee className="w-3 h-3 text-slate-400" />
                        {filterType === "revenue"
                          ? parseFloat(trip.paid_amount || 0).toLocaleString()
                          : parseFloat(trip.cost || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        to={`/trip-builder/${trip.trip_id || trip.tripId}`}
                        className="p-2.5 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all inline-flex items-center"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300">
                        <Briefcase className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          No itineraries found
                        </div>
                        <p className="text-slate-400 text-xs">
                          {searchQuery
                            ? "Try a different search term or filter."
                            : "Your agency hasn't created any matching itineraries yet."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t border-slate-50">
          <Pagination
            currentPage={pagination.currentPage}
            lastPage={pagination.lastPage}
            total={pagination.total}
            from={pagination.from}
            to={pagination.to}
            onPageChange={loadTrips}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FilteredTrips;
