// Ching's memory on the client: fetched once per sign-in, refreshed when it
// gets stale (trips saved since teach it new habits) or after "remember…" /
// "forget…". Readers take the cached value synchronously (the Trip Builder's
// voice fill can't wait on the network mid-sentence).
import { fetchChingMemory } from "../../api/ching";

const STALE_MS = 5 * 60 * 1000;
let state = { token: null, memory: null, at: 0, loading: null };
const listeners = new Set();

export const getChingMemory = () => state.memory;

export function onChingMemory(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Load (or refresh when stale / forced). Never throws: memory is a bonus. */
export function loadChingMemory(token, { force = false } = {}) {
  if (!token) return Promise.resolve(null);
  if (state.token !== token) state = { token, memory: null, at: 0, loading: null };
  const fresh = state.memory && Date.now() - state.at < STALE_MS;
  if (fresh && !force) return Promise.resolve(state.memory);
  if (state.loading && !force) return state.loading;
  const p = fetchChingMemory(token)
    .then((memory) => {
      if (state.token === token) {
        state = { ...state, memory, at: Date.now(), loading: null };
        listeners.forEach((fn) => fn(memory));
      }
      return memory;
    })
    .catch(() => {
      if (state.token === token) state = { ...state, loading: null };
      return state.memory;
    });
  state.loading = p;
  return p;
}

/** Mark stale so the next read refetches (e.g. after a trip is saved). */
export function invalidateChingMemory() {
  state = { ...state, at: 0 };
}
