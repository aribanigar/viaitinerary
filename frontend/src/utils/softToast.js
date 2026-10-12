// Calmer toasts, app-wide.
//
// 1. Routine confirmations are silent. A success/info toast that only repeats
//    what the screen already shows ("Saved successfully!", "Template loaded",
//    "Draft cleared") is dropped. One is still shown when it reports something
//    that happened out of sight — an email/WhatsApp sent, a link copied, an
//    import or sync — when it carries a link/JSX, when the call stays open on
//    purpose (autoClose false or long), or when it passes `{ keep: true }`.
//    Errors and warnings always show.
// 2. No stacking: each call keys on its own message, so the same notice fired
//    again refreshes the card already on screen. Calls that pass their own
//    toastId keep it.
import { toast } from "react-toastify";

const AUTO_CLOSE = { success: 2200, info: 2600, warn: 3500, warning: 3500, error: 4500 };
const QUIET = new Set(["success", "info"]);
const WORTH_SAYING =
  /cop(y|ied)|clipboard|sent|send|email|queued|whats ?app|otp|code|synced|import|skipped|refresh|version|client:/i;

function worthShowing(type, content, options) {
  if (!QUIET.has(type)) return true;
  if (options.keep) return true;
  if (options.autoClose === false || options.autoClose >= 5000) return true;
  if (typeof content !== "string") return true;
  return WORTH_SAYING.test(content);
}

for (const type of Object.keys(AUTO_CLOSE)) {
  const original = toast[type];
  if (typeof original !== "function" || original.__soft) continue;
  const soft = (content, options = {}) => {
    if (!worthShowing(type, content, options)) return undefined;
    const opts = { autoClose: AUTO_CLOSE[type], ...options };
    delete opts.keep;
    const key = typeof content === "string" ? `${type}:${content}` : undefined;
    if (key && opts.toastId == null) {
      opts.toastId = key;
      if (toast.isActive(key)) {
        toast.update(key, { render: content, autoClose: opts.autoClose });
        return key;
      }
    }
    return original(content, opts);
  };
  soft.__soft = true;
  toast[type] = soft;
}
