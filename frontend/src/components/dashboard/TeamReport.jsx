import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  BarChart3,
  Users,
  TrendingUp,
  FileText,
  IndianRupee,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  Filter,
  ArrowRight,
  Briefcase,
  ChevronRight,
  Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getTeams } from "../../api/teams";
import { fetchTrips } from "../../api/trips";
import Loader from "../common/Loader";
import CompactDataTable from "../common/CompactDataTable";

const TeamReport = () => {
  const { token, user } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [teamsResp, tripsResp] = await Promise.all([
          getTeams(token),
          fetchTrips(token, { per_page: 1000 }),
        ]);

        setTeamMembers(teamsResp || []);
        setTrips(tripsResp.data || []);
      } catch (error) {
        console.error("Failed to load team report data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadData();
    }
  }, [token]);

  // Calculate statistics
  const calculateStats = (memberId = null) => {
    let filteredTrips = teamTrips;

    if (memberId && memberId !== "all") {
      const member = teamMembers.find((m) => m.id === parseInt(memberId));
      if (member) {
        filteredTrips = filteredTrips.filter((trip) => {
          return trip.created_by === member.user?.name;
        });
      }
    }

    const totalTrips = filteredTrips.length;
    const completedTrips = filteredTrips.filter(
      (t) => t.status?.toLowerCase() === "completed",
    ).length;
    const totalRevenue = filteredTrips
      .filter((t) => {
        const status = t.status?.toLowerCase();
        return status === "confirmed" || status === "completed";
      })
      .reduce((sum, t) => sum + parseFloat(t.paid_amount || 0), 0);
    const pendingTrips = filteredTrips.filter(
      (t) => t.status?.toLowerCase() === "pending",
    ).length;
    const confirmedTrips = filteredTrips.filter(
      (t) => t.status?.toLowerCase() === "confirmed",
    ).length;

    return {
      totalTrips,
      completedTrips,
      totalRevenue,
      pendingTrips,
      confirmedTrips,
      completionRate:
        totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(1) : 0,
    };
  };

  const teamTrips = trips.filter((trip) =>
    teamMembers.some((member) => member.user?.name === trip.created_by),
  );

  const stats = calculateStats(selectedMember);

  const filteredMembers = teamMembers.filter(
    (m) =>
      (m.user?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.job_title || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Team Performance
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Analyze agency growth and consultant productivity
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-4 focus:ring-[#c7f135]/5 focus:border-[#c7f135] transition-all shadow-sm appearance-none cursor-pointer min-w-[220px]"
              >
                <option value="all">Organization Wide</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user?.name || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center">
            <Loader />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Active Itineraries"
              value={stats.totalTrips}
              icon={Briefcase}
              color="blue"
            />
            <MetricCard
              label="Success Rate"
              value={`${stats.completionRate}%`}
              icon={TrendingUp}
              color="purple"
            />
            <MetricCard
              label="Total Revenue"
              value={stats.totalRevenue}
              icon={IndianRupee}
              color="emerald"
              isCurrency
            />
            <MetricCard
              label="Pending Tasks"
              value={stats.pendingTrips}
              icon={Clock}
              color="orange"
            />
          </div>

          {selectedMember === "all" ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Team Insights
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">
                    Direct performance comparison across your agency
                  </p>
                </div>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or role..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <CompactDataTable
                headers={[
                  "Consultant",
                  "Total Trips",
                  "Completed",
                  "Revenue Contribution",
                  { label: "Action", className: "text-right" },
                ]}
                loading={loading}
                hasRows={filteredMembers.length > 0}
              >
                {filteredMembers.map((member) => {
                  const mStats = calculateStats(member.id);
                  return (
                    <tr
                      key={member.id}
                      className="group hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-[#c7f135] flex items-center justify-center text-white font-black text-lg border-4 border-white shadow-sm shrink-0">
                            {(member.user?.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900">
                              {member.user?.name || "Unknown"}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                              {member.job_title || "Travel Designer"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-600">
                          {mStats.totalTrips}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="font-bold text-slate-600">
                            {mStats.completedTrips}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-900 inline-flex items-center gap-1">
                          <IndianRupee className="w-3 h-3 text-slate-400" />
                          {new Intl.NumberFormat("en-IN").format(
                            mStats.totalRevenue,
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() =>
                            setSelectedMember(member.id.toString())
                          }
                          className="p-3 bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 rounded-[1.25rem] transition-all inline-flex items-center"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </CompactDataTable>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b border-slate-50">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setSelectedMember("all")}
                      className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                    >
                      <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-[#c7f135] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-500/10">
                        {(() => {
                          const m = teamMembers.find(
                            (x) => x.id === parseInt(selectedMember),
                          );
                          return (m?.user?.name || "U").charAt(0).toUpperCase();
                        })()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">
                          {teamMembers.find(
                            (x) => x.id === parseInt(selectedMember),
                          )?.user?.name || "Consultant"}
                        </h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                          {teamMembers.find(
                            (x) => x.id === parseInt(selectedMember),
                          )?.job_title || "Travel Professional"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="px-6 py-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                        Success
                      </p>
                      <p className="text-xl font-black text-emerald-700">
                        {stats.completionRate}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-blue-500" />
                      Recent Assignments
                    </h3>
                    <div className="space-y-4">
                      {teamTrips
                        .filter(
                          (t) =>
                            t.created_by ===
                            teamMembers.find(
                              (m) => m.id === parseInt(selectedMember),
                            )?.user?.name,
                        )
                        .slice(0, 6)
                        .map((trip) => (
                          <div
                            key={trip.id}
                            className="p-5 bg-slate-50/50 border border-slate-100/50 rounded-2xl hover:bg-white hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all group cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-blue-500 shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase text-xs tracking-tight">
                                    {trip.trip_title}
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {trip.client_name}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${
                                    trip.status?.toLowerCase() === "completed"
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                      : trip.status?.toLowerCase() === "pending"
                                        ? "bg-orange-50 text-orange-600 border-orange-100"
                                        : "bg-blue-50 text-blue-600 border-blue-100"
                                  }`}
                                >
                                  {trip.status || "Draft"}
                                </span>
                                <div className="mt-2 font-black text-slate-900 text-sm inline-flex items-center gap-0.5">
                                  <IndianRupee className="w-2.5 h-2.5 text-slate-400" />
                                  {new Intl.NumberFormat("en-IN").format(
                                    parseFloat(trip.cost || 0),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-xl p-8 border border-slate-100/50">
                    <h3 className="text-lg font-black text-slate-900 mb-6">
                      Status Breakdown
                    </h3>
                    <div className="space-y-6">
                      <StatusItem
                        label="Confirmed"
                        count={stats.confirmedTrips}
                        total={stats.totalTrips}
                        color="bg-[#c7f135]"
                      />
                      <StatusItem
                        label="Completed"
                        count={stats.completedTrips}
                        total={stats.totalTrips}
                        color="bg-emerald-500"
                      />
                      <StatusItem
                        label="Pending"
                        count={stats.pendingTrips}
                        total={stats.totalTrips}
                        color="bg-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

const MetricCard = ({ label, value, icon: Icon, color, isCurrency }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
      <div className="flex items-start justify-between">
        <div
          className={`w-14 h-14 rounded-2xl ${colors[color]} flex items-center justify-center border-2 shadow-sm shrink-0`}
        >
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <div className="mt-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
          {label}
        </p>
        <p className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-1">
          {isCurrency && <IndianRupee className="w-5 h-5 text-slate-300" />}
          {typeof value === "number"
            ? new Intl.NumberFormat("en-IN").format(value)
            : value}
        </p>
      </div>
    </div>
  );
};

const StatusItem = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-xs font-black text-slate-900">
          {count} <span className="text-slate-300">/ {total}</span>
        </p>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default TeamReport;
