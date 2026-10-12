import React, { useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import usePwaInstall from "../../hooks/usePwaInstall";
import { toast } from "react-toastify";

// "Install app" control — works as a compact pill (desktop) or an icon-only
// button (mobile rails). Hides itself once the app is already installed.
// On iOS (no native install prompt), taps open a small sheet with the
// "Share -> Add to Home Screen" steps instead.
const InstallAppButton = ({ variant = "pill", className = "" }) => {
  const { isInstallable, isIos, canPromptInstall, promptInstall } =
    usePwaInstall();
  const [showIosSheet, setShowIosSheet] = useState(false);

  if (!isInstallable) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("App installed!");
      return;
    }
    if (isIos) setShowIosSheet(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={handleClick}
          title="Install app"
          className={`relative grid place-items-center w-9 h-9 rounded-full bg-white border border-black/5 text-[#181c22]/60 shadow-sm active:bg-black/5 ${className}`}
        >
          <Download className="w-[16px] h-[16px]" strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#181c22] text-white hover:bg-[#181c22]/90 active:bg-[#181c22]/90 transition-colors ${className}`}
        >
          <Download className="w-3.5 h-3.5" /> Install App
        </button>
      )}

      {showIosSheet && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="w-full sm:w-96 bg-white rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#181c22]">
                Install ViaItinerary
              </h3>
              <button
                onClick={() => setShowIosSheet(false)}
                className="w-8 h-8 grid place-items-center rounded-full hover:bg-black/5 active:bg-black/5 text-[#181c22]/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-[#181c22]/80">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#e7f63c] text-[#181c22] text-xs font-bold grid place-items-center">
                  1
                </span>
                <span className="flex items-center gap-1.5 pt-0.5">
                  Tap the Share icon <Share className="w-4 h-4 inline" /> in
                  Safari's toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#e7f63c] text-[#181c22] text-xs font-bold grid place-items-center">
                  2
                </span>
                <span className="flex items-center gap-1.5 pt-0.5">
                  Scroll down and tap "Add to Home Screen"{" "}
                  <SquarePlus className="w-4 h-4 inline" />.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#e7f63c] text-[#181c22] text-xs font-bold grid place-items-center">
                  3
                </span>
                <span className="pt-0.5">Tap "Add" to confirm.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
