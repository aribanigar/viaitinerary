// What Ching is doing, for pages that show it (the AI Assistant workspace):
// the conversation, whether it's listening and what it hears, and how far a
// build has got. The ChingWidget writes; pages read with useChingBus().
import { useSyncExternalStore } from "react";

const HISTORY_KEY = "ching_history";
const MAX = 80;

const readHistory = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(v) ? v.slice(-MAX) : [];
  } catch {
    return [];
  }
};

let state = { history: readHistory(), listening: false, interim: "", stage: null, pdfAt: 0, understanding: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

function set(patch) {
  state = { ...state, ...patch };
  emit();
}

/** One line of the conversation: role "you" | "ching". */
export function chingSaid(role, text) {
  const t = String(text || "").trim();
  if (!t) return;
  const last = state.history[state.history.length - 1];
  if (last && last.role === role && last.text === t) return; // spoken + shown = once
  const history = [...state.history, { role, text: t, at: Date.now() }].slice(-MAX);
  set({ history });
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Blocked storage: the conversation just won't survive a reload.
  }
}

export function clearChingHistory() {
  set({ history: [] });
  try {
    sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export const setChingListening = (listening, interim = "") =>
  (state.listening !== listening || state.interim !== interim) && set({ listening, interim });

/** Build walkthrough stage: "Trip Info" | "Itinerary" | "Logistics" | "Pricing" | "PDF" | null. */
export const setChingStage = (stage) => set({ stage, ...(stage === "PDF:done" ? { pdfAt: Date.now(), stage: null } : {}) });

/**
 * What Ching made of the latest request, live while the agent speaks and
 * after: { phase: "listening" | "finishing" | "done", changes, warnings,
 * unrecognized, pending } — shown as "picked up / needs you / didn't catch".
 */
export const setChingUnderstanding = (understanding) => set({ understanding });

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => state;

export const useChingBus = () => useSyncExternalStore(subscribe, snapshot, snapshot);
