// Spoken self-corrections, applied before Ching parses a request. Pure.
//
//   "3 nights no sorry 4 nights"            → "4 nights"
//   "2 adults i mean 3"                     → "3 adults"
//   "grand mumtaz actually make it lalit"   → "lalit"
//   "innova no wait dzire"                  → "dzire"
//
// Only a correction of the SAME kind is applied — a count for a count, a
// catalog hotel for a hotel, a catalog cab for a cab — so "no cab", "no gst"
// or "sorry" on its own never delete anything.

import { prepareCatalog, matchHotel } from './parseCommand.js'
import { levRatio } from './fuzzy.js'

const UNITS = 'nights?|nites?|days?|adults?|kids?|children|child|rooms?|people|pax|persons?|guests?'
const MARK = String.raw`(?:no\s+sorry|sorry|no\s+wait|wait|i\s+mean|actually|rather|correction|no)`

const COUNT_FIX = new RegExp(
  String.raw`\b(\d{1,3})\s+(${UNITS})\b\s*,?\s+${MARK}\s*,?\s+(?:make\s+it\s+|it'?s\s+|it\s+is\s+)?(\d{1,3})(?:\s+(${UNITS}))?\b(?!(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))`,
  'gi',
)
// A marker that can introduce a replacement (never a bare "no": "no cab").
const ENTITY_MARK = /^(?:sorry|wait|actually|rather|instead|correction|i mean|no sorry|no wait)$/

// Words that are never part of a hotel's / cab's name.
const NOT_NAME = new Set(['night', 'nights', 'day', 'days', 'in', 'at', 'for', 'and', 'with', 'from', 'to', 'the', 'a', 'an', 'of', 'on', 'stay', 'staying', 'room', 'rooms', 'by'])
const nameWords = (span) => span.every((w) => /^[a-z&']+$/.test(w) && !NOT_NAME.has(w))

const sameUnit = (a, b) => !b || a.replace(/s$/, '').slice(0, 3) === b.replace(/s$/, '').slice(0, 3)

function fixCounts(text) {
  return text.replace(COUNT_FIX, (m, n1, u1, n2, u2) => (sameUnit(u1.toLowerCase(), u2 && u2.toLowerCase()) ? `${n2} ${u2 || u1}` : m))
}

const vehicleAt = (words, cat) =>
  cat.vehicles.find((v) => v.tokens.length && words.length && v.tokens.some((vt) => vt === words[0] || (vt.length >= 5 && words[0].length >= 5 && levRatio(vt, words[0]) >= 0.8)))

// Longest run of words ending at `end` (exclusive) that names a catalog hotel / cab.
function kindBefore(words, end, cat) {
  for (let len = Math.min(5, end); len >= 1; len--) {
    const span = words.slice(end - len, end)
    if (nameWords(span) && matchHotel(span, '', cat).hotel) return { kind: 'hotel', start: end - len }
  }
  for (let len = Math.min(3, end); len >= 1; len--) {
    const span = words.slice(end - len, end)
    if (vehicleAt(span, cat) && span.every((w) => vehicleAt([w], cat))) return { kind: 'vehicle', start: end - len }
  }
  return null
}
function kindAfter(words, start, cat) {
  for (let len = Math.min(5, words.length - start); len >= 1; len--) {
    const span = words.slice(start, start + len)
    if (nameWords(span) && matchHotel(span, '', cat).hotel) return 'hotel'
  }
  return vehicleAt(words.slice(start, start + 3), cat) ? 'vehicle' : null
}

function fixEntities(text, cat) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const low = words.map((w) => w.toLowerCase().replace(/[.,!?]+$/, ''))
  for (let i = 1; i < low.length; i++) {
    const two = `${low[i]} ${low[i + 1] || ''}`
    const markLen = ENTITY_MARK.test(two) ? 2 : ENTITY_MARK.test(low[i]) ? 1 : 0
    if (!markLen) continue
    let j = i + markLen
    while (/^(?:make|it|to|use|change|the|with)$/.test(low[j] || '')) j++
    const before = kindBefore(low, i, cat)
    if (!before) continue
    if (kindAfter(low, j, cat) !== before.kind) continue
    // Drop the corrected name, the marker and the lead-in ("make it").
    const out = [...words.slice(0, before.start), ...words.slice(j)]
    return fixEntities(out.join(' '), cat)
  }
  return text
}

/** text → text with spoken corrections applied. catalog = { hotels, vehicles, … }. */
export function applyCorrections(text, catalog) {
  let s = fixCounts(String(text || ''))
  const cat = prepareCatalog(catalog || {})
  if (cat.hotels.length || cat.vehicles.length) s = fixEntities(s, cat)
  return s
}

