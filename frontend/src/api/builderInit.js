// /api/builder/init (the agency's settings, policies and every catalog the
// Trip Builder and Ching pick from) shared by both, so it's fetched once and
// reused instead of blocking every builder open on a fresh round trip.
//
// - loadBuilderInit(token): a fresh copy (in-flight requests are shared).
// - peekBuilderInit(token): the last good copy, from memory or — after a page
//   reload — localStorage, or null. The builder opens a NEW trip from it at
//   once and refreshes in the background.
// - prefetchBuilderInit(token): warm it up (hover on "Create a Trip", idle
//   time on the dashboard); skipped while a recent copy exists.
//
// The stored copy is keyed by the session token, so another login never sees
// it; AuthContext removes the stored copy at logout / session expiry (it
// clears the "builder_init:" keys itself — keep STORE_PREFIX in step).
import { fetchBuilderInit } from "./trips";

const STORE_PREFIX = "builder_init:";
const MAX_STORED_CHARS = 1_500_000; // localStorage holds ~5M UTF-16 chars per origin, shared with drafts
const FRESH_MS = 5 * 60_000; // a prefetch skips a copy younger than this; opening the builder always refreshes

let memory = null; // { token, data, at }
let inflight = null; // { token, promise }

// Short, non-reversible tag for the token (the token itself never goes in a key).
function tag(token) {
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = ((h * 33) ^ token.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function readStored(token) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + tag(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(token, entry) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) localStorage.removeItem(k);
    }
    const json = JSON.stringify(entry);
    if (json.length <= MAX_STORED_CHARS) localStorage.setItem(STORE_PREFIX + tag(token), json);
  } catch {
    /* storage full or blocked — the memory copy still works */
  }
}

export function peekBuilderInit(token) {
  if (!token) return null;
  if (memory && memory.token === token) return memory.data;
  const stored = readStored(token);
  if (stored) {
    memory = { token, data: stored.data, at: 0 }; // from a past page: not "fresh"
    return stored.data;
  }
  return null;
}

export function loadBuilderInit(token) {
  if (inflight && inflight.token === token) return inflight.promise;
  const promise = fetchBuilderInit(token)
    .then((data) => {
      // Only a complete load is worth reusing; a partial one is shown once.
      if (!(Array.isArray(data?.load_errors) && data.load_errors.length)) {
        memory = { token, data, at: Date.now() };
        writeStored(token, { data });
      }
      return data;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { token, promise };
  return promise;
}

export function prefetchBuilderInit(token) {
  if (!token) return;
  if (inflight && inflight.token === token) return;
  if (memory && memory.token === token && Date.now() - memory.at < FRESH_MS) return;
  loadBuilderInit(token).catch(() => {});
}
