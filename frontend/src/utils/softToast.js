// Calmer toasts, app-wide. Every toast.success/error/info/warn call keys on
// its own message, so the same notice fired again (a retry loop, a re-render,
// several failed requests at once) refreshes the one already on screen
// instead of stacking a new card. Calls that pass their own toastId keep it.
import { toast } from "react-toastify";

const AUTO_CLOSE = { success: 2200, info: 2600, warn: 3500, warning: 3500, error: 4500 };

for (const type of Object.keys(AUTO_CLOSE)) {
  const original = toast[type];
  if (typeof original !== "function" || original.__soft) continue;
  const soft = (content, options = {}) => {
    const key = typeof content === "string" ? `${type}:${content}` : undefined;
    const opts = { autoClose: AUTO_CLOSE[type], ...options };
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
