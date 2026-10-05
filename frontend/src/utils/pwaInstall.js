// The browser's install offer (`beforeinstallprompt`, Chrome / Edge / Android)
// fires ONCE, early in the page load — usually before the dashboard (and its
// Install button) has mounted, e.g. while the agent is still on the login
// page. Captured here at startup (imported first in main.jsx) and kept for
// every Install button that mounts later (hooks/usePwaInstall.js).
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export const installPrompt = () => deferred;
export const justInstalled = () => installed;
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Show the browser's install dialog; "accepted" | "dismissed" | null. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return null;
  deferred = null; // a prompt can only be used once
  emit();
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome || null;
}
