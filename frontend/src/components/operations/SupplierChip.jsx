import React from "react";

// Supplier confirmation status of a hotel stay / cab (web/lib/operations.js).
const STATUS = {
  confirmed: ["Confirmed", "bg-emerald-50 text-emerald-700"],
  requested: ["Requested", "bg-amber-50 text-amber-700"],
  declined: ["Declined", "bg-red-50 text-red-700"],
  changed: ["Changed — re-confirm", "bg-orange-50 text-orange-700"],
  none: ["Not requested", "bg-slate-100 text-slate-600"],
};

export default function SupplierChip({ status }) {
  const [label, cls] = STATUS[status] || STATUS.none;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}
