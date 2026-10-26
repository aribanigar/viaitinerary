// Sends what Ching missed, and the daily counts, to the server in small
// batches (utils/ching/insight.js makes the events; web/lib/chingInsight.js
// keeps them). Never throws and never blocks a reply: measuring Ching must not
// slow it down.
import { recordChingInsights } from "../../api/ching";
import { missEvent } from "./insight.js";

const FLUSH_MS = 4000;
let token = null;
let queue = [];
let timer = null;

export const setInsightToken = (t) => {
  token = t || null;
};

function schedule() {
  if (timer || !token) return;
  timer = setTimeout(flushInsights, FLUSH_MS);
}

export function flushInsights() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length || !token) return Promise.resolve();
  const events = queue.splice(0, 25);
  return recordChingInsights(token, events)
    .catch(() => {})
    .finally(() => {
      if (queue.length) schedule();
    });
}

/** Count something for today: "turns", "understood", "missed", "partial", "corrected", "plans", "confirmed", "cancelled", "voice", "typed". */
export function logStat(name, n = 1) {
  const last = queue[queue.length - 1];
  if (last?.type === "stat" && last.name === name) last.n += n;
  else queue.push({ type: "stat", name, n });
  schedule();
}

/** A request that went wrong: kind = unknown | partial | corrected | stuck | no-trip | unmet. */
export function logMiss(kind, text, { catalog = null } = {}) {
  const page = typeof window !== "undefined" ? window.location.pathname : "";
  const e = missEvent(kind, text, { catalog, page });
  if (!e || queue.length > 100) return;
  queue.push(e);
  schedule();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushInsights();
  });
}
