/**
 * A trip's `duration` is its number of NIGHTS as text ("5"): the templates,
 * the PDF, the Trip Builder and the crons all read it that way and add the
 * "Nights / Days" words themselves. Older Via Kashmir package syncs stored
 * "5 Nights / 6 Days" there, which printed "5 NIGHTS / 6 DAYS NIGHT 6 DAYS".
 * This reads any of those shapes back to the nights ("5"), or null.
 */
export function nightsOf(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? String(Math.round(value)) : null;
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return s;
  const n = s.match(/(\d+)\s*(?:n\b|nights?|nts?)/i);
  if (n) return String(Number(n[1]));
  const d = s.match(/(\d+)\s*(?:d\b|days?)/i);
  if (d) return String(Math.max(0, Number(d[1]) - 1));
  const any = s.match(/\d+/);
  return any ? String(Number(any[0])) : null;
}
