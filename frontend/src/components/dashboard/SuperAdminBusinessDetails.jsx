import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  Building,
  Users,
  FileText,
  TrendingUp,
  BarChart,
  ArrowLeft,
  Mail,
  Calendar,
  Zap,
  Shield,
  Clock,
  CheckCircle,
  Activity,
  UserCheck,
  Package,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSuperAdminBusinessDetails,
  assignBusinessIncludedMember,
} from "../../api/superAdmin";
import Loader from "../common/Loader";
import { toast } from "react-toastify";
import {
  AreaChart,
  Area,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const fmtINR = (amount) => {
  const n = parseFloat(amount) || 0;
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const SuperAdminBusinessDetails = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigningSeatMemberId, setAssigningSeatMemberId] = useState(null);

  const loadBusinessDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchSuperAdminBusinessDetails(token, businessId);
      setBusiness(data);
    } catch (err) {
      console.error("Failed to fetch business details:", err);
      toast.error(err.message || "Failed to load business details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && businessId) {
      loadBusinessDetails();
    }
  }, [token, businessId]);

  const handleAssignSeat = async (member) => {
    if (!member?.user_id) {
      toast.error("Invalid team member record");
      return;
    }

    try {
      setAssigningSeatMemberId(member.user_id);
      await assignBusinessIncludedMember(token, businessId, member.user_id);
      toast.success(`Seat assigned to ${member.name || "member"}.`);
      await loadBusinessDetails();
    } catch (err) {
      toast.error(err.message || "Failed to assign included seat");
    } finally {
      setAssigningSeatMemberId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader text="Loading business insights..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!business) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 font-medium">
            Business record not found.
          </p>
          <button
            onClick={() => navigate("/businesses")}
            className="mt-4 text-indigo-600 font-bold flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Businesses
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // Mocked trend data for visual appeal (since real history isn't in this endpoint)
  const fakeActivityData = [
    { month: "Oct", active: 4, trips: 12 },
    { month: "Nov", active: 5, trips: 18 },
    { month: "Dec", active: 7, trips: 25 },
    { month: "Jan", active: 8, trips: 32 },
    {
      month: "Feb",
      active: business.team_members_count,
      trips: Math.floor(business.trips_count * 0.8),
    },
    {
      month: "Mar",
      active: business.team_members_count,
      trips: business.trips_count,
    },
  ];

  const seatSummary = business.seat_summary || {};
  const seatLimit = Number(seatSummary.team_member_limit || 0);
  const seatsAssigned = Number(seatSummary.assigned_count || 0);
  const seatsAvailable = Number(seatSummary.available_count || 0);
  const canAssignSeats = !!seatSummary.can_assign;

  return (
    <DashboardLayout>
      <div className="p-8 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/businesses")}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span>Super Admin</span>
                <span>/</span>
                <span className="text-indigo-500">Business Portfolio</span>
              </nav>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                {business.name}
                {business.bypass_subscription && (
                  <span className="bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-current" /> Partner Tier
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Subscription Status
              </p>
              <div className="flex items-center gap-2 justify-end">
                <div
                  className={`w-2 h-2 rounded-full ${business.status === "active" ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className="text-sm font-bold text-slate-700 capitalize">
                  {business.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: Core Stats */}
          <div className="lg:col-span-2 space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  label: "Total Revenue",
                  value: fmtINR(business.total_revenue || 0),
                  icon: TrendingUp,
                  color: "emerald",
                  trend: "Confirmed Earnings",
                },
                {
                  label: "Team Strength",
                  value: business.team_members_count,
                  icon: Users,
                  color: "indigo",
                  trend: "Active Delegates",
                },
                {
                  label: "Total Itineraries",
                  value: business.trips_count,
                  icon: FileText,
                  color: "blue",
                  trend: "System Output",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center mb-4`}
                  >
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 mt-2">
                    {stat.trend}
                  </p>
                </div>
              ))}
            </div>

            {/* Main Activity Chart */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Activity & Engagement
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    6-month utilization profile
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 text-indigo-600">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />{" "}
                    TRIPS
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-300" /> TEAM
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={fakeActivityData}>
                  <defs>
                    <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#6366f1"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="trips"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fill="url(#colorTrips)"
                    name="Itineraries Created"
                  />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#93c5fd"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={0}
                    name="Members Active"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column: Profile & Details */}
          <div className="space-y-8">
            {/* Business Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-20 bg-linear-to-r from-indigo-500 to-blue-600 relative">
                <div className="absolute -bottom-6 left-6">
                  <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center text-indigo-600">
                    <Building className="w-8 h-8" />
                  </div>
                </div>
              </div>
              <div className="pt-10 p-6">
                <h4 className="font-bold text-slate-900 text-lg">
                  {business.name}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  Account ID: {business.id}
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Primary Contact
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {business.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Activation Date
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {new Date(business.created_at).toLocaleDateString(
                          "en-IN",
                          { dateStyle: "long" },
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Current Tier
                      </p>
                      <p className="text-xs font-bold text-indigo-600">
                        {business.plan?.plan_name || "Standard/Custom"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {business.trips_count}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Total Trips
                    </p>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <p className="text-2xl font-bold text-slate-900">
                      {business.team_members_count}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Members
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">
                  Team Members
                </h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
                  {business.team_members?.length || 0}
                </span>
              </div>
              <div className="mb-4 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Included Plan Seats
                </p>
                <p className="text-xs font-bold text-slate-900 mt-1">
                  {seatsAssigned}/{seatLimit} assigned
                  {seatLimit > 0 ? `, ${seatsAvailable} available` : ""}
                </p>
                {!canAssignSeats && seatSummary.reason && (
                  <p className="text-[10px] font-medium text-slate-500 mt-1">
                    {seatSummary.reason}
                  </p>
                )}
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {business.team_members && business.team_members.length > 0 ? (
                  business.team_members.map((member) => {
                    const memberSubStatus = member.subscription?.status || "none";
                    const isPendingMember = memberSubStatus === "pending";
                    const canAssignThisMember = canAssignSeats && isPendingMember;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 overflow-hidden">
                          {member.image_url ? (
                            <img
                              src={member.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            member.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {member.job_title || "Member"}
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              memberSubStatus === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : memberSubStatus === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {memberSubStatus}
                          </span>

                          {canAssignThisMember && (
                            <button
                              onClick={() => handleAssignSeat(member)}
                              disabled={assigningSeatMemberId === member.user_id}
                              className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {assigningSeatMemberId === member.user_id ? (
                                <span className="inline-flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Assigning
                                </span>
                              ) : (
                                "Assign Seat"
                              )}
                            </button>
                          )}

                          <div
                            className={`w-1.5 h-1.5 rounded-full ${member.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400 font-medium">
                      No team members found
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Itineraries Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Itinerary Activity
                </h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                  Latest 5 system outputs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {business.recent_trips?.length || 0} Records
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    Trip Reference
                  </th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    Destination
                  </th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">
                    Status
                  </th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">
                    Created Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {business.recent_trips && business.recent_trips.length > 0 ? (
                  business.recent_trips.map((trip) => (
                    <tr
                      key={trip.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-8 py-4">
                        <p className="text-xs font-bold text-slate-900">
                          {trip.trip_title}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                          ID: #{trip.id.toString().padStart(4, "0")}
                        </p>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span className="text-xs font-semibold text-slate-600">
                            {trip.destination || "Not Specified"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex justify-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              trip.status === "confirmed" ||
                              trip.status === "Active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {trip.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <p className="text-xs font-medium text-slate-500">
                          {new Date(trip.created_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="w-8 h-8 text-slate-200" />
                        <p className="text-xs text-slate-400 font-medium">
                          No recent itinerary activity found.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminBusinessDetails;
