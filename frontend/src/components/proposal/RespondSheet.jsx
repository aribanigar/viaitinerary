import React, { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";

// Approve / request-changes form for the public proposal page. Bottom sheet on
// phones, centred card from `sm` up. Mount it only while open (with a `key`
// per mode) so every opening starts fresh.
export default function RespondSheet({
  mode, // "approve" | "changes"
  agencyName,
  defaultName = "",
  brand,
  brandText,
  onSubmit, // async ({ name, message }) => void; throws Error with .status
  onClose,
}) {
  const approving = mode === "approve";
  const [name, setName] = useState(defaultName || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const canSubmit = !submitting && (approving || message.trim().length > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), message: message.trim() });
      setDone(true);
    } catch (err) {
      setError(
        err?.status === 429
          ? "Please wait a minute and try again."
          : err?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const who = agencyName || "your travel agent";
  const field =
    "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[16px] sm:text-sm text-[#181c22] outline-none focus:border-[#181c22] placeholder:text-[#181c22]/35";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[#181c22]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={approving ? "Approve trip" : "Request changes"}
        className="relative w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[24px] shadow-2xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden mx-auto mt-2 w-10 h-1 rounded-full bg-black/10" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full text-[#181c22]/55 hover:bg-black/[0.05]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="px-6 pt-8 pb-7 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: brand }} strokeWidth={1.8} />
            <h2 className="mt-3 text-lg font-semibold text-[#181c22]">
              {approving ? "Trip approved" : "Thanks!"}
            </h2>
            <p className="mt-1.5 text-sm text-[#181c22]/65">
              {approving
                ? `${who} will contact you with the next steps.`
                : `We've shared your changes with ${who}.`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full h-11 rounded-full text-sm font-semibold"
              style={{ background: brand, color: brandText }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 sm:px-6 pt-5 pb-6 space-y-4">
            <div className="pr-10">
              <h2 className="text-lg font-semibold text-[#181c22]">
                {approving ? "Approve this trip" : "Request changes"}
              </h2>
              <p className="mt-1 text-sm text-[#181c22]/60">
                {approving
                  ? `Let ${who} know you're happy to go ahead.`
                  : `Tell ${who} what you'd like to change — dates, hotels, activities, anything.`}
              </p>
            </div>

            <div>
              <label htmlFor="proposal-name" className="block mb-1.5 text-xs font-semibold text-[#181c22]/60">
                Your name
              </label>
              <input
                id="proposal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                className={field}
              />
            </div>

            <div>
              <label htmlFor="proposal-message" className="block mb-1.5 text-xs font-semibold text-[#181c22]/60">
                {approving ? "Note (optional)" : "What would you like to change?"}
              </label>
              <textarea
                id="proposal-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={approving ? 3 : 5}
                maxLength={2000}
                required={!approving}
                placeholder={
                  approving
                    ? "Anything we should know?"
                    : "e.g. One more night in Gulmarg, and a hotel closer to the lake in Srinagar."
                }
                className={`${field} resize-none`}
              />
            </div>

            {error && (
              <p className="rounded-xl bg-[#fff4f3] border border-[#ff5a4d]/30 px-3 py-2 text-sm text-[#b42318]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={
                approving
                  ? { background: brand, color: brandText }
                  : { background: "#181c22", color: "#ffffff" }
              }
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {approving ? "Approve trip" : "Send changes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
