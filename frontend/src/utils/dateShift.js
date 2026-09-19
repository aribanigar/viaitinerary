// Pure date-string helpers for shifting a trip's accommodation/transport
// dates when its start date is preponed/postponed. Dates in this app are
// plain "yyyy-MM-dd" (optionally "yyyy-MM-dd HH:mm") strings — see
// DatePicker's handleChange — so these operate on the string directly with
// UTC-based arithmetic to avoid local-timezone off-by-one drift.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(.*)$/;

/** Whole days between two "yyyy-MM-dd..." strings (b - a). 0 if either is unparseable. */
export function daysBetween(dateStrA, dateStrB) {
  const a = String(dateStrA || "").match(DATE_RE);
  const b = String(dateStrB || "").match(DATE_RE);
  if (!a || !b) return 0;
  const utcA = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const utcB = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((utcB - utcA) / 86400000);
}

/** Shift a "yyyy-MM-dd" or "yyyy-MM-dd HH:mm" string by `deltaDays`, keeping any time suffix. */
export function shiftDateString(dateStr, deltaDays) {
  if (!dateStr || !deltaDays) return dateStr;
  const match = String(dateStr).match(DATE_RE);
  if (!match) return dateStr;
  const [, y, m, d, rest] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}${rest}`;
}
