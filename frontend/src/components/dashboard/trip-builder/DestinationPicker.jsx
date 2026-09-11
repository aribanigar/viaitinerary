import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";

/**
 * Searchable destination picker, grouped by State (falling back to "Other"
 * for destinations without one — e.g. legacy rows created before state was
 * tracked). Replaces a plain <select>, which had no search and couldn't be
 * grouped at all.
 */
const DestinationPicker = ({
  destinations,
  value,
  onSelect,
  placeholder = "Select destination",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = destinations.find((d) => String(d.id) === String(value));

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? destinations.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.state || "").toLowerCase().includes(q),
        )
      : destinations;

    const byState = new Map();
    for (const d of filtered) {
      const key = d.state || "Other";
      if (!byState.has(key)) byState.set(key, []);
      byState.get(key).push(d);
    }

    return Array.from(byState.entries())
      .sort(([a], [b]) => {
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return a.localeCompare(b);
      })
      .map(([state, items]) => [
        state,
        items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      ]);
  }, [destinations, query]);

  const handlePick = (dest) => {
    onSelect(dest);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-[#f3f3f4] border border-black/10 rounded-lg py-2 px-3 text-[13px] font-bold text-[#3a4250] focus:outline-none focus:ring-2 focus:ring-[#e7f63c]/10 transition-all cursor-pointer hover:border-black/15 text-left"
      >
        <span className={selected ? "" : "text-[#9aa3b2] font-medium"}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#9aa3b2]" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-64 bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-black/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9aa3b2]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search destinations or state…"
                className="w-full bg-[#f3f3f4] rounded-lg py-1.5 pl-8 pr-3 text-xs font-semibold text-[#181c22] focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 && (
              <div className="px-3 py-4 text-xs font-medium text-[#9aa3b2] text-center">
                No destinations match "{query}"
              </div>
            )}
            {groups.map(([state, items]) => (
              <div key={state}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-[#9aa3b2] bg-[#f9f9f9] sticky top-0">
                  {state}
                </div>
                {items.map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => handlePick(dest)}
                    className={`w-full text-left px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      String(dest.id) === String(value)
                        ? "bg-[#181c22] text-white"
                        : "text-[#3a4250] hover:bg-black/[0.04]"
                    }`}
                  >
                    {dest.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DestinationPicker;
