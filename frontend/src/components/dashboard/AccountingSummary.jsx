import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  TrendingUp,
  Wallet,
  Hotel,
  Car,
  PiggyBank,
  AlertTriangle,
  Download,
  Eye,
  BellRing,
  Target,
  Receipt,
  BarChart3,
  Table2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { fetchAccountingReport } from "../../api/accounting";
import { sendReminder } from "../../api/trips";
import Modal from "../common/Modal";
import Loader from "../common/Loader";
import CompactDataTable from "../common/CompactDataTable";
import DateRangePicker from "./DateRangePicker";

// Validated categorical pair (blue / aqua) — see the dataviz palette check.
const SERIES = { sales: "#2a78d6", profit: "#1baf7a" };

const pad = (n) => String(n).padStart(2, "0");
const toDay = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");

const parseCurrencySymbol = (currency) => {
  if (!currency || typeof currency !== "string") return "₹";
  const match = currency.match(/\((.*?)\)/);
  return match?.[1] || "₹";
};
const money = (symbol, value) =>
  `${symbol}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const compact = (symbol, value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${symbol}${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${symbol}${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(0)}k`;
  return `${symbol}${n.toFixed(0)}`;
};
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;
const shortDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Tile({ icon, label, value, sub, tone = "slate" }) {
  const Icon = icon;
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    indigo: "bg-indigo-50 text-indigo-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 truncate">{value}</div>
      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{sub}</div>
    </div>
  );
}

function Card({ title, hint, right, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          {hint ? <p className="text-xs text-slate-400 font-medium mt-0.5">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const TabButtons = ({ value, onChange, options }) => (
  <div className="flex items-center gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        className={`px-3 py-1.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
          value === o.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {o.icon ? <o.icon className="w-3.5 h-3.5" /> : null}
        {o.label}
      </button>
    ))}
  </div>
);

const AccountingSummary = () => {
  const { token } = useAuth();
  const [range, setRange] = useState(() => {
    const e = new Date();
    return { start: new Date(e.getFullYear(), e.getMonth(), 1), end: e };
  });
  const [basis, setBasis] = useState("travel");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [trendView, setTrendView] = useState("chart");
  const [vendorTab, setVendorTab] = useState("hotels");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [reminding, setReminding] = useState("");

  const from = toDay(range.start);
  const to = toDay(range.end);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchAccountingReport(token, {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      basis,
      tz: new Date().getTimezoneOffset(),
    })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "Failed to load reports.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, from, to, basis, reload]);

  const k = report?.kpi || {};
  const sym = parseCurrencySymbol(report?.currencies?.[0]);
  const mixed = (report?.currencies?.length || 0) > 1;
  const months = useMemo(
    () => (report?.months || []).map((m) => ({ ...m, label: monthLabel(m.month) })),
    [report],
  );
  const vendors = report?.vendors?.[vendorTab] || [];
  const collectedShare = k.sales ? (k.collected / k.sales) * 100 : 0;

  const remind = async (row) => {
    setReminding(row.trip_id);
    try {
      const res = await sendReminder(token, row.trip_id, "payment");
      toast.success(`Payment reminder sent${res?.sent_to ? ` to ${res.sent_to}` : ""}.`);
    } catch (err) {
      toast.error(err.message || "Couldn't send the reminder.");
    } finally {
      setReminding("");
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      [`Report (${basis === "booking" ? "by booking date" : "by travel date"})`, from || "all", to || "all"],
      [],
      ["Metric", "Value"],
      ["Booked trips", k.booked],
      ["Sales (incl. GST)", k.sales],
      ["GST", k.gst],
      ["Net sales", k.net],
      ["Hotel cost", k.hotelCost],
      ["Cab cost", k.cabCost],
      ["Activity cost", k.activityCost],
      ["Gross profit", k.profit],
      ["Margin %", k.margin],
      ["Collected", k.collected],
      ["Outstanding", k.outstanding],
      ["Overdue", k.overdue],
      ["Hotels due", k.hotelDue],
      ["Cabs due", k.cabDue],
      ["Open quotes", k.quotes],
      ["Quote value", k.quoteValue],
      ["Lost trips", k.lost],
      ["Conversion %", k.conversion],
      [],
      ["Month", "Trips", "Sales", "Net", "Costs", "Profit", "Collected"],
      ...(report.months || []).map((m) => [m.month, m.trips, m.sales, m.net, m.costs, m.profit, m.collected]),
      [],
      ["Receivables: Trip", "Client", "Phone", "Travel date", "Sales", "Received", "Outstanding", "Overdue"],
      ...(report.receivables || []).map((r) => [r.trip_id, r.client_name, r.client_phone, r.start_date, r.sales, r.received, r.outstanding, r.overdue ? "yes" : "no"]),
      [],
      ["Vendor", "Type", "To pay", "Paid", "Due", "Trips"],
      ...["hotels", "cabs"].flatMap((t) =>
        (report.vendors?.[t] || []).map((v) => [v.party_name, t === "hotels" ? "Hotel" : "Cab", v.expected_total, v.settled_total, v.due, v.trips_count]),
      ),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from || "all"}_${to || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">Reports</h1>
        <p className="text-slate-400 font-medium mt-1">
          Sales, profit, collections and supplier dues for every trip in the range.
        </p>
      </div>

      <div className="max-w-6xl space-y-6 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker initialPreset="ThisMonth" onApply={(r) => setRange(r)} />
            <TabButtons
              value={basis}
              onChange={setBasis}
              options={[
                { value: "travel", label: "By travel date" },
                { value: "booking", label: "By booking date" },
              ]}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-semibold">
              {loading ? "Loading…" : `${k.trips || 0} trips in range`}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!report}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {mixed ? (
          <div className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Trips in this range use more than one currency ({report.currencies.join(", ")}); totals add them together.
          </div>
        ) : null}

        {loading && !report ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <Loader text="Building your report..." />
          </div>
        ) : (
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Tile
                icon={TrendingUp}
                tone="emerald"
                label="Sales"
                value={money(sym, k.sales)}
                sub={`${k.booked || 0} booked · avg ${money(sym, k.avgBooking)}`}
              />
              <Tile
                icon={PiggyBank}
                tone="indigo"
                label="Gross profit"
                value={money(sym, k.profit)}
                sub={`${pct(k.margin)} margin on ${money(sym, k.net)} net of GST`}
              />
              <Tile
                icon={Wallet}
                tone="sky"
                label="Collected"
                value={money(sym, k.collected)}
                sub={`${pct(collectedShare)} of sales received`}
              />
              <Tile
                icon={AlertTriangle}
                tone={k.overdue > 0 ? "rose" : "amber"}
                label="Outstanding"
                value={money(sym, k.outstanding)}
                sub={k.overdue > 0 ? `${money(sym, k.overdue)} overdue (already travelled)` : "Nothing overdue"}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Tile
                icon={Receipt}
                tone="slate"
                label="Supplier costs"
                value={money(sym, k.costs)}
                sub={`Hotels ${compact(sym, k.hotelCost)} · Cabs ${compact(sym, k.cabCost)} · Activities ${compact(sym, k.activityCost)}`}
              />
              <Tile
                icon={Hotel}
                tone="indigo"
                label="Hotels due"
                value={money(sym, k.hotelDue)}
                sub={`${money(sym, k.hotelPaid)} already paid`}
              />
              <Tile icon={Car} tone="sky" label="Cabs due" value={money(sym, k.cabDue)} sub={`${money(sym, k.cabPaid)} already paid`} />
              <Tile
                icon={Target}
                tone="amber"
                label="Pipeline"
                value={money(sym, k.quoteValue)}
                sub={`${k.quotes || 0} open quotes · ${pct(k.conversion)} converted · ${k.lost || 0} lost`}
              />
            </div>

            <Card
              title="Monthly trend"
              hint={basis === "booking" ? "Booked trips by the month they were created." : "Booked trips by the month they travel."}
              right={
                <TabButtons
                  value={trendView}
                  onChange={setTrendView}
                  options={[
                    { value: "chart", label: "Chart", icon: BarChart3 },
                    { value: "table", label: "Table", icon: Table2 },
                  ]}
                />
              }
            >
              {months.length === 0 ? (
                <div className="py-14 text-center text-xs text-slate-400 font-semibold">No booked trips in this range.</div>
              ) : trendView === "chart" ? (
                <div className="h-72 px-2 py-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={months} barGap={2} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#eef0f3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e2e8f0" }} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v) => compact(sym, v)}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(15,23,42,0.04)" }}
                        formatter={(v, name) => [money(sym, v), name]}
                        labelStyle={{ fontWeight: 700, color: "#0f172a" }}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => <span style={{ color: "#334155", fontWeight: 600 }}>{value}</span>}
                      />
                      <Bar dataKey="sales" name="Sales" fill={SERIES.sales} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="profit" name="Gross profit" fill={SERIES.profit} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-widest text-slate-400">
                      <tr>
                        {["Month", "Trips", "Sales", "Supplier costs", "Gross profit", "Collected"].map((h) => (
                          <th key={h} className="px-5 py-3 font-black">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                      {months.map((m) => (
                        <tr key={m.month}>
                          <td className="px-5 py-3 text-slate-900">{m.label}</td>
                          <td className="px-5 py-3">{m.trips}</td>
                          <td className="px-5 py-3">{money(sym, m.sales)}</td>
                          <td className="px-5 py-3">{money(sym, m.costs)}</td>
                          <td className="px-5 py-3">{money(sym, m.profit)}</td>
                          <td className="px-5 py-3">{money(sym, m.collected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Who owes you" hint="Booked trips with money still to collect — overdue first, then by travel date.">
              <CompactDataTable
                headers={["Trip", "Client", "Travel", "Sales", "Received", "Outstanding", ""]}
                loading={false}
                hasRows={(report?.receivables || []).length > 0}
                colSpan={7}
                emptyTitle="Nothing outstanding"
                emptyDescription="Every booked trip in this range is fully paid."
                tableWrapClassName="overflow-x-auto"
                tbodyClassName="divide-y divide-slate-50 text-xs font-medium [&_td]:!px-4 [&_td]:!py-3"
              >
                {(report?.receivables || []).map((r) => (
                  <tr key={r.trip_id}>
                    <td>
                      <Link to={`/trip-builder/${r.trip_id}`} className="font-bold text-slate-900 hover:underline">
                        {r.trip_id}
                      </Link>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.trip_title}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900">{r.client_name || "—"}</div>
                      <div className="text-[11px] text-slate-500">{r.client_phone}</div>
                    </td>
                    <td>
                      <div>{shortDate(r.start_date)}</div>
                      <div className={`text-[11px] font-bold ${r.overdue ? "text-rose-600" : "text-slate-500"}`}>
                        {r.overdue
                          ? "Overdue"
                          : r.days_to_travel == null
                            ? ""
                            : r.days_to_travel === 0
                              ? "Travels today"
                              : `In ${r.days_to_travel} day${r.days_to_travel === 1 ? "" : "s"}`}
                      </div>
                    </td>
                    <td>{money(sym, r.sales)}</td>
                    <td className="text-emerald-700 font-semibold">{money(sym, r.received)}</td>
                    <td className="text-rose-600 font-bold">{money(sym, r.outstanding)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => remind(r)}
                        disabled={reminding === r.trip_id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        title="Email the client a payment reminder"
                      >
                        <BellRing className="w-3.5 h-3.5" /> {reminding === r.trip_id ? "Sending…" : "Remind"}
                      </button>
                    </td>
                  </tr>
                ))}
              </CompactDataTable>
            </Card>

            <Card
              title="Supplier dues"
              hint="What you owe hotels and cabs for booked trips in the range."
              right={
                <TabButtons
                  value={vendorTab}
                  onChange={setVendorTab}
                  options={[
                    { value: "hotels", label: `Hotels (${report?.vendors?.hotels?.length || 0})` },
                    { value: "cabs", label: `Cabs (${report?.vendors?.cabs?.length || 0})` },
                  ]}
                />
              }
            >
              <CompactDataTable
                headers={[{ label: "Vendor", className: "w-[36%]" }, "To pay", "Paid", "Due", "Trips", ""]}
                loading={false}
                hasRows={vendors.length > 0}
                colSpan={6}
                emptyTitle={`No ${vendorTab} in this range`}
                emptyDescription="Try a different date range."
                tableWrapClassName="overflow-x-auto"
                tbodyClassName="divide-y divide-slate-50 text-xs font-medium [&_td]:!px-4 [&_td]:!py-3"
              >
                {vendors.map((v) => (
                  <tr key={`${v.party_id}-${v.party_name}`}>
                    <td className="font-bold text-slate-900">{v.party_name}</td>
                    <td>{money(sym, v.expected_total)}</td>
                    <td className="text-emerald-700 font-semibold">{money(sym, v.settled_total)}</td>
                    <td className={`font-bold ${v.due > 0 ? "text-rose-600" : "text-slate-400"}`}>{money(sym, v.due)}</td>
                    <td>{v.trips_count}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedVendor(v)}
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-50"
                        aria-label={`View ${v.party_name}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </CompactDataTable>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Top destinations" hint="Booked sales and profit by destination.">
                <RankTable
                  rows={report?.destinations || []}
                  empty="No booked trips yet."
                  cols={[
                    { label: "Destination", render: (d) => <span className="font-bold text-slate-900">{d.destination}</span> },
                    { label: "Trips", render: (d) => d.trips },
                    { label: "Sales", render: (d) => money(sym, d.sales) },
                    { label: "Profit", render: (d) => money(sym, d.profit) },
                  ]}
                />
              </Card>
              <Card title="Top clients" hint="Your biggest clients in the range.">
                <RankTable
                  rows={report?.clients || []}
                  empty="No booked trips yet."
                  cols={[
                    {
                      label: "Client",
                      render: (c) => (
                        <div>
                          <div className="font-bold text-slate-900">{c.client_name}</div>
                          <div className="text-[11px] text-slate-500">{c.client_phone}</div>
                        </div>
                      ),
                    },
                    { label: "Trips", render: (c) => c.trips },
                    { label: "Sales", render: (c) => money(sym, c.sales) },
                    { label: "Owes", render: (c) => (c.outstanding > 0 ? <span className="text-rose-600 font-bold">{money(sym, c.outstanding)}</span> : "—") },
                  ]}
                />
              </Card>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Booked = confirmed or completed trips, plus any trip with a payment received. Sales are the quoted
              price including GST; gross profit = sales − GST − hotel, cab and activity costs. Open quotes and lost
              trips are counted only in Pipeline.{" "}
              <button type="button" onClick={() => setReload((n) => n + 1)} className="underline font-semibold">
                Refresh
              </button>
            </p>
          </div>
        )}
      </div>

      <Modal isOpen={!!selectedVendor} onClose={() => setSelectedVendor(null)} pureContent={true}>
        <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900">{selectedVendor?.party_name || "Vendor"}</h2>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
              {selectedVendor?.trips_count || 0} trips · {money(sym, selectedVendor?.due)} due
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 text-[11px]">
                <tr>
                  <th className="py-2">Trip</th>
                  <th className="py-2">Travel</th>
                  <th className="py-2">To pay</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Due</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {(selectedVendor?.trips || []).map((t) => (
                  <tr key={t.trip_id}>
                    <td className="py-3 font-bold">
                      <Link to={`/trip-builder/${t.trip_id}`} className="hover:underline">
                        {t.trip_id}
                      </Link>{" "}
                      — {t.trip_title}
                    </td>
                    <td className="py-3">{shortDate(t.start_date)}</td>
                    <td className="py-3">{money(sym, t.expected_amount)}</td>
                    <td className="py-3 text-emerald-600 font-semibold">{money(sym, t.settled_amount)}</td>
                    <td className="py-3 text-rose-600 font-semibold">
                      {money(sym, Math.max(0, Number(t.expected_amount || 0) - Number(t.settled_amount || 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">Record supplier payments in the Ledger.</p>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

function RankTable({ rows, cols, empty }) {
  if (!rows.length) return <div className="py-10 text-center text-xs text-slate-400 font-semibold">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-widest text-slate-400">
          <tr>
            {cols.map((c) => (
              <th key={c.label} className="px-5 py-3 font-black">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.label} className="px-5 py-3">{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AccountingSummary;
