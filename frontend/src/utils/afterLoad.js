// Run `fn` once the page has finished loading AND the browser is idle.
// requestIdleCallback alone isn't enough: the browser counts itself "idle"
// while it waits on the network, so on a slow phone "idle" work started
// downloading alongside the screen's own code. Returns a cancel function.
export function afterLoad(fn, { timeout = 2500 } = {}) {
  let idleId = null;
  let timer = null;
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(run, { timeout });
    else timer = window.setTimeout(run, 300);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
  return () => {
    done = true;
    window.removeEventListener("load", idle);
    if (idleId != null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    if (timer != null) window.clearTimeout(timer);
  };
}
