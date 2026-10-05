import { useCallback, useEffect, useState } from "react";
import { installPrompt, justInstalled, onInstallChange, promptInstall as askBrowser } from "../utils/pwaInstall";

// Tracks installability of the app as a PWA:
// - Chrome/Edge/Android fire `beforeinstallprompt`, which we capture and can
//   trigger later from a button (`promptInstall`).
// - iOS Safari never fires that event; there is no programmatic install API,
//   so we surface `isIos` and the caller shows "Share -> Add to Home Screen"
//   instructions instead.
// - `isInstalled` reflects the standalone/display-mode check so the button
//   hides itself once the app is already installed and running as a PWA.
export default function usePwaInstall() {
  // The install offer is captured at startup (utils/pwaInstall.js): the
  // browser fires it once, often before this button has mounted.
  const [deferredPrompt, setDeferredPrompt] = useState(installPrompt);
  const [isInstalled, setIsInstalled] = useState(justInstalled);

  useEffect(() => {
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const checkInstalled = () =>
      setIsInstalled(
        !!standaloneMql?.matches || window.navigator.standalone === true,
      );
    checkInstalled();
    standaloneMql?.addEventListener?.("change", checkInstalled);

    const sync = () => {
      setDeferredPrompt(installPrompt());
      if (justInstalled()) setIsInstalled(true);
    };
    sync();
    const off = onInstallChange(sync);
    return () => {
      standaloneMql?.removeEventListener?.("change", checkInstalled);
      off();
    };
  }, []);

  // iPadOS reports itself as a Mac; a touch screen gives it away.
  const isIos =
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const canPromptInstall = !!deferredPrompt;

  const promptInstall = useCallback(() => askBrowser(), []); // "accepted" | "dismissed" | null

  return {
    isInstalled,
    isIos,
    canPromptInstall,
    // show the button unless the app is already installed/standalone; iOS
    // has no capture event, so we always offer manual instructions there.
    isInstallable: !isInstalled && (canPromptInstall || isIos),
    promptInstall,
  };
}
