// "4N 5D" the way speech recognition actually writes it. Agents say a trip's
// length as "four N five D", and the recognizer turns that into "4 n 5 d",
// "4n5d", "4 and 5 d" or "495" (N heard as "nine", the D dropped). This
// finds the duration in any of those and writes it the way the trip title shows
// it ("4N/5D"). Pure, no imports.

const N_WORD = '(?:n|nights?|nts?|nite|raat|rat|ratein|raatein)'
const D_WORD = '(?:d|days?|din|dee)'

/**
 * The spans in `text` that are a trip length, with the nights each says.
 * `nights` (when known) makes the loose "4 9 5" / "45" readings safe: they
 * only count when they agree with it.
 */
export function findDurations(text, nights = null) {
  const s = String(text || '')
  const out = []
  const push = (m, n, strong) => {
    if (!(n >= 1 && n <= 60)) return
    if (out.some((o) => m.index < o.end && m.index + m[0].length > o.start)) return
    out.push({ start: m.index, end: m.index + m[0].length, nights: n, strong, text: m[0] })
  }
  // "4N 5D", "4 nights 5 days", "4 n & 5 d", "4N/5D", "4 raat 5 din"
  for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})\\s*${N_WORD}\\b[\\s,/&+-]*(?:and\\s+)?(\\d{1,2})\\s*${D_WORD}\\b`, 'gi'))) {
    const n = Number(m[1])
    const d = Number(m[2])
    if (d === n + 1 || d === n) push(m, n, true)
  }
  // "4n5d" glued together
  for (const m of s.matchAll(/\b(\d{1,2})n(\d{1,2})d\b/gi)) push(m, Number(m[1]), true)
  // "5 days 4 nights"
  for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})\\s*${D_WORD}\\b[\\s,/&+-]*(?:and\\s+)?(\\d{1,2})\\s*${N_WORD}\\b`, 'gi'))) {
    push(m, Number(m[2]), true)
  }
  // Misheard: "495" / "4 9 5" / "4 and 5" / "4 n 5" / "45" — the second number one more than the first.
  for (const m of s.matchAll(/\b(\d{1,2})\s*(?:9|nine|n|en|and|&)\s*(\d{1,2})\s*(?:d|days?)?\b/gi)) {
    const n = Number(m[1])
    if (Number(m[2]) === n + 1 && (nights == null || nights === n)) push(m, n, false)
  }
  for (const m of s.matchAll(/\b(\d)9(\d)\b/g)) {
    const n = Number(m[1])
    if (Number(m[2]) === n + 1 && (nights == null || nights === n)) push(m, n, false)
  }
  if (nights != null) {
    for (const m of s.matchAll(/\b(\d)(\d)\b/g)) {
      const n = Number(m[1])
      if (n === nights && Number(m[2]) === n + 1) push(m, n, false)
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** The nights a trip-length answer says ("4N 5D", "495", "5 days" → 4), or null. */
export function readNights(text, nights = null) {
  const s = String(text || '').toLowerCase()
  const [hit] = findDurations(s, nights)
  if (hit) return hit.nights
  const n = s.match(new RegExp(`\\b(\\d{1,2})\\s*${N_WORD}\\b`))
  if (n) return Number(n[1])
  const d = s.match(new RegExp(`\\b(\\d{1,2})\\s*${D_WORD}\\b`))
  if (d && Number(d[1]) > 1) return Number(d[1]) - 1
  const only = s.trim().match(/^(\d{1,2})$/)
  return only ? Number(only[1]) : null
}

/** A title with its trip length written properly: "Kashmir 495" → "Kashmir 4N/5D". */
export function fixDurationText(text, nights = null) {
  const s = String(text || '')
  const hits = findDurations(s, nights)
  if (!hits.length) return s
  let out = ''
  let at = 0
  for (const h of hits) {
    out += s.slice(at, h.start) + `${h.nights}N/${h.nights + 1}D`
    at = h.end
  }
  return (out + s.slice(at)).replace(/\s+/g, ' ').trim()
}
