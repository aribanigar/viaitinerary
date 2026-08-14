import { useCallback, useEffect, useState } from "react";

// Tracks installability of the app as a PWA:
// - Chrome/Edge/Android fire `beforeinstallprompt`, which we capture and can
//   trigger later from a button (`promptInstall`).
// - iOS Safari never fires that event; there is no programmatic install API,
//   so we surface `isIos` and the caller shows "Share -> Add to Home Screen"
//   instructions instead.
// - `isInstalled` reflects the standalone/display-mode check so the button
//   hides itself once the app is already installed and running as a PWA.
export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const checkInstalled = () =>
      setIsInstalled(
        !!standaloneMql?.matches || window.navigator.standalone === true,
      );
    checkInstalled();
    standaloneMql?.addEventListener?.("change", checkInstalled);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standaloneMql?.removeEventListener?.("change", checkInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const canPromptInstall = !!deferredPrompt;

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome; // "accepted" | "dismissed"
  }, [deferredPrompt]);

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
