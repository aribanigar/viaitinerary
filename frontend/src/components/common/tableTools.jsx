import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Trash2, X } from "lucide-react";

// Shared list-page tools: click-to-sort columns, row selection with a
// select-all checkbox, and the bulk action bar ("3 selected · Delete").
// Used by the catalog pages (hotels, vehicles, destinations, activities) and
// My Trips together with CompactDataTable.


/** A header label that sorts its column when clicked (for CompactDataTable headers). */
export function SortLabel({ label, sortKey, sort, onSort, align = "left" }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title={active ? (sort.dir === "asc" ? "Sorted A→Z / low→high — click for reverse" : "Sorted Z→A / high→low — click to clear") : "Sort"}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-700 transition-colors ${
        active ? "text-slate-700" : ""
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      <Icon className={`w-3 h-3 ${active ? "" : "opacity-40"}`} />
    </button>
  );
}

export function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={!!checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded border-slate-300 accent-[var(--color-brand,#0f172a)] cursor-pointer align-middle"
    />
  );
}

/** Header cell content: selects / clears every row on the current page. */
export function SelectAllBox({ pageIds, selection }) {
  const onPage = pageIds.filter((id) => selection.has(id)).length;
  const all = pageIds.length > 0 && onPage === pageIds.length;
  return (
    <Checkbox
      label="Select all on this page"
      checked={all}
      indeterminate={onPage > 0}
      onChange={() => selection.setMany(pageIds, !all)}
    />
  );
}

/** First cell of a row. */
export function RowSelectCell({ id, selection }) {
  return (
    <td className="w-10 !pr-0" onClick={(e) => e.stopPropagation()}>
      <Checkbox label="Select row" checked={selection.has(id)} onChange={() => selection.toggle(id)} />
    </td>
  );
}

/**
 * The bar shown while rows are selected. onDelete(ids) should delete them and
 * resolve; the bar asks for confirmation first.
 */
export function BulkActionBar({ selection, noun = "item", onDelete, deleting = false, children }) {
  const [confirming, setConfirming] = useState(false);
  if (!selection.count) return null;
  const plural = `${selection.count} ${noun}${selection.count === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl mx-4 my-2 shadow-sm">
      <span className="mr-1">{plural} selected</span>
      {children}
      {onDelete &&
        (confirming ? (
          <>
            <span className="text-white/70">Delete {plural}? This can't be undone.</span>
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                await onDelete([...selection.selected]);
                setConfirming(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Yes, delete
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        ))}
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          selection.clear();
        }}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-white/70 hover:text-white"
      >
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  );
}
