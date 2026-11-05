import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Reports → Monthly trend (sales vs gross profit), split out of
// AccountingSummary.jsx so recharts loads after the page has drawn.
// Validated categorical pair (blue / aqua) — see the dataviz palette check.
const SERIES = { sales: "#2a78d6", profit: "#1baf7a" };

export default function ReportTrendChart({ months, money, compact }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={months} barGap={2} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e2e8f0" }} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={compact} />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.04)" }}
          formatter={(v, name) => [money(v), name]}
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
  );
}
