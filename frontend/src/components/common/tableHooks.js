import { useEffect, useMemo, useState } from "react";

// Hooks/helpers behind tableTools.jsx (sorting, selection, bulk delete) —
// kept apart from the components so React fast refresh works.

const compare = (a, b) => {
  const empty = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1; // blanks always last
  if (empty(b)) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * useTableSort(rows, accessors, initial?) → { sorted, sort, toggleSort }
 * accessors: { [key]: (row) => value }. Clicking a column sorts ascending,
 * again descending, a third time back to the original order. Blank values
 * stay at the bottom either way.
 */
export function useTableSort(rows, accessors, initial = null) {
  const [sort, setSort] = useState(initial); // { key, dir: "asc" | "desc" } | null
  const toggleSort = (key) =>
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  const sorted = useMemo(() => {
    const get = sort && accessors[sort.key];
    if (!get) return rows;
    const blanksLast = (va, vb) => {
      const c = compare(va, vb);
      const blankA = va == null || va === "";
      const blankB = vb == null || vb === "";
      if (blankA || blankB) return c; // compare() already puts blanks last
      return sort.dir === "desc" ? -c : c;
    };
    return rows
      .map((row, i) => ({ row, i }))
      .sort((x, y) => blanksLast(get(x.row), get(y.row)) || x.i - y.i)
      .map(({ row }) => row);
    // accessors is a static table per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { sorted, sort, toggleSort };
}

/**
 * useSelection(visibleIds) → selection helpers. Selected ids that are no
 * longer in the list (deleted, filtered away) are dropped automatically.
 */
export function useSelection(allIds) {
  const [selected, setSelected] = useState(() => new Set());
  const key = allIds.join("|");
  useEffect(() => {
    setSelected((prev) => {
      const keep = new Set(allIds.filter((id) => prev.has(id)));
      return keep.size === prev.size ? prev : keep;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const clear = () => setSelected(new Set());
  return { selected, count: selected.size, has: (id) => selected.has(id), toggle, setMany, clear };
}

/**
 * Delete ids one by one through the page's own delete call (each still goes
 * through the API's tenant checks). Returns { ok: [...ids], failed: [...] }.
 */
export async function deleteEach(ids, deleteOne, concurrency = 4) {
  const ok = [];
  const failed = [];
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await deleteOne(id);
        ok.push(id);
      } catch (error) {
        failed.push({ id, error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return { ok, failed };
}
