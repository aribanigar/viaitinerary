// What Ching is doing, for pages that show it (the AI Assistant workspace):
// the conversation, whether it's listening and what it hears, and how far a
// build has got. The ChingWidget writes; pages read with useChingBus().
import { useSyncExternalStore } from "react";

import { fetchChingConversation, saveChingConversation, clearChingConversation as clearOnServer } from "../../api/ching";
import { MAX_LINES, mergeConversations, groupThreads, threadOfLocation } from "./conversation.js";

export { mergeConversations, threadOfLocation };

// The conversation is KEPT (since 2026-10-13): in this browser at once
// (localStorage, per signed-in user) and on the server a moment later
// (/api/ching/conversation), so it is still there after a reload, in another
// tab, tomorrow, or on the agent's phone. Kept with it:
//  - `thread` on every line — the trip it was about ("draft:<key>" / "trip:<id>"
//    / "general"), so one long history reads as a conversation per trip;
//  - `pending` — the trip request Ching was still asking about (brief.js
//    state), so a reload mid-question picks up at the same question.
const MAX = MAX_LINES;
const LEGACY_KEY = "ching_history"; // the old per-tab copy
const SYNC_MS = 1500;
const keyFor = (uid) => `ching_conversation:${uid || "anon"}`;

let owner = { uid: null, token: null }; // whose conversation this is
let syncTimer = null;
let dirty = false;

const readLocal = (uid) => {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(uid)) || "null");
    if (v && Array.isArray(v.lines)) return { history: v.lines.slice(-MAX), threads: v.threads || {}, pending: v.pending || null, thread: "general" };
    // First run after the upgrade: carry this tab's old history over.
    const old = JSON.parse(sessionStorage.getItem(LEGACY_KEY) || "[]");
    return { history: Array.isArray(old) ? old.slice(-MAX) : [], threads: {}, pending: null, thread: "general" };
  } catch {
    return { history: [], threads: {}, pending: null, thread: "general" };
  }
};

let state = { ...readLocal(null), listening: false, interim: "", stage: null, pdfAt: 0, understanding: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

function set(patch) {
  state = { ...state, ...patch };
  emit();
}

const payload = () => ({ lines: state.history, threads: state.threads, pending: state.pending });

function persist() {
  try {
    localStorage.setItem(keyFor(owner.uid), JSON.stringify({ ...payload(), at: Date.now() }));
  } catch {
    // Blocked or full storage: the server copy still has it.
  }
  dirty = true;
  if (!owner.token || syncTimer) return;
  syncTimer = setTimeout(flushChingConversation, SYNC_MS);
}

/** Send what's unsaved to the server now (also called when the tab is hidden). */
export function flushChingConversation() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  if (!dirty || !owner.token) return Promise.resolve();
  dirty = false;
  return saveChingConversation(owner.token, payload()).catch(() => {
    dirty = true; // tried again with the next line
  });
}

/**
 * Whose conversation to show: called when the agent signs in (and with null on
 * sign-out). Shows this browser's copy at once, then folds in the server's.
 */
export function initChingConversation(token, uid) {
  if (owner.uid === (uid ?? null) && owner.token === (token ?? null)) return Promise.resolve();
  flushChingConversation();
  owner = { uid: uid ?? null, token: token ?? null };
  dirty = false;
  set(readLocal(owner.uid));
  if (!token) return Promise.resolve();
  const mine = owner;
  return fetchChingConversation(token)
    .then((remote) => {
      if (owner !== mine || !remote) return;
      const merged = mergeConversations(payload(), remote);
      const changed = merged.lines.length !== state.history.length || JSON.stringify(merged.pending) !== JSON.stringify(state.pending);
      if (!changed) return;
      set({ history: merged.lines, threads: merged.threads, pending: merged.pending });
      try {
        localStorage.setItem(keyFor(owner.uid), JSON.stringify({ ...payload(), at: Date.now() }));
      } catch {
        // ignore
      }
    })
    .catch(() => {});
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushChingConversation();
  });
}

/** The trip the next lines are about: "draft:<key>" | "trip:<id>" | "general" (+ its title, when known). */
export function setChingThread(thread, title = "") {
  const id = String(thread || "general").slice(0, 60);
  const known = state.threads[id];
  const named = title && (!known || known.title !== title);
  if (state.thread === id && !named) return;
  const threads = named ? { ...state.threads, [id]: { title: String(title).slice(0, 120), at: Date.now() } } : state.threads;
  set({ thread: id, threads });
  if (named) persist();
}

/** The trip request Ching is still asking about (or null once it is planned / dropped). */
export function setChingPending(pending) {
  const next = pending ? { ...pending, thread: pending.thread || state.thread, at: Date.now() } : null;
  if (!next && !state.pending) return;
  set({ pending: next });
  persist();
}
export const getChingPending = () => state.pending;

/** One line of the conversation: role "you" | "ching". */
export function chingSaid(role, text) {
  const t = String(text || "").trim();
  if (!t) return;
  const last = state.history[state.history.length - 1];
  if (last && last.role === role && last.text === t) return; // spoken + shown = once
  const history = [...state.history, { role, text: t, at: Date.now(), thread: state.thread }].slice(-MAX);
  set({ history });
  persist();
}

/** "Clear our conversation": here and on the server. What Ching has learned stays. */
export function clearChingHistory() {
  set({ history: [], threads: {}, pending: null });
  dirty = false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  try {
    localStorage.removeItem(keyFor(owner.uid));
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  return owner.token ? clearOnServer(owner.token).catch(() => {}) : Promise.resolve();
}
export const clearChingConversation = () => clearChingHistory();

/** The conversation as one thread per trip, newest first: [{ id, title, lines }]. */
export const chingThreads = (history = state.history, threads = state.threads) => groupThreads(history, threads);

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
