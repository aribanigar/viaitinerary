import { useCallback, useEffect, useRef, useState } from "react";

// Undo / redo for the Trip Builder.
//
// Watches the trip snapshot; once it has been still for `settleMs` the
// previous still state is pushed onto the undo stack (so typing a name or a
// burst of state updates from one click is ONE step). Undo/redo hand a past
// snapshot to `restore`, which writes it back through the builder's setters.
//
// - `ready` false (loading) or a new `resetKey` (another trip/tab) clears the
//   history; changes in the first moments after load (normalisation, rates
//   settling) become the baseline, not an undo step.
// - `paused()` true (a live Ching voice session) holds recording until it ends.
// - `same(a, b)` decides whether two snapshots count as the same trip state.
const LIMIT = 50;
const LOAD_GRACE_MS = 1500;

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function useUndoHistory({ snapshot, ready, resetKey, restore, paused, same = sameJson, settleMs = 700 }) {
  const past = useRef([]);
  const future = useRef([]);
  const stable = useRef(null);
  const readyAt = useRef(0);
  const timer = useRef(null);
  const latest = useRef(snapshot);
  // Mirrors of the refs for rendering the buttons.
  const [view, setView] = useState({ undo: 0, redo: 0, stable: null });
  const rerender = () =>
    setView({ undo: past.current.length, redo: future.current.length, stable: stable.current });

  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    clearTimeout(timer.current);
    past.current = [];
    future.current = [];
    stable.current = ready ? latest.current : null;
    readyAt.current = Date.now();
    rerender();
  }, [ready, resetKey]);

  // Turn a pending (not yet settled) edit into an undo step right now.
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const current = latest.current;
    if (!stable.current || same(stable.current, current)) {
      if (stable.current && stable.current !== current) {
        stable.current = current;
        rerender();
      }
      return;
    }
    if (Date.now() - readyAt.current < LOAD_GRACE_MS) {
      stable.current = current;
      rerender();
      return;
    }
    past.current = [...past.current.slice(-(LIMIT - 1)), stable.current];
    future.current = [];
    stable.current = current;
    rerender();
  }, [same]);

  useEffect(() => {
    if (!ready || !stable.current) return undefined;
    clearTimeout(timer.current);
    const tick = () => {
      if (paused?.()) {
        timer.current = setTimeout(tick, settleMs);
        return;
      }
      flush();
    };
    timer.current = setTimeout(tick, settleMs);
    return () => clearTimeout(timer.current);
  }, [snapshot, ready, settleMs, paused, flush]);

  const step = useCallback(
    (from, to) => {
      if (paused?.()) return false;
      flush();
      const target = from.current.pop();
      if (!target) return false;
      to.current.push(latest.current);
      stable.current = target;
      restore(target);
      rerender();
      return true;
    },
    [flush, paused, restore],
  );

  const undo = useCallback(() => step(past, future), [step]);
  const redo = useCallback(() => step(future, past), [step]);

  // Pending edit not yet settled still counts as something to undo.
  const pending = !!view.stable && ready && view.stable !== snapshot && !same(view.stable, snapshot);
  return {
    undo,
    redo,
    canUndo: view.undo > 0 || pending,
    canRedo: view.redo > 0 && !pending,
  };
}

// Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo — but never inside a
// text field, where the browser's own text undo belongs.
export function useUndoShortcuts({ undo, redo, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = e.target;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      if (key === "y" || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, enabled]);
}
