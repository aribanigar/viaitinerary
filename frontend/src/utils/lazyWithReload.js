import { lazy } from "react";

const RELOAD_KEY = "chunk_reload_at";

// After a deploy, a tab that was already open still points at the previous
// build's hashed chunk files, which no longer exist — the next lazy screen
// it opens (often the dashboard right after logging in) fails to load. One
// full reload picks up the new build; the timestamp guard stops a genuinely
// broken chunk from reload-looping.
export function reloadOnceForStaleChunks() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export default function lazyWithReload(factory) {
  return lazy(() =>
    factory().catch((err) => {
      // Never settles — the page is already reloading.
      if (reloadOnceForStaleChunks()) return new Promise(() => {});
      throw err;
    }),
  );
}
