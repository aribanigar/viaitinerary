// The pure half of Ching's kept conversation (chingBus.js holds the state,
// the storage and the server sync): merging two copies, filing lines under
// the trip they were about, and reading that trip off the address bar.

export const MAX_LINES = 200; // keep in step with web/lib/chingConversation.js

const sameLine = (a, b) => a.role === b.role && a.text === b.text && Math.abs((a.at || 0) - (b.at || 0)) < 2000;

/** Two copies of one conversation (this browser's, the server's) → one, in time order. */
export function mergeConversations(local, remote) {
  const lines = [...(local?.lines || [])];
  for (const r of remote?.lines || []) if (!lines.some((l) => sameLine(l, r))) lines.push(r);
  lines.sort((a, b) => (a.at || 0) - (b.at || 0));
  const newer = (remote?.pending?.at || 0) > (local?.pending?.at || 0) ? remote.pending : local?.pending || remote?.pending || null;
  return { lines: lines.slice(-MAX_LINES), threads: { ...(remote?.threads || {}), ...(local?.threads || {}) }, pending: newer };
}

/** The conversation as one thread per trip, newest first: [{ id, title, lines }]. */
export function groupThreads(history = [], threads = {}) {
  const by = new Map();
  for (const l of history) {
    const id = l.thread || "general";
    if (!by.has(id)) by.set(id, { id, title: threads[id]?.title || (id === "general" ? "General" : "New trip"), lines: [] });
    by.get(id).lines.push(l);
  }
  return [...by.values()].sort((a, b) => (b.lines[b.lines.length - 1]?.at || 0) - (a.lines[a.lines.length - 1]?.at || 0));
}

/** The thread of the page the agent is on: the draft or trip in the address bar, else "general". */
export function threadOfLocation(loc = typeof window !== "undefined" ? window.location : null) {
  if (!loc) return "general";
  const q = new URLSearchParams(loc.search || "");
  if (q.get("trip")) return `trip:${q.get("trip")}`;
  const m = /^\/(?:trip-builder|package-builder)\/([^/?#]+)/.exec(loc.pathname || "");
  if (m) return `trip:${m[1]}`;
  if (q.get("d") && /^\/(?:trip-builder|assistant)/.test(loc.pathname || "")) return `draft:${q.get("d")}`;
  return "general";
}
