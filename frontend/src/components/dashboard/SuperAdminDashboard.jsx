import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  Users,
  Building2,
  FileText,
  UserCheck,
  IndianRupee,
  TrendingUp,
  MessageSquare,
  CalendarClock,
  BarChart3,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  Sparkles,
  Zap,
  Target,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchSuperAdminDashboard } from "../../api/superAdmin";
import Loader from "../common/Loader";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtINR = (amount) => {
  const n = parseFloat(amount) || 0;
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const planLabels = {
  trial: "Trial",
  monthly: "Monthly",
  six_months: "6 Months",
  yearly: "Yearly",
  none: "No Plan",
};

// ── Modern Chart Colors ──────────────────────────────────────────────────────
const CHART_COLORS = {
  blue: "#c7f135",
  purple: "#a855f7",
  orange: "#f97316",
  emerald: "#10b981",
  indigo: "#10182a",
  pink: "#ec4899",
  yellow: "#eab308",
  teal: "#14b8a6",
};

const PLAN_COLORS = ["#10182a", "#0ea5e9", "#8b5cf6", "#10b981"];

// ── Custom Tooltip Components ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
      <p className="font-semibold text-xs text-slate-900 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-[11px] flex items-center gap-2"
          style={{ color: entry.color }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-bold text-slate-800">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active: "bg-emerald-50 text-emerald-600 border-emerald-200",
    inactive: "bg-slate-50 text-slate-600 border-slate-200",
    suspended: "bg-red-50 text-red-600 border-red-200",
    pending: "bg-amber-50 text-amber-600 border-amber-200",
    contacted: "bg-blue-50 text-blue-600 border-blue-200",
    completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    trial: "bg-indigo-50 text-indigo-600 border-indigo-200",
    trialing: "bg-indigo-50 text-indigo-600 border-indigo-200",
    monthly: "bg-blue-50 text-blue-600 border-blue-200",
    six_months: "bg-purple-50 text-purple-600 border-purple-200",
    yearly: "bg-emerald-50 text-emerald-600 border-emerald-200",
    none: "bg-slate-50 text-slate-400 border-slate-200",
  };
  const label = planLabels[status] ?? status ?? "—";
  return (
    <span
      className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${map[status] || "bg-slate-50 text-slate-500 border-slate-200"}`}
    >
      {label}
    </span>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const SuperAdminDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const dashboardData = await fetchSuperAdminDashboard(token);
        if (!cancelled) setData(dashboardData);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── Formatted Stats ────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Total Revenue",
      value: fmtINR(data?.total_revenue ?? 0),
      trend: `MRR: ${fmtINR(data?.mrr ?? 0)}`,
      icon: IndianRupee,
      color: "blue",
    },
    {
      label: "Active Agencies",
      value: data?.total_admins ?? 0,
      trend: `+${data?.new_admins_this_month ?? 0} this month`,
      icon: Building2,
      color: "indigo",
    },
    {
      label: "System Usage",
      value: data?.total_trips ?? 0,
      trend: `${data?.active_teams ?? 0} active teams`,
      icon: Activity,
      color: "emerald",
    },
    {
      label: "Lead Pipeline",
      value: data?.inquiries?.total ?? 0,
      trend: fmtINR(data?.inquiries?.pipeline_value ?? 0),
      icon: Target,
      color: "orange",
    },
  ];

  // ── Prepare chart data with safety checks ───────────────────────────────
  const growthChartData = Array.isArray(data?.growth) ? data.growth : [];

  const planChartData = [
    {
      name: "Trial",
      value: Number(data?.plan_breakdown?.trial ?? 0),
      color: PLAN_COLORS[0],
    },
    {
      name: "Monthly",
      value: Number(data?.plan_breakdown?.monthly ?? 0),
      color: PLAN_COLORS[1],
    },
    {
      name: "6 Months",
      value: Number(data?.plan_breakdown?.six_months ?? 0),
      color: PLAN_COLORS[2],
    },
    {
      name: "Yearly",
      value: Number(data?.plan_breakdown?.yearly ?? 0),
      color: PLAN_COLORS[3],
    },
  ];

  const inquiryChartData = [
    {
      name: "New",
      value: Number(data?.inquiries?.by_status?.new ?? 0),
      fill: CHART_COLORS.blue,
    },
    {
      name: "Contacted",
      value: Number(data?.inquiries?.by_status?.contacted ?? 0),
      fill: CHART_COLORS.yellow,
    },
    {
      name: "Quoted",
      value: Number(data?.inquiries?.by_status?.quoted ?? 0),
      fill: CHART_COLORS.orange,
    },
    {
      name: "Converted",
      value: Number(data?.inquiries?.by_status?.converted ?? 0),
      fill: CHART_COLORS.emerald,
    },
    {
      name: "Closed",
      value: Number(data?.inquiries?.by_status?.closed ?? 0),
      fill: "#94a3b8",
    },
  ];

  const conversionRate =
    data?.inquiries?.total && data.inquiries.total > 0
      ? Math.round(
          ((data.inquiries.by_status?.converted ?? 0) / data.inquiries.total) *
            100,
        )
      : 0;

  return (
    <DashboardLayout>
      <div className="p-8 bg-slate-50 min-h-screen">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Platform Overview
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Analyze platform metrics, revenue growth, and agency conversions.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live System Status
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader text="Loading metrics..." />
          </div>
        ) : (
          <>
            {/* ── Modern KPI Cards ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {stats.map((card, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600`}
                    >
                      <card.icon className="w-5 h-5" />
                    </div>
                    {/* Optional: Add percentage trend here if available */}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      {card.label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {card.value}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 mt-2 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                      {card.trend}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Main Analytics Section ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              {/* Growth Chart - Takes up 2/3 */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Growth Trajectory
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#c7f135]" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Agencies
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Trips
                      </span>
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthChartData}>
                    <defs>
                      <linearGradient
                        id="colorGrowth"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10182a"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10182a"
                          stopOpacity={0}
                        />
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
                      tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="admins"
                      stroke="#c7f135"
                      strokeWidth={2}
                      fillOpacity={0}
                      name="Agencies"
                    />
                    <Area
                      type="monotone"
                      dataKey="trips"
                      stroke="#10182a"
                      strokeWidth={2}
                      fill="url(#colorGrowth)"
                      name="Trips"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Card (Vertical side) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-6">
                    <IndianRupee className="w-4 h-4 text-emerald-500" />
                    Revenue Insights
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Estimated MRR
                      </p>
                      <p className="text-3xl font-bold text-slate-900">
                        {fmtINR(data?.mrr ?? 0)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                          Active Rev
                        </p>
                        <p className="text-sm font-bold text-slate-800">
                          {fmtINR(data?.total_revenue ?? 0)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">
                          Pipeline
                        </p>
                        <p className="text-sm font-bold text-amber-700">
                          {fmtINR(data?.inquiries?.pipeline_value ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Subscription Mix
                  </h3>
                  <div className="space-y-3">
                    {planChartData.map((plan, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: plan.color }}
                        />
                        <span className="text-[11px] font-medium text-slate-600 truncate">
                          {plan.name}
                        </span>
                        <div className="flex-1 h-1 bg-slate-100 rounded-full mx-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: plan.color,
                              width: `${(plan.value / (data?.total_admins || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-900">
                          {plan.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Table Rows ──────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Recent Agencies */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-[#1E293B]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Recent Agency Onboarding
                  </h3>
                  <button
                    onClick={() => navigate("/businesses")}
                    className="text-[10px] font-bold text-indigo-600 uppercase hover:text-indigo-700 transition-colors"
                  >
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Business Name
                        </th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(data?.recent_businesses ?? []).map((biz) => (
                        <tr
                          key={biz.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-900">
                              {biz.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {biz.email}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={biz.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-[11px] font-medium text-slate-500">
                              {fmtDate(biz.created_at)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Demo Enquiries */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Scheduled Demos
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {data?.demos?.pending ?? 0} Pending
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/demo-requests")}
                      className="text-[10px] font-bold text-indigo-600 uppercase hover:text-indigo-700 transition-colors"
                    >
                      View All
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {(data?.demos?.recent ?? []).map((demo) => (
                    <div
                      key={demo.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                          {demo.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {demo.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {demo.company_name} · {demo.agency_type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={demo.status} />
                        <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                          {fmtDate(demo.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
