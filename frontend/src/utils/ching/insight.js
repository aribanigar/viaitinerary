// How Ching is doing — the pure half (insightLog.js sends it; the server keeps
// it: web/lib/chingInsight.js). A request Ching got wrong is logged by its
// SHAPE, not its words: hotel, town and cab names, client names after
// "for", numbers, dates and money are blanked, so "make gulmarg 3 nites" and
// "make pahalgam 2 nites" are ONE weak spot seen twice. Phone numbers and
// emails are scrubbed before anything leaves the browser.
import { placeKey } from './places.js'

const MONTH = '(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)'
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Phone numbers and emails never go into the log. */
export const scrub = (s) =>
  String(s ?? '')
    .slice(0, 400)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/(?:\+?\d[\s-]?){7,}/g, '<phone> ')
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1') // 45,000 → 45000
    .replace(/\s+/g, ' ')
    .trim()

// The agency's own names, longest first, as { re, as } pairs (built once per catalog).
const cache = new WeakMap()
function names(catalog) {
  if (!catalog || typeof catalog !== 'object') return []
  if (cache.has(catalog)) return cache.get(catalog)
  // A name is also said without its first word ("Toyota Innova Crysta" → "innova crysta").
  const add = (list, as, key = (x) => x?.name) =>
    (list || [])
      .map((x) => placeKey(key(x)))
      .flatMap((k) => (k.split(' ').length >= 3 ? [k, k.split(' ').slice(1).join(' ')] : [k]))
      .filter((k) => k && k.length >= 4)
      .map((k) => ({ k, as }))
  const all = [
    ...add(catalog.hotels, '{hotel}'),
    ...add(catalog.vehicles, '{cab}'),
    ...add(catalog.activities, '{activity}'),
    ...add(catalog.destinations, '{place}'),
    ...add(catalog.hotels, '{place}', (h) => String(h?.city || '').split(',')[0]),
  ]
  const seen = new Set()
  const out = all
    .filter((x) => (seen.has(x.k) ? false : seen.add(x.k)))
    .sort((a, b) => b.k.length - a.k.length)
    .slice(0, 600)
    .map((x) => ({ re: new RegExp(`\\b${esc(x.k)}\\b`, 'g'), as: x.as }))
  cache.set(catalog, out)
  return out
}

/** The shape of a sentence: what kind of thing was said, with the particulars blanked. */
export function shapeOf(text, catalog = null) {
  let t = ` ${scrub(text).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9<>'₹ ]+/g, ' ').replace(/\s+/g, ' ')} `
  for (const n of names(catalog)) t = t.replace(n.re, n.as)
  t = t
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?(?: of)? ${MONTH}(?: \\d{4})?\\b`, 'g'), '{date}')
    .replace(new RegExp(`\\b${MONTH} \\d{1,2}(?:st|nd|rd|th)?(?: \\d{4})?\\b`, 'g'), '{date}')
    .replace(/\b(?:today|tomorrow|day after tomorrow|next (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/g, '{date}')
    .replace(/(?:₹|rs\.? ?|inr ?)\d[\d,]*(?:\.\d+)?(?: ?(?:k|lakh|lac))?\b/g, '{money}')
    .replace(/\b\d[\d,]*(?:\.\d+)? ?(?:k|lakh|lac|thousand|rupees)\b/g, '{money}')
    .replace(/\b\d+(?:st|nd|rd|th)?\b/g, '#')
    // A person named after "for" / "client" / "mr": who it was doesn't matter.
    .replace(/\b(for|client|guest|mr|mrs|ms|dr) (?!\{|#|the\b|a\b|an\b|my\b|our\b|me\b|us\b|them\b|him\b|her\b)[a-z]+(?: (?!for\b|from\b|in\b|on\b|to\b|at\b|and\b|with\b)[a-z]+)?(?='s\b| \{| #| for\b| from\b| in\b| on\b| to\b| and\b| with\b| $)/g, '$1 {name}')
    .replace(/(\{[a-z]+\})(?: \1)+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return t.slice(0, 240)
}

/** A short stable id for a shape (djb2). */
export function shapeKey(shape) {
  let h = 5381
  const s = String(shape || '')
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** A miss, ready to send: { type, kind, key, shape, text, page }. */
export function missEvent(kind, text, { catalog = null, page = '' } = {}) {
  const clean = scrub(text)
  if (!clean) return null
  const shape = shapeOf(clean, catalog)
  return { type: 'miss', kind, key: shapeKey(`${kind}|${shape}`), shape, text: clean.slice(0, 300), page: String(page || '').slice(0, 40) }
}

export const MISS_LABEL = {
  unknown: "Didn't understand",
  partial: 'Understood only part',
  corrected: 'Taken back by the agent',
  stuck: 'Got stuck asking',
  'no-trip': 'Edit said with no trip open',
  unmet: 'Nothing in the catalog for it',
}
export const MISS_HINT = {
  unknown: 'Ching had no rule for the sentence. Each one is a phrasing to teach it.',
  partial: 'Ching acted on part of the sentence and skipped the rest.',
  corrected: 'Ching did something and the agent undid or cancelled it straight away: it understood the words but not the wish.',
  stuck: "Ching asked, and didn't understand the answer twice.",
  'no-trip': 'A change was said while no trip was open. Not a language problem: the agent needs to open the trip first.',
  unmet: 'A wish no hotel or place is tagged for. Fix it with data: tick tags on your hotels and destinations.',
}

/** "91.3" → "91%"; null → "–". */
export const pctText = (v) => (v == null ? '–' : `${Math.round(v)}%`)

/** The open misses as plain text, one per line with its count: for whoever teaches Ching next. */
export function missesAsText(misses) {
  return (misses || [])
    .filter((m) => m.status === 'open')
    .map((m) => `[${m.kind} x${m.count || 1}] ${m.examples?.[0] || m.shape}${m.examples?.length > 1 ? `\n    also: ${m.examples.slice(1).join(' | ')}` : ''}\n    shape: ${m.shape}`)
    .join('\n')
}
