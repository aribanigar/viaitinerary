// Ching — deterministic, rule-based parser for spoken/typed Trip Builder commands.
// No AI model, no network. Pure JS: no React, no DOM, no imports outside utils/ching.
//
//   parseChingCommand(text, catalog, { today }) -> ChingCommand
//   validateChingCommand(cmd, catalog?)         -> { ok, problems, warnings }
//
// catalog = { hotels, destinations, vehicles } in the /api/builder/init shapes.
// See the Ching contract for the ChingCommand shape.

import { convertNumberWords, normalizeTripWords, stripWakePhrase, hasWakePhrase, titleCase } from './text.js'
import { extractDate, extractDateRange, isValidIsoDate, toLocalMidnight } from './dates.js'
import { normTokens, normKey, significantTokens, levRatio, bestMatch } from './fuzzy.js'
import { placeKey, samePlace } from './places.js'
import { tripDestination, GAZETTEER } from './geo.js'
import { shortestPath } from './graph.js'
import { parseDayPlan, buildDayPlan, withoutClaimed } from './dayPlan.js'

export { stripWakePhrase, hasWakePhrase }

export const MEAL_PLANS = ['Only Room', 'Only Room + Breakfast', 'Breakfast + Dinner', 'Breakfast + Lunch + Dinner']

const MEAL_RULES = [
  [
    'Breakfast + Lunch + Dinner',
    [
      /\ball\s+(?:the\s+)?(?:3\s+)?meals\b/,
      /\bbreakfast\s*,?\s*(?:and\s+|&\s*|\+\s*)?lunch\s*,?\s*(?:and\s+|&\s*|\+\s*)?dinner\b/,
      /\bfull\s+board\b/,
      /\b(?<!modified\s)american\s+plan\b/,
      /\bapai\b/,
      /\bap\s+(?:plan|basis|meal\s+plan)\b/,
      /\b(?:meal\s+plan|plan|on)\s+(?:is\s+)?ap\b/,
    ],
  ],
  [
    'Breakfast + Dinner',
    [
      /\bbreakfast\s*(?:and|&|\+|plus|with)\s*dinner\b/,
      /\bhalf\s+board\b/,
      /\bmodified\s+american\s+plan\b/,
      /\bmap(?:ai)?\b/,
    ],
  ],
  [
    'Only Room',
    [
      /\broom\s+only\b/,
      /\bonly\s+(?:the\s+)?rooms?\b(?!\s*(?:\+|and|&|with|plus)\s*breakfast)/,
      /\bwithout\s+(?:any\s+)?(?:meals?|breakfast|food)\b/,
      /\bno\s+meals?\b/,
      /\beuropean\s+plan\b/,
      /\bepai\b/,
      /\bep\s+(?:plan|basis|meal\s+plan)\b/,
      /\b(?:meal\s+plan|plan|on)\s+(?:is\s+)?ep\b/,
      /\bjust\s+(?:the\s+)?rooms?\b/,
    ],
  ],
  [
    'Only Room + Breakfast',
    [
      /\b(?:only\s+)?rooms?\s*(?:\+|and|&|with|plus)\s*breakfast\b/,
      /\b(?:with|including|incl)\s+breakfast(?:\s+only)?\b/,
      /\bbreakfast\s+only\b/,
      /\bonly\s+breakfast\b/,
      /\bbed\s+(?:and|&)\s+breakfast\b/,
      /\bb\s*&\s*b\b/,
      /\bbnb\b/,
      /\bcontinental\s+plan\b/,
      /\bcp(?:ai)?\b/,
      /\bbreakfast\b/,
    ],
  ],
]

const NIGHT_UNITS = new Set(['night', 'nights', 'nite', 'nites', 'knight', 'knights'])
const DAY_UNITS = new Set(['day', 'days'])
const COUNT_UNITS = new Set([
  ...NIGHT_UNITS, ...DAY_UNITS, 'adult', 'adults', 'child', 'children', 'kid', 'kids', 'infant', 'infants',
  'guest', 'guests', 'people', 'pax', 'person', 'persons',
  // "grand mumtaz 2 rooms", "khyber 1 extra bed", "innova 2 cabs": a count ends a hotel name.
  'room', 'rooms', 'bed', 'beds', 'extra', 'cab', 'cabs', 'car', 'cars', 'vehicle', 'vehicles', 'taxi', 'taxis',
])
const MONTHS_RE = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/
const PREPS = new Set(['in', 'at', 'inside'])
const TRIP_WORDS = new Set(['itinerary', 'itineraries', 'trip', 'tour', 'package', 'holiday', 'holidays', 'vacation', 'plan'])
// Words that end a hotel phrase ("2 nights in <hotel> then ...").
const BOUNDARY = new Set([
  'then', 'followed', 'after', 'afterwards', 'next', 'later', 'with', 'for', 'starting', 'start', 'starts',
  'begin', 'beginning', 'from', 'number', 'guests', 'guest', 'adults', 'adult', 'children', 'child', 'kids',
  'kid', 'infants', 'infant', ...TRIP_WORDS, 'phone', 'mobile', 'email', 'customer', 'client', 'date', 'total',
  'including', 'include', 'includes', 'plus', 'also', 'finally', 'lastly', 'last', 'via', 'please', 'ok',
  'okay', 'thanks', 'thank', 'nights', 'night', 'days', 'day', 'i', 'we', 'want', 'need', 'create', 'make',
  'build', 'rest', 'remaining', 'first', 'second', 'third', 'fourth', 'beginning', 'end', 'ending', 'before',
])
// "Srinagar 1 night first" / "… at the end": where a stay goes in the trip.
const ORDER_FIRST = new Set(['first', 'beginning', 'start'])
const ORDER_LAST = new Set(['last', 'end', 'ending', 'finally', 'lastly'])
// Words that end a hotel phrase when walking backwards ("<hotel> for 2 nights").
const BACK_STOP = new Set([
  ...BOUNDARY, 'and', 'in', 'at', 'stay', 'staying', 'stays', 'book', 'put', 'keep', 'add', 'us', 'them',
  'him', 'her', 'is', 'are', 'be',
])
const NAME_SKIP = new Set([
  'the', 'customer', 'customers', 'client', 'clients', 'guest', 'my', 'our', 'mr', 'mrs', 'ms', 'miss',
  'mister', 'dr', 'shri', 'sri', 'smt', 'shrimati', 'master', 'name', 'named', 'is', 'called', 'sir', 'madam',
  "customer's", "client's",
])
const NAME_STOP = new Set([
  'and', 'with', 'who', 'whose', 'starting', 'start', 'starts', 'from', 'on', 'in', 'at', 'to', 'for', 'of',
  'travelling', 'traveling', 'going', 'visiting', 'family', 'number', 'guests', 'guest', 'adults', 'adult',
  'children', 'child', 'kids', 'kid', 'infants', 'itinerary', 'trip', 'tour', 'package', 'holiday', 'nights',
  'night', 'days', 'day', 'phone', 'mobile', 'email', 'contact', 'date', 'having', 'plus', 'along', 'check',
  'arriving', 'arrival', 'via', 'by', 'is', 'are', 'please', 'people', 'pax', 'persons', 'couple', 'members',
  'hotel', 'stay', 'staying', 'total', 'the', 'a', 'an', 'then', 'booking', 'book', 'need', 'needs', 'want',
  'wants', 'will', 'would', 'should', 'can', 'has', 'have', 'also', 'i', 'we', 'he', 'she', 'they', 'it',
  'this', 'that', 'ji', 'group', 'plan', 'vacation', 'as', 'under', 'name', 'named', 'next', 'coming',
  'week', 'weekend', 'month', 'tomorrow', 'today', 'tonight', 'between',
])
// Region names the gazetteer knows ("ladakh", "kashmir"), for trips to a region the catalog lacks.
const REGIONS = new Set(Object.values(GAZETTEER).map((g) => g[2].toLowerCase()))
const NAME_REJECT = new Set([
  ...NAME_STOP, 'my', 'our', 'your', 'his', 'her', 'their', 'me', 'us', 'him', 'them', 'someone', 'somebody',
  'honeymoon', 'all', 'both', 'each', 'next', 'everyone', 'friends', 'two', 'customer', 'client', 'mr', 'mrs',
])
// Words that are never a client name in the no-lead-in fallback.
const FALLBACK_NAME_SKIP = new Set([
  'create', 'make', 'plan', 'build', 'prepare', 'generate', 'draft', 'design', 'book', 'send', 'add', 'give',
  'banao', 'bana', 'karo', 'kar', 'do', 'chahiye', 'ka', 'ki', 'ke', 'aur', 'se', 'tak', 'mein', 'me', 'ke',
  'new', 'nice', 'good', 'best', 'cheap', 'budget', 'luxury', 'premium', 'deluxe', 'standard', 'star',
  'hotel', 'hotels', 'resort', 'houseboat', 'stay', 'with', 'without', 'in', 'at', 'to', 'of', 'on', 'from',
  'starting', 'start', 'till', 'until', 'and', 'or', 'then', 'also', 'please', 'kindly', 'quotation', 'quote',
  'itinerary', 'trip', 'tour', 'package', 'holiday', 'vacation', 'honeymoon', 'family', 'friends', 'group',
  'adults', 'adult', 'kids', 'kid', 'children', 'child', 'infant', 'infants', 'pax', 'people', 'persons', 'guests',
  'nights', 'night', 'days', 'day', 'breakfast', 'dinner', 'lunch', 'meals', 'cab', 'car', 'taxi', 'vehicle',
  'sightseeing', 'margin', 'gst', 'percent', 'rupees', 'rs', 'inr', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr',
  'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'next', 'this', 'week', 'month', 'year', 'today', 'tomorrow',
])
const VEHICLE_GENERIC = new Set(['car', 'cab', 'taxi', 'vehicle', 'ac', 'non', 'with', 'and', 'the', 'seater', 'driver', 'full', 'trip', 'day', 'days', 'per', 'rate', 'package', 'tour', 'basis', 'km', 'only', 'for'])
const TRAIL_TRIM = new Set(['and', 'the', 'stay', 'of', 'in', 'at'])

const isNum = (t) => /^\d+$/.test(t || '')
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export function prepareCatalog(catalog) {
  const c = catalog || {}
  const hotels = (Array.isArray(c.hotels) ? c.hotels : [])
    .filter((h) => h && h.name)
    .map((h) => ({ raw: h, id: h.id, name: String(h.name), city: String(h.city || '').trim(), tokens: significantTokens(normTokens(h.name)) }))
  const destinations = (Array.isArray(c.destinations) ? c.destinations : [])
    .filter((d) => d && d.name)
    .map((d) => ({ raw: d, id: d.id, name: String(d.name), key: normKey(d.name), tokens: normTokens(d.name) }))
  const vehicles = (Array.isArray(c.vehicles) ? c.vehicles : [])
    .filter((v) => v && v.name)
    .map((v) => {
      const all = normTokens(v.name)
      const sig = all.filter((t) => !VEHICLE_GENERIC.has(t) && !isNum(t) && t.length >= 3)
      return { raw: v, id: v.id, name: String(v.name), tokens: sig.length ? sig : all }
    })
  // City dictionary: normalised -> display name (destination names first).
  const cities = new Map()
  const addCity = (name) => {
    const k = normKey(name)
    if (k && !cities.has(k)) cities.set(k, String(name).trim())
    // "Pahalgam, Kashmir" / "Srinagar City" are also just "pahalgam" / "srinagar".
    const short = placeKey(name)
    if (short && short !== k && !cities.has(short)) cities.set(short, titleCase(short))
  }
  destinations.forEach((d) => addCity(d.name))
  ;(Array.isArray(c.destinations) ? c.destinations : []).forEach((d) => d && d.city && addCity(d.city))
  hotels.forEach((h) => h.city && addCity(h.city))
  return { hotels, destinations, vehicles, cities }
}

export function cityLookup(words, cat) {
  const key = normKey(Array.isArray(words) ? words.join(' ') : words)
  if (!key) return ''
  if (cat.cities.has(key)) return cat.cities.get(key)
  let best = ''
  let bestR = 0
  for (const [k, display] of cat.cities) {
    if (k.length < 5 || key.length < 5) continue
    const r = levRatio(key, k)
    if (r >= 0.85 && r > bestR) {
      best = display
      bestR = r
    }
  }
  return best
}

export const sameCity = (a, b) => !!a && !!b && (normKey(a) === normKey(b) || levRatio(normKey(a), normKey(b)) >= 0.85)

function splitCity(words, cat) {
  for (let i = 1; i < words.length - 1; i++) {
    if (!PREPS.has(words[i])) continue
    const left = words.slice(0, i)
    const right = words.slice(i + 1)
    const cl = cityLookup(left, cat)
    const cr = cityLookup(right, cat)
    if (cl && !cr) return { city: cl, hotelWords: right }
    if (cr && !cl) return { city: cr, hotelWords: left }
  }
  const whole = cityLookup(words, cat)
  if (whole) return { city: whole, hotelWords: [] }
  for (let k = Math.min(3, words.length - 1); k >= 1; k--) {
    const pre = cityLookup(words.slice(0, k), cat)
    if (pre) return { city: pre, hotelWords: words.slice(k) }
    const suf = cityLookup(words.slice(words.length - k), cat)
    if (suf) return { city: suf, hotelWords: words.slice(0, words.length - k) }
  }
  return { city: '', hotelWords: words }
}

export function matchHotel(words, city, cat) {
  if (!words.length || !cat.hotels.length) return { hotel: null, ambiguous: [] }
  const tokens = normTokens(words.join(' '))
  if (city) {
    const pool = cat.hotels.filter((h) => sameCity(h.city, city))
    if (pool.length) {
      const r = bestMatch(tokens, pool)
      if (r.confident) return { hotel: r.best, ambiguous: [] }
    }
  }
  const r = bestMatch(tokens, cat.hotels)
  if (r.confident) return { hotel: r.best, ambiguous: [] }
  return { hotel: null, ambiguous: r.runnersUp }
}

/**
 * " — did you mean X or Y?" for a hotel name that matched nothing confidently:
 * the closest catalog names (in that city first), or '' when nothing is close.
 */
export function didYouMean(words, city, cat) {
  const tokens = normTokens((Array.isArray(words) ? words : [words]).join(' '))
  const pool = city ? cat.hotels.filter((h) => sameCity(h.city, city)) : []
  const near = [
    ...bestMatch(tokens, pool, { threshold: 0.35 }).runnersUp,
    ...bestMatch(tokens, cat.hotels, { threshold: 0.4 }).runnersUp,
  ].filter((h, i, a) => a.indexOf(h) === i)
  if (!near.length && city && pool.length) near.push(...pool.slice(0, 2))
  const label = (h) => (h.city && !sameCity(h.city, city) ? `${h.name} (${h.city})` : h.name)
  return near.length ? ` — did you mean ${near.slice(0, 2).map(label).join(' or ')}?` : ''
}

/** Resolve the raw words of one stay to a catalog hotel / city. */
export function resolveStay(nights, words, cat) {
  const heard = words.join(' ')
  const { city, hotelWords } = splitCity(words, cat)
  const warnings = []
  const stay = { nights, hotelId: null, hotelName: '', city: city || '', heard }
  if (!hotelWords.length) {
    warnings.push(`No hotel named for ${plural(nights, 'night')} in ${city} — pick one`)
    return { stay, warnings, cityOnly: true }
  }
  let m = matchHotel(words, city, cat)
  if (!m.hotel && hotelWords.length !== words.length) {
    const m2 = matchHotel(hotelWords, city, cat)
    if (m2.hotel || !m.ambiguous.length) m = m2
  }
  if (m.hotel) {
    stay.hotelId = m.hotel.id
    stay.hotelName = m.hotel.name
    stay.city = m.hotel.city || city || ''
    // "1 night srinagar apple tree resorts" with Apple Tree in Gulmarg: the
    // night is in the city said — the conflict is settled once all stays are known.
    if (city && m.hotel.city && !sameCity(m.hotel.city, city) && !samePlace(m.hotel.city, city)) {
      stay.city = city
      stay.cityConflict = m.hotel.city
    }
    if (m.hotel.raw.is_available === false) warnings.push(`${m.hotel.name} is marked unavailable`)
  } else {
    const hotelText = hotelWords.join(' ')
    stay.hotelName = titleCase(hotelText)
    if (m.ambiguous.length > 1) {
      const label = (h) => (h.city ? `${h.name} (${h.city})` : h.name)
      warnings.push(`"${hotelText}" could be ${m.ambiguous.map(label).join(' or ')} — pick one`)
    } else {
      warnings.push(`Couldn't find "${hotelText}" in your hotels${didYouMean(hotelWords, city, cat)}`)
    }
  }
  return { stay, warnings, cityOnly: false }
}

export function extractMealPlan(s) {
  for (const [plan, patterns] of MEAL_RULES) {
    for (const re of patterns) {
      const m = re.exec(s)
      if (m) return { plan, s: s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length) }
    }
  }
  return { plan: '', s }
}

// Spoken email addresses: speech recognition writes what it hears as words
// ("rahul sharma at gmail dot com", "rahul sharma@gmail.com", "r a h u l 1 2 3
// at the rate yahoo dot co dot in"). Everything said between "email" and the
// "at" is ONE local part — joined with no spaces.
const EMAIL_KEY = /\b(?:e[\s-]?mail|mail)\b/
const EMAIL_SKIP = new Set(['id', 'address', 'is', 'of', 'the', 'client', 'guest', 'customer', 'his', 'her', 'their', 'will', 'be', 'hai', 'to', 'as', 'it', 'its', "it's", ':', '-'])
const EMAIL_PROVIDER = { gmail: 'gmail.com', googlemail: 'googlemail.com', yahoo: 'yahoo.com', ymail: 'ymail.com', hotmail: 'hotmail.com', outlook: 'outlook.com', rediffmail: 'rediffmail.com', rediff: 'rediffmail.com', icloud: 'icloud.com', live: 'live.com', protonmail: 'protonmail.com', proton: 'proton.me', aol: 'aol.com', zoho: 'zoho.com', msn: 'msn.com' }
const EMAIL_TLD = /^(?:com|in|org|net|co|io|me|info|biz|edu|gov|ac|travel|uk|us|ae|pk|nic|res|tours|holidays|app|dev|ai)$/
const DIGIT_WORD = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' }

function emailParts(s) {
  // Words with their offsets; "@" and "." inside a word are their own parts.
  const parts = []
  for (const m of s.matchAll(/\S+/g)) {
    let at = m.index
    for (const piece of m[0].split(/(@|\.)/)) {
      if (piece) parts.push({ t: piece.replace(/[,;!?]+$/, ''), start: at, end: at + piece.length })
      at += piece.length
    }
  }
  return parts
}

function spokenEmail(s) {
  const key = EMAIL_KEY.exec(s)
  if (!key) return null
  const parts = emailParts(s).filter((p) => p.start >= key.index + key[0].length)
  let i = 0
  while (i < parts.length && EMAIL_SKIP.has(parts[i].t)) i++
  const from = i
  // The separator: "@", "at", "at the rate (of)", "at rate", "at d rate".
  const sepAt = (j) => {
    const t = parts[j]?.t
    if (t === '@') return j + 1
    if (t !== 'at') return 0
    let k = j + 1
    if (/^(?:the|d|da|di)$/.test(parts[k]?.t || '') && parts[k + 1]?.t === 'rate') k += 2
    else if (parts[k]?.t === 'rate') k += 1
    if (k > j + 1 && parts[k]?.t === 'of') k++
    if (parts[k]?.t === '@') k++
    return k
  }
  for (let j = from + 1; j <= from + 8 && j < parts.length; j++) {
    const after = sepAt(j)
    if (!after) continue
    const local = parts.slice(from, j)
    if (!local.length || !local.every((p) => /^[a-z0-9_+-]+$/.test(p.t) || p.t === '.')) continue
    // Domain words up to "dot <tld>" (or a well-known provider on its own).
    const dom = []
    let k = after
    while (k < parts.length && dom.length < 3 && /^[a-z0-9-]+$/.test(parts[k].t) && parts[k].t !== 'dot') {
      dom.push(parts[k].t)
      k++
      if (parts[k]?.t === 'dot' || parts[k]?.t === '.' || EMAIL_PROVIDER[dom.join('')]) break
    }
    if (!dom.length) continue
    // "dotcom" heard as one word.
    if (/^dot(com|in|org|net)$/.test(dom[dom.length - 1]) && dom.length > 1) {
      const tld = dom.pop().slice(3)
      return finish(local, dom.join('') + '.' + tld, parts[k - 1].end)
    }
    const tlds = []
    let end = parts[k - 1].end
    while ((parts[k]?.t === 'dot' || parts[k]?.t === '.') && EMAIL_TLD.test(parts[k + 1]?.t || '')) {
      tlds.push(parts[k + 1].t)
      end = parts[k + 1].end
      k += 2
    }
    const domain = dom.join('')
    if (tlds.length) return finish(local, `${domain}.${tlds.join('.')}`, end)
    if (EMAIL_PROVIDER[domain]) return finish(local, EMAIL_PROVIDER[domain], end)
  }
  return null

  function finish(local, domain, end) {
    const name = local
      .map((p) => (p.t === 'dot' || p.t === '.' ? '.' : p.t === 'underscore' ? '_' : p.t === 'dash' || p.t === 'hyphen' ? '-' : DIGIT_WORD[p.t] || p.t))
      .join('')
      .replace(/^[._-]+|[._-]+$/g, '')
    if (!name) return null
    return { email: `${name}@${domain}`, s: s.slice(0, key.index) + ' | ' + s.slice(end) }
  }
}

export function extractEmail(s) {
  const spoken = spokenEmail(s)
  if (spoken) return spoken
  const typed = /(?:\b(?:e-?mail|mail)(?:\s+(?:id|address))?\s*(?:is\s+|:\s*|-\s*)?)?\b([a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/
  const m = typed.exec(s)
  if (m) return { email: m[1], s: s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length) }
  return { email: '', s }
}

/**
 * A spoken/typed phone number → E.164-ish "+919876543210". The Trip Builder's
 * phone field (react-international-phone, India by default) needs the dial
 * code: a bare "9876543210" would be read as a foreign number and reset to
 * "+91". 10 digits → +91…; 0 + 10 digits → +91…; 91 + 10 digits → +91….
 */
export function formatPhone(raw) {
  const plus = /^\s*\+/.test(String(raw || ''))
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (plus) return `+${d}`
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) return `+91${d}`
  if (d.length === 12 && d.startsWith('91')) return `+${d}`
  return `+${d}`
}

// Digit groups after a phone keyword: "98765 43210", "98,765-43210", "+91 98765.43210".
const DIGIT_RUN = /\+?\d[\d\s,.()-]*\d/g

/** Take digit groups from `run` until a whole number is collected → { digits, length } (chars used). */
function takePhone(run) {
  const re = /\d+/g
  let digits = ''
  let end = 0
  let m
  while ((m = re.exec(run))) {
    const enough =
      digits.length >= 10 &&
      !(digits.startsWith('91') && digits.length < 12) &&
      !(digits.startsWith('0') && digits.length < 11)
    if (enough) break
    // A gap of more than one separator char ends the number ("98765 43210, 2 adults").
    if (digits && /[^\s,.\-()]|\s{2,}|,\s|\.\s/.test(run.slice(end, m.index)) && digits.length >= 10) break
    digits += m[0]
    end = m.index + m[0].length
  }
  return { digits, length: end }
}

const okPhone = (digits) => digits.length >= 10 && digits.length <= 13

export function extractPhone(input) {
  // Spoken repeats: "double 4" → "4 4", "triple 0" → "0 0 0"; "oh" between digits → 0.
  let s = String(input ?? '')
    .replace(/\b(double|triple)\s+(\d)\b(?=[\s,.-]*\d)|(?<=\d[\s,.-]*)\b(double|triple)\s+(\d)\b/g, (m, k1, d1, k2, d2) => {
      const k = k1 || k2
      const d = d1 || d2
      return k === 'double' ? `${d} ${d}` : `${d} ${d} ${d}`
    })
    .replace(/(?<=\d)\s+(?:oh|o)\s+(?=\d)/g, ' 0 ')
  const KEY =
    /\b(?:phone|mobile|mob|contact|cell|whatsapp|ph|number)\.?(?:\s+(?:number|no\.?|num))?(?:\s+(?:of\s+(?:the\s+)?(?:client|customer|guest)|for\s+(?:the\s+)?(?:client|customer|guest)))?\s*(?:is\s+|:\s*|-\s*|=\s*)?(?=\+?\d)/g
  let k
  while ((k = KEY.exec(s))) {
    const from = k.index + k[0].length
    DIGIT_RUN.lastIndex = from
    const r = DIGIT_RUN.exec(s)
    if (!r || r.index !== from) continue
    const { digits, length } = takePhone(r[0])
    const plus = r[0].startsWith('+')
    if (okPhone(digits)) {
      return { phone: formatPhone((plus ? '+' : '') + digits), s: s.slice(0, k.index) + ' | ' + s.slice(from + length) }
    }
  }
  // No keyword: an Indian mobile on its own ("… 98765 43210 …").
  const bare = /(?<![\d/.-])((?:\+?91[\s-]?)?[6-9]\d{4}[\s,-]?\d{5}|[6-9]\d{2}[\s-]\d{3}[\s-]\d{4}|[6-9]\d(?:\s\d\d){4})(?![\d/.-])/.exec(s)
  if (!bare) return { phone: '', s }
  return { phone: formatPhone(bare[1]), s: s.slice(0, bare.index) + ' | ' + s.slice(bare.index + bare[0].length) }
}

function extractGuests(input) {
  let s = input
  const g = { adults: 0, children: 0, infants: 0, total: 0, heardAdults: false, heardAny: false, ages: [] }
  const take = (re, fn) => {
    s = s.replace(re, (...m) => {
      fn(m)
      g.heardAny = true
      return ' | '
    })
  }
  const KID = '(?:children|child|childs|kids|kid|kiddos?)'
  // "2 kids aged 7 and 3", "two children ages 8, 4": each age decides the band
  // (under 5 → infant / free, 5–12 → child, 13+ → adult).
  take(
    new RegExp(`\\b(\\d{1,2})\\s+${KID}\\s+(?:aged?|ages|of\\s+ages?)\\s+(\\d{1,2}(?:\\s*(?:,|and|&)\\s*\\d{1,2})+)(?:\\s*(?:years?|yrs?)(?:\\s+old)?)?`, 'g'),
    (m) => {
      const ages = m[2].split(/\s*(?:,|and|&)\s*/).map(Number).filter((n) => Number.isFinite(n))
      const count = +m[1]
      ages.slice(0, count).forEach((age) => {
        if (age < 5) g.infants += 1
        else if (age <= 12) g.children += 1
        else {
          g.adults += 1
          g.heardAdults = true
        }
        g.ages.push(age)
      })
      // Fewer ages than children said: the rest count as 5–12.
      g.children += Math.max(0, count - ages.length)
    },
  )
  take(
    new RegExp(
      `\\b(\\d{1,2})\\s+${KID}\\s+(?:who\\s+(?:is|are)\\s+)?(?:(below|under|less\\s+than|upto|up\\s+to)|(?:aged?|of\\s+age)(?:\\s+(below|under))?)\\s+(\\d{1,2})(?:\\s*(?:years?|yrs?)(?:\\s+old)?)?`,
      'g',
    ),
    (m) => {
      const below = !!(m[2] || m[3])
      const age = +m[4]
      if (below ? age <= 5 : age < 5) g.infants += +m[1]
      else g.children += +m[1]
    },
  )
  take(/\b(\d{1,2})\s+(?:infants?|babies|baby|toddlers?|newborns?)\b/g, (m) => (g.infants += +m[1]))
  take(new RegExp(`\\b(\\d{1,2})\\s+${KID}\\b`, 'g'), (m) => (g.children += +m[1]))
  take(/\b(\d{1,2})\s+(?:adults?|elders?|seniors?|senior\s+citizens?|grown\s*ups?|men|women|ladies|gents)\b/g, (m) => {
    g.adults += +m[1]
    g.heardAdults = true
  })
  take(/\b(?:number|no|num)\.?\s+of\s+adults?\s*(?:is\s+|are\s+|will\s+be\s+|[:=-]\s*)?(\d{1,2})\b/g, (m) => {
    g.adults += +m[1]
    g.heardAdults = true
  })
  take(/\b(?:number|no|num)\.?\s+of\s+(?:children|kids?|child)\s*(?:is\s+|are\s+|[:=-]\s*)?(\d{1,2})\b/g, (m) => (g.children += +m[1]))
  const PEOPLE = '(?:guests?|people|persons?|pax|members|travell?ers?|passengers?|heads)'
  take(new RegExp(`\\b(\\d{1,3})\\s+${PEOPLE}\\b`, 'g'), (m) => (g.total = g.total || +m[1]))
  take(
    new RegExp(`\\b(?:total\\s+)?(?:number|no|num)\\.?\\s+of\\s+${PEOPLE}\\s*(?:is\\s+|are\\s+|will\\s+be\\s+|[:=-]\\s*)?(\\d{1,3})\\b`, 'g'),
    (m) => (g.total = g.total || +m[1]),
  )
  take(/\b(?:family|group|party)\s+of\s+(\d{1,3})\b/g, (m) => (g.total = g.total || +m[1]))
  take(
    new RegExp(`\\b${PEOPLE}\\s*(?:is\\s+|are\\s+|[:=-]\\s*)?(\\d{1,3})\\b(?!\\s*(?:nights?|days?|adults?|children|child|kids?|infants?)\\b)`, 'g'),
    (m) => (g.total = g.total || +m[1]),
  )
  if (!g.heardAdults && !g.total && /\b(?:couple|honeymoon(?:ers)?)\b/.test(s)) {
    g.adults = 2
    g.heardAdults = true
    g.heardAny = true
    s = s.replace(/\b(?:for\s+)?(?:a\s+)?couple\b/, ' | ')
  }
  if (g.total && !g.heardAdults) {
    g.adults = Math.max(1, g.total - g.children - g.infants)
    g.heardAdults = true
  }
  return { ...g, s }
}

// ---- reading stays: the sentence as a shortest-path problem ----
//
// Nodes are word positions 0..n. From each position there are edges:
//   skip   one word nobody explained                  cost 1 (0.3 for filler words)
//   stay   a span that reads as "<N> nights in <X>", "<X> for <N> nights",
//          "<N> nights <X>", "<X> <N> nights", "<X> <N>"  cost 0.1 + how unsure the name is
//   bare   "<N> nights" on its own (the trip length)  cost 0.6
// Dijkstra finds the cheapest path from the first word to the last: the reading
// that explains the most words with the best catalog matches. Greedy
// left-to-right reading gets "lalit 2 nights khyber 1 night" wrong (it pairs
// "2 nights" with khyber); the global shortest path pairs both correctly, and
// works whichever order the agent said things in. Here it runs as a second pass
// over the words the main stay loop left unread (terse "lalit 2, khyber 1").
const SKIP_CHEAP = new Set(['and', 'the', 'a', 'an', 'in', 'at', 'of', 'then', 'with', 'for', 'stay', 'staying', 'hotel', 'please', 'ok', 'okay', 'also', 'plus', 'followed', 'by', 'after', 'that'])
const NAME_BEFORE = new Set(['for', 'customer', 'client', 'mr', 'mrs', 'ms', 'name'])

function entityScorer(cat) {
  const vocab = new Set()
  cat.hotels.forEach((h) => h.tokens.forEach((t) => vocab.add(t)))
  for (const k of cat.cities.keys()) k.split(' ').forEach((t) => vocab.add(t))
  const near = new Map()
  const isNear = (t) => {
    if (!near.has(t)) {
      let ok = vocab.has(t)
      if (!ok && t.length >= 4) {
        for (const v of vocab) {
          if (v.length >= 4 && (v.startsWith(t.slice(0, 4)) || levRatio(t, v) >= 0.75)) {
            ok = true
            break
          }
        }
      }
      near.set(t, ok)
    }
    return near.get(t)
  }
  const memo = new Map()
  // 0..1: how surely these words name a catalog hotel or city (0 = not at all).
  return (words) => {
    const key = words.join(' ')
    if (memo.has(key)) return memo.get(key)
    let score = 0
    if (words.some(isNear)) {
      const { city, hotelWords } = splitCity(words, cat)
      if (city && !hotelWords.length) score = 1
      const tryMatch = (ws, pool) => {
        if (!ws.length || !pool.length) return
        const r = bestMatch(normTokens(ws.join(' ')), pool)
        if (r.confident) score = Math.max(score, r.score)
      }
      if (city) {
        const pool = cat.hotels.filter((h) => sameCity(h.city, city))
        tryMatch(words, pool)
        tryMatch(hotelWords, pool)
      }
      tryMatch(words, cat.hotels)
      if (city && hotelWords.length && score === 0) score = 0.5 // known city + an unknown hotel name
    }
    memo.set(key, score)
    return score
  }
}

/**
 * The best reading of the stays in a token list (tokens already used by
 * dates/guests/contacts are free to skip). Returns the chosen edges in order:
 * { kind: 'stay', n, words, from, to } | { kind: 'bare', n, from, to }.
 */
export function readStays(tok, used, cat, { collectAfter }) {
  const at = (i) => (i >= 0 && i < tok.length && !used[i] ? tok[i] : '|')
  const score = entityScorer(cat)
  const isWord = (t) => t !== '|' && !isNum(t)
  const nameCost = (words, unknownPerWord) => {
    const sc = score(words)
    if (sc > 0) return (1 - sc) * words.length * 0.5
    return unknownPerWord == null ? Infinity : unknownPerWord * words.length
  }
  const edgesOf = (i) => {
    if (i >= tok.length) return []
    const t = at(i)
    const edges = [{ to: i + 1, cost: t === '|' ? 0 : SKIP_CHEAP.has(t) ? 0.3 : 1, kind: 'skip' }]
    const add = (kind, n, words, from, to, cost) => {
      if (cost < Infinity && words.join('').length >= 3) edges.push({ to: to + 1, cost: 0.1 + cost, kind, n, words, from })
    }
    // "<N> nights …"
    if (isNum(t) && NIGHT_UNITS.has(at(i + 1))) {
      const n = +t
      edges.push({ to: i + 2, cost: 0.6, kind: 'bare', n, from: i })
      let j = i + 2
      while (['stay', 'stays', 'staying', 'of'].includes(at(j)) && j < i + 4) j++
      const prep = PREPS.has(at(j))
      const nx = at(prep ? j + 1 : j)
      if (prep || (nx !== '|' && !isNum(nx) && !BOUNDARY.has(nx) && nx !== 'and')) {
        const a = collectAfter(prep ? j + 1 : j)
        for (let k = 1; k <= a.words.length; k++) {
          const words = a.words.slice(0, k)
          const end = (prep ? j + 1 : j) + k - 1
          // "3 nights kashmir trip" is a trip length + destination, not a stay.
          if (!prep && TRIP_WORDS.has(at(end + 1)) && !splitCity(words, cat).hotelWords.length) continue
          if (TRAIL_TRIM.has(words[words.length - 1])) continue
          add('stay', n, words, i, end, nameCost(words, prep ? 0.3 : 0.5))
        }
      }
    }
    // "<X> for <N> nights", "<X> <N> nights", "<X> <N>"
    if (isWord(t) && !BACK_STOP.has(t) && !TRAIL_TRIM.has(t) && t !== 'a' && t !== 'an') {
      const words = []
      for (let p = i; p < tok.length && words.length < 6; p++) {
        const w = at(p)
        if (!isWord(w) || BACK_STOP.has(w)) {
          const hasFor = w === 'for'
          const q = hasFor ? p + 1 : p
          if (!words.length || !isNum(at(q))) break
          const n = +at(q)
          if (NIGHT_UNITS.has(at(q + 1))) {
            const weak = hasFor && !NAME_BEFORE.has(at(i - 1)) ? 0.6 : null
            add('stay', n, words, i, q + 1, nameCost(words, weak))
          } else if (!hasFor && !COUNT_UNITS.has(at(q + 1)) && n >= 1 && n <= 20) {
            add('stay', n, words, i, q, nameCost(words, null))
          }
          break
        }
        words.push(w)
      }
    }
    return edges
  }
  const path = shortestPath(0, tok.length, edgesOf)
  return path ? path.edges.filter((e) => e.kind !== 'skip').map((e) => ({ ...e, to: e.to - 1 })) : []
}

function tokenize(s) {
  return s
    .replace(/\b(mr|mrs|ms|dr|st|no|smt)\./g, '$1 ')
    .replace(/[,;!?:()"[\]{}/]+/g, ' | ')
    .replace(/\.(?=\s|$)/g, ' | ')
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/[^a-z0-9|' ]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

/**
 * Parse a spoken or typed command into a ChingCommand.
 * @param {string} text   raw transcript
 * @param {{hotels?:object[], destinations?:object[], vehicles?:object[]}} catalog
 * @param {{today?: Date|string}} [opts] today defaults to new Date() (injectable for tests)
 */
export function parseChingCommand(text, catalog, { today } = {}) {
  const transcript = String(text ?? '')
  const cat = prepareCatalog(catalog)
  const todayDate = toLocalMidnight(today)
  const warnings = []

  let s = stripWakePhrase(transcript.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')).text

  // Contact details first (they contain dots, digits and @).
  const em = extractEmail(s)
  const clientEmail = em.email
  s = em.s

  // Hyphens inside words/number-units: "5-day" -> "5 day", "twenty-one" -> "twenty one".
  s = s.replace(/([a-z])-(?=[a-z])/g, '$1 ').replace(/(\d)-(?=[a-z])/g, '$1 ').replace(/([a-z])-(?=\d)/g, '$1 ')
  s = normalizeTripWords(convertNumberWords(s))

  const ph = extractPhone(s)
  const clientPhone = ph.phone
  s = ph.s

  // Anything trip-like at all? (checked before spans are blanked out)
  const tripWordHeard = /\b(?:itinerar(?:y|ies)|trip|tour|package|holidays?|vacation|quotation|quote|booking)\b/.test(s)

  const meal = extractMealPlan(s)
  const mealPlan = meal.plan
  s = meal.s

  // Room details said with the stay ("2 rooms", "super deluxe room", "1 extra
  // bed") and the cab count ("2 cabs") — read here, blanked out so they never
  // become part of a hotel's name.
  const blank = (m) => {
    s = s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length)
  }
  let roomType = ''
  const rt = s.match(/\b(super\s+deluxe|deluxe|premium|executive|superior|standard|luxury|family|suite|club|cottage)\s+rooms?\b/)
  if (rt) {
    roomType = titleCase(rt[1].replace(/\s+/g, ' '))
    blank(rt)
  }
  let extraBeds = 0
  const eb = s.match(/\b(?:(\d{1,2})|an?|one|with(?:\s+an?)?)\s+extra\s+(?:beds?|mattress(?:es)?)\b/)
  if (eb) {
    extraBeds = eb[1] ? +eb[1] : 1
    blank(eb)
  }
  // One room count for the whole trip; several ("2 rooms … 3 rooms") are per
  // stay and left to the edit pass.
  let rooms = 0
  const roomHits = [...s.matchAll(/\b(\d{1,2})\s+(?:double\s+|twin\s+|triple\s+)?rooms?\b/g)]
  if (roomHits.length === 1 && +roomHits[0][1] >= 1) {
    rooms = +roomHits[0][1]
    blank(roomHits[0])
  }
  // "add gondola for 2 adults and 1 child": the activity's tickets, not the
  // trip's guests.
  for (;;) {
    const ap = s.match(/\b(?:add|include|plus|book)\s+(?!(?:a\s+|the\s+|new\s+)?(?:trip|itinerary|tour|package|holiday)\b)[^|]*?(\bfor\s+\d{1,3}\s+(?:adults?|people|persons?|pax|guests?|tickets?)(?:\s+(?:and|&|plus)\s+\d{1,2}\s+(?:children|child|kids?))?\b)/)
    if (!ap) break
    const at = ap.index + ap[0].length - ap[1].length
    s = s.slice(0, at) + ' | ' + s.slice(at + ap[1].length)
  }
  let vehicleQuantity = 1
  const vq = s.match(/\b([2-9])\s+(?:cabs|cars|vehicles|taxis)\b/)
  if (vq) {
    vehicleQuantity = +vq[1]
    blank(vq)
  }

  let startDate = ''
  // "from 10th to 14th november" → start date + nights
  let rangeNights = 0
  const rng = extractDateRange(s, todayDate)
  if (rng) {
    startDate = rng.iso
    rangeNights = rng.nights
    warnings.push(...rng.notes)
    s = s.slice(0, rng.index) + ' | ' + s.slice(rng.index + rng.length)
  }
  const dt = startDate ? null : extractDate(s, todayDate)
  if (dt) {
    startDate = dt.iso
    warnings.push(...dt.notes)
    s = s.slice(0, dt.index) + ' | ' + s.slice(dt.index + dt.length)
  }

  // Day-by-day route ("day 1 arrival in Srinagar, day 2 Srinagar to Gulmarg, …"):
  // read it whole, then blank it out so the stay/name parsers don't re-read it.
  const dayRoutes = parseDayPlan(s, (w) => cityLookup(w, cat))
  if (dayRoutes) s = withoutClaimed(s, dayRoutes.claimed)

  // "5 day 4 night", "4N/5D", "4 nights 5 days", "5 days and 4 nights"
  let days = 0
  let nightsTotal = 0
  const notStay = '(?!\\s*(?:stay\\s+)?(?:in|at|@)\\b)'
  const combos = [
    [new RegExp(`\\b(\\d{1,2})\\s*d(?:ays?)?\\s*(?:[,/&+-]\\s*|and\\s+)?(\\d{1,2})\\s*n(?:ights?)?\\b${notStay}`), 'dn'],
    [new RegExp(`\\b(\\d{1,2})\\s*n(?:ights?)?\\s*(?:[,/&+-]\\s*|and\\s+)?(\\d{1,2})\\s*d(?:ays?)?\\b`), 'nd'],
  ]
  for (const [re, order] of combos) {
    const m = re.exec(s)
    if (m) {
      days = +(order === 'dn' ? m[1] : m[2])
      nightsTotal = +(order === 'dn' ? m[2] : m[1])
      s = s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length)
      break
    }
  }
  s = s.replace(/\b(\d{1,2})\s*n\b/g, '$1 nights').replace(/\b(\d{1,2})\s*d\b/g, '$1 days')

  // "Mr and Mrs Bhat" is one client (a couple).
  s = s.replace(/\bmr\.?\s+(?:and|&)\s+mrs\.?\s+/g, 'mr ')

  const guests = extractGuests(s)
  s = guests.s

  // "srinagar 2 gulmarg 2": a catalog city followed by a bare count is that
  // many nights there (not adults, rooms, a date or a percentage).
  s = s.replace(/\b([a-z]+)\s+(\d{1,2})\b(?!\s*(?:nights?|nites?|days?|n\b|d\b|adults?|people|pax|persons?|guests?|kids?|child|children|infants?|rooms?|star|stars|%|percent|cabs?|cars?|beds?|extra|tickets?|st\b|nd\b|rd\b|th\b|of\b|[a-z]{3,9}\s+\d{4}))(?![\s\S]{0,1}\d)/g, (m, w, n) => {
    if (+n < 1 || +n > 20 || MONTHS_RE.test(w) || !cityLookup([w], cat)) return m
    return `${w} ${n} nights`
  })

  // ---- token stage ----
  const tok = tokenize(s)
  const used = tok.map((t) => t === '|')
  const at = (i) => (i >= 0 && i < tok.length && !used[i] ? tok[i] : '|')
  const mark = (a, b) => {
    for (let i = a; i <= b; i++) used[i] = true
  }

  const collectAfter = (start) => {
    const words = []
    let k = start
    while (k < tok.length && words.length < 8) {
      const t = at(k)
      if (t === '|') break
      if (isNum(t)) {
        if (words.length && !COUNT_UNITS.has(at(k + 1))) {
          words.push(t)
          k++
          continue
        }
        break
      }
      if (t === 'and') {
        const nx = at(k + 1)
        if (nx === '|' || isNum(nx) || BOUNDARY.has(nx)) break
      }
      if (BOUNDARY.has(t)) break
      // "… grand mumtaz all 3 nights": "all" starts a restatement, not the name.
      if (['all', 'whole', 'entire'].includes(t) && (isNum(at(k + 1)) || at(k + 1) === 'the')) break
      words.push(t)
      k++
    }
    const stop = at(k)
    while (words.length && TRAIL_TRIM.has(words[words.length - 1])) words.pop()
    return { words, end: k - 1, stop }
  }
  const collectBefore = (end) => {
    const words = []
    let k = end
    while (k >= 0 && words.length < 6) {
      const t = at(k)
      if (t === '|' || isNum(t) || BACK_STOP.has(t)) break
      words.unshift(t)
      k--
    }
    while (words.length && TRAIL_TRIM.has(words[0])) words.shift()
    return { words, start: k + 1, before: at(k) }
  }

  // Vehicle. Exact names are taken before the stays so "… at pine spring innova"
  // doesn't swallow the cab into the hotel phrase; near-misses are tried after.
  let vehicleId = null
  let vehicleName = ''
  const findVehicle = (fuzzy) => {
    if (!cat.vehicles.length) return
    let best = null
    for (const v of cat.vehicles) {
      const hits = []
      v.tokens.forEach((vt) => {
        const idx = tok.findIndex(
          (t, i) =>
            !used[i] &&
            (t === vt || t === vt + 's' || (fuzzy && vt.length >= 5 && t.length >= 5 && levRatio(t, vt) >= 0.8)),
        )
        if (idx >= 0) hits.push(idx)
      })
      if (!hits.length) continue
      const ratio = hits.length / v.tokens.length
      if (!best || hits.length > best.hits.length || (hits.length === best.hits.length && ratio > best.ratio)) {
        best = { v, hits, ratio }
      }
    }
    if (best) {
      vehicleId = best.v.id
      vehicleName = best.v.name
      best.hits.forEach((i) => (used[i] = true))
    }
  }
  findVehicle(false)

  // Stays
  const stays = []
  const addStay = (n, words, from, to, pos = from) => {
    const r = resolveStay(n, words, cat)
    stays.push({ pos, stay: r.stay })
    warnings.push(...r.warnings)
    mark(from, to)
    return r
  }
  // The words just before "N nights" that ARE a place: the longest tail made only
  // of a city's or a matched hotel's own words ("rahul sharma pahalgam" → "pahalgam").
  const placeTail = (words) => {
    for (let len = words.length; len >= 1; len--) {
      const tail = words.slice(words.length - len)
      if (tail.some((w) => w.length < 3 && !isNum(w))) continue
      if (cityLookup(tail, cat)) return len
      const h = matchHotel(tail, '', cat).hotel
      if (h) {
        const own = new Set([...h.tokens, ...normTokens(h.city)])
        if (tail.every((w) => own.has(w) || [...own].some((o) => o.length >= 5 && w.length >= 5 && levRatio(o, w) >= 0.8))) return len
      }
    }
    return 0
  }
  // Is "X 2 nights Y 2 nights" said place-first? Follow the chain of counts
  // from the one at k: place-first when the LAST count has no place after it
  // ("… khyber 2 nights."), place-after when it does ("… 1 night srinagar").
  const placesBeforeCounts = (k) => {
    let guard = 0
    while (guard++ < 12) {
      let j = k + 2
      while (['stay', 'stays', 'staying', 'of'].includes(at(j))) j++
      if (PREPS.has(at(j))) return false
      const a = collectAfter(j)
      // Nothing after the last count, or nothing that's a place ("… 2 nights sedan").
      if (!a.words.length || !(cityLookup(a.words, cat) || placeTail(a.words) > 0 || matchHotel(a.words, '', cat).hotel)) return true
      let nk = a.end + 1
      if (at(nk) === 'for') nk++
      if (!(isNum(at(nk)) && NIGHT_UNITS.has(at(nk + 1)))) return false
      k = nk
    }
    return false
  }
  // An ordering word right after a stay ("srinagar 1 night first", "… 2 nights at the end").
  const orderAfter = (k) => {
    let j = k
    while (['at', 'the', 'in', 'to'].includes(at(j)) && j < k + 3) j++
    if (ORDER_FIRST.has(at(j))) return { pos: -1000 + k, end: j }
    if (ORDER_LAST.has(at(j))) return { pos: 1000 + k, end: j }
    return null
  }
  for (let i = 0; i < tok.length; i++) {
    if (!isNum(at(i)) || !NIGHT_UNITS.has(at(i + 1))) continue
    const n = +tok[i]
    // "pahalgam 2 nights", "srinagar 1 night first": the place comes before the count.
    // Only a catalog city or hotel counts, so "rahul sharma 2 nights" stays a name.
    if (at(i - 1) !== '|' && at(i - 1) !== 'for' && !isNum(at(i - 1)) && !BACK_STOP.has(at(i - 1))) {
      const b = collectBefore(i - 1)
      const len = placeTail(b.words)
      if (len) {
        const words = b.words.slice(b.words.length - len)
        const from = i - len
        const order = orderAfter(i + 2)
        addStay(n, words, from, order ? order.end : i + 1, order ? order.pos : from)
        i = order ? order.end : i + 1
        continue
      }
    }
    // "… grand mumtaz all 3 nights" / "for the whole 3 nights": restates the
    // stay just said, not a new one.
    if (stays.length && ['all', 'whole', 'entire', 'full'].includes(at(i - 1) === 'the' ? at(i - 2) : at(i - 1))) {
      mark(i, i + 1)
      i += 1
      continue
    }
    let j = i + 2
    while (['stay', 'stays', 'staying', 'of'].includes(at(j)) && j < i + 4) j++
    // "4 nights grand mumtaz for 2 nights and khyber for 2 nights",
    // "4 nights grand mumtaz 2 nights khyber 2 nights": the words after this
    // count belong to the NEXT count, so this one is the trip length.
    {
      const a0 = collectAfter(PREPS.has(at(j)) ? j + 1 : j)
      let k = a0.end + 1
      const viaFor = at(k) === 'for'
      if (viaFor) k++
      if (
        a0.words.length &&
        isNum(at(k)) &&
        NIGHT_UNITS.has(at(k + 1)) &&
        n > +at(k) &&
        (viaFor || (placeTail(a0.words) === a0.words.length && placesBeforeCounts(k)))
      ) {
        if (!nightsTotal) nightsTotal = n
        mark(i, i + 1)
        i += 1
        continue
      }
    }
    if (PREPS.has(at(j))) {
      const a = collectAfter(j + 1)
      if (a.words.length) {
        const order = orderAfter(a.end + 1)
        addStay(n, a.words, i, order ? order.end : a.end, order ? order.pos : i)
        i = order ? order.end : a.end
        continue
      }
    }
    if (at(i - 1) === 'for') {
      const b = collectBefore(i - 2)
      if (b.words.length && !['for', 'customer', 'client', 'mr', 'mrs', 'ms', 'name'].includes(b.before)) {
        addStay(n, b.words, b.start, i + 1)
        i += 1
        continue
      }
      // "trip for ravi lalit for 2 nights": words right after "for" are probably the client's
      // name, so only take a trailing part that clearly names a catalog hotel.
      let taken = false
      for (let k = 1; k < b.words.length && !taken; k++) {
        const tail = b.words.slice(k)
        if (matchHotel(tail, '', cat).hotel) {
          addStay(n, tail, b.start + k, i + 1)
          taken = true
        }
      }
      if (taken) {
        i += 1
        continue
      }
    }
    const nx = at(j)
    if (nx !== '|' && !isNum(nx) && !BOUNDARY.has(nx) && nx !== 'and' && !PREPS.has(nx)) {
      const a = collectAfter(j)
      if (a.words.length) {
        // "3 nights kashmir trip" is a trip length + destination, not a stay.
        // … and so is "4 night kashmir trip", a region that names no hotel.
        const probe = splitCity(a.words, cat)
        const tripLength = TRIP_WORDS.has(a.stop) && (probe.hotelWords.length === 0 || !matchHotel(a.words, '', cat).hotel)
        if (!tripLength) {
          const order = orderAfter(a.end + 1)
          addStay(n, a.words, i, order ? order.end : a.end, order ? order.pos : i)
          i = order ? order.end : a.end
          continue
        }
      }
    }
    // A bare "N nights" = trip length.
    if (!nightsTotal) nightsTotal = n
    mark(i, i + 1)
    i += 1
  }
  // "3 night trip … stay at highlands park": a hotel named with no count of
  // its own takes the whole trip (only when it's the only stay).
  if (!stays.length && nightsTotal) {
    for (let i = 0; i < tok.length; i++) {
      if (!['stay', 'staying', 'stays', 'hotel', 'at', 'in'].includes(at(i))) continue
      let j = i + 1
      while (['at', 'in', 'the', 'hotel'].includes(at(j))) j++
      const a = collectAfter(j)
      if (!a.words.length) continue
      const h = matchHotel(a.words, '', cat).hotel
      if (!h) continue
      addStay(nightsTotal, a.words, i, a.end)
      break
    }
  }
  // … or named bare anywhere ("4 nights from 1st december grand mumtaz innova").
  if (!stays.length && nightsTotal) {
    for (let i = 0; i < tok.length; i++) {
      if (at(i) === '|' || BOUNDARY.has(at(i)) || PREPS.has(at(i)) || isNum(at(i)) || at(i - 1) === 'for') continue
      const a = collectAfter(i)
      if (!a.words.length || cityLookup(a.words, cat)) continue
      const h = matchHotel(a.words, '', cat).hotel
      if (!h || !a.words.some((w) => w.length >= 4 && h.tokens.includes(w))) continue
      addStay(nightsTotal, a.words, i, a.end)
      break
    }
  }
  // Second pass: stays the loop above couldn't read ("lalit 2, khyber 1"),
  // found as the cheapest reading of the leftover words (readStays).
  for (const e of readStays(tok, used, cat, { collectAfter })) {
    if (e.kind === 'stay') addStay(e.n, e.words, e.from, e.to)
  }
  stays.sort((a, b) => a.pos - b.pos)

  // Leftover "N days"
  for (let i = 0; i < tok.length; i++) {
    // Not "day 2 day trip to …" (a day number, then a day trip).
    if (isNum(at(i)) && DAY_UNITS.has(at(i + 1)) && at(i - 1) !== 'day') {
      if (!days) days = +tok[i]
      mark(i, i + 1)
    }
  }

  // Vehicle (fuzzy pass — the exact pass already ran before the stays)
  if (!vehicleId) findVehicle(true)

  // Client name
  let clientName = ''
  for (let i = 0; i < tok.length && !clientName; i++) {
    const t = at(i)
    let start = -1
    if (t === 'for') start = i + 1
    else if (t === 'customer' || t === 'client' || t === "customer's" || t === "client's") start = i + 1
    else if (t === 'name' && at(i + 1) === 'is') start = i + 2
    // "…for 4 pax, Mr Lone, arriving …": a title starts a name on its own.
    else if (['mr', 'mrs', 'ms', 'miss', 'mister', 'dr', 'shri', 'smt'].includes(t)) start = i + 1
    if (start < 0) continue
    while (NAME_SKIP.has(at(start))) start++
    const words = []
    let k = start
    while (words.length < 4) {
      const w = at(k)
      if (w === '|' || NAME_STOP.has(w) || !/^[a-z][a-z'.]*$/.test(w)) break
      // "trip for rahul gulmarg …": a catalog city ends the name.
      if (words.length && w.length >= 4 && cityLookup([w], cat)) break
      words.push(w)
      k++
    }
    if (!words.length || NAME_REJECT.has(words[0]) || words[0].length < 2) continue
    if (cityLookup([words[0]], cat) || cityLookup(words, cat)) continue
    clientName = titleCase(words.join(' ').replace(/\.+$/, '').replace(/'s$/, ''))
    mark(start, k - 1)
  }

  // Destination: a catalog destination named anywhere (outside stays/name), else first stay's city.
  let destinationId = null
  let destinationName = ''
  let found = null
  for (const d of cat.destinations) {
    const n = d.tokens.length
    if (!n) continue
    for (let i = 0; i + n <= tok.length; i++) {
      let ok = true
      for (let k = 0; k < n && ok; k++) {
        const t = at(i + k)
        const dt2 = d.tokens[k]
        ok = t === dt2 || (dt2.length >= 5 && t.length >= 5 && levRatio(t, dt2) >= 0.85)
      }
      if (ok && (!found || i < found.pos)) found = { pos: i, d }
    }
  }
  // A region said ("kashmir trip"): a word of a destination's state. It names
  // the trip (title, Destination field) ahead of a city mentioned later.
  // Only a word that IS a region name counts ("kashmir", "ladakh", "himachal",
  // "goa") — never the generic words inside state names ("West Bengal",
  // "Uttar Pradesh", "Dadra and Nagar Haveli"), or "west side trip" would
  // become a trip to "West".
  const REGION_SKIP = new Set([
    'and', 'the', 'of', 'pradesh', 'islands', 'island', 'union', 'territory', 'state', 'nadu', 'bengal',
    'west', 'east', 'north', 'south', 'new', 'central', 'upper', 'lower', 'nagar', 'uttar', 'madhya',
    'andhra', 'arunachal', 'haveli', 'daman', 'diu', 'dadra', 'nicobar', 'tamil',
  ])
  let region = null
  for (const d of cat.destinations) {
    const words = normTokens(String(d.raw.state || '')).filter((w) => w.length >= 3 && !REGION_SKIP.has(w))
    for (const w of words) {
      const i = tok.findIndex((t, k) => !used[k] && (t === w || (w.length >= 6 && t.length >= 6 && levRatio(t, w) >= 0.85)))
      if (i >= 0 && (!region || i < region.pos) && !cat.cities.has(w)) region = { pos: i, name: titleCase(w) }
    }
  }
  // A destination named only in passing ("Sonamarg day trip, 3 nights in
  // Srinagar") isn't the trip's destination when nobody sleeps there: the
  // first overnight city is.
  const stayCities = stays.map((x) => x.stay.city).filter(Boolean)
  const sleptIn = (name) => stayCities.some((c) => sameCity(c, name))
  if (found && stayCities.length && !sleptIn(found.d.name) && !sleptIn(found.d.raw.city)) {
    // …but a region-style destination ("Kashmir", no hotels of its own) still names the trip.
    const hotelCity = cat.hotels.some((h) => sameCity(h.city, found.d.name))
    const n = found.d.tokens.length
    const around = [tok[found.pos - 3], tok[found.pos - 2], tok[found.pos - 1], '#', tok[found.pos + n], tok[found.pos + n + 1]].join(' ')
    const dayTrip = /\bday trip(?: to)? #|# day trip\b|\bexcursion to #|# excursion\b/.test(around)
    if (hotelCity || dayTrip) found = null
  }
  if (region && (!found || region.pos <= found.pos)) {
    destinationName = region.name
  } else if (found) {
    destinationId = found.d.id
    destinationName = found.d.name
  } else {
    // A region the catalog doesn't have ("trip to Ladakh"), else what the
    // stays are in: one town → that town; several → their region
    // (Srinagar + Gulmarg + Pahalgam → "Kashmir", geo.js tripDestination).
    const named = tok.findIndex((t, i) => !used[i] && REGIONS.has(t))
    const sorted = stays.slice().sort((x, y) => x.pos - y.pos).map((x) => x.stay.city)
    const fromStays = sorted.filter(Boolean).length ? tripDestination(sorted, cat.destinations.map((d) => d.raw)) : null
    if (named >= 0) destinationName = titleCase(tok[named])
    else if (fromStays) {
      destinationId = fromStays.id
      destinationName = fromStays.name
    }
  }

  // Client name without a lead-in word ("rahul sharma pahalgam 2 nights",
  // "itinerary for 2 adults rahul sharma", Hinglish "rahul ka … banao"): the
  // first run of leftover words that aren't places, hotels or trip words.
  // Two or three words are taken as a name; one word only with "ka/ki/ke",
  // "'s" or "family" after it, so a stray word isn't mistaken for a client.
  if (!clientName) {
    const isPlace = (w) => !!cityLookup([w], cat) || cat.destinations.some((d) => d.tokens.includes(w))
    const usable = (i) => {
      const w = at(i)
      return w !== '|' && /^[a-z]+('s)?$/.test(w) && w.length >= 2 && !NAME_REJECT.has(w.replace(/'s$/, '')) &&
        !FALLBACK_NAME_SKIP.has(w) && !isPlace(w.replace(/'s$/, ''))
    }
    for (let i = 0; i < tok.length && !clientName; i++) {
      if (!usable(i) || (i > 0 && usable(i - 1))) continue
      let k = i
      while (k < tok.length && usable(k) && k - i < 3 && !/'s$/.test(at(k - 1) || '')) k++
      const words = tok.slice(i, k).map((w) => w.replace(/'s$/, ''))
      const after = at(k)
      const possessive = /'s$/.test(tok[k - 1]) || ['ka', 'ki', 'ke', 'family'].includes(after)
      if (words.length >= 2 || possessive) {
        clientName = titleCase(words.join(' '))
        mark(i, k - 1)
      }
    }
  }

  // One-word name said without a lead-in: "Rahul trip", "Rahul's trip", or
  // alone at the start between commas ("Rahul, 2 people, 10 nov, …").
  if (!clientName) {
    const one = (i) => {
      const w = at(i)
      const plain = w.replace(/'s$/, '')
      if (w === '|' || !/^[a-z]+('s)?$/.test(w) || plain.length < 3) return ''
      if (NAME_REJECT.has(plain) || FALLBACK_NAME_SKIP.has(plain) || BOUNDARY.has(plain) || REGIONS.has(plain)) return ''
      if (cityLookup([plain], cat) || cat.destinations.some((d) => d.tokens.includes(plain)) || matchHotel([plain], '', cat).hotel) return ''
      if (cat.vehicles.some((v) => v.tokens.includes(plain))) return ''
      return plain
    }
    for (let i = 0; i < tok.length && !clientName; i++) {
      const lone = i === 0 && at(1) === '|' && tok.length > 2
      const beforeTrip = TRIP_WORDS.has(tok[i + 1]) && (i === 0 || at(i - 1) === '|')
      const w = (lone || beforeTrip) && one(i)
      if (w) {
        clientName = titleCase(w)
        mark(i, i)
      }
    }
  }

  // Nights / days reconciliation
  let stayList = stays.map((x) => x.stay)
  // A hotel is never booked in a city it isn't in. Named for one city but in
  // another: it goes to a stay in its own city that has no hotel yet (the
  // words were just in the wrong place); otherwise that city gets a hotel
  // picked from its own list, and the agent is told.
  stayList.forEach((st, i) => {
    if (!st.cityConflict) return
    const hotelCity = st.cityConflict
    const name = st.hotelName
    const order = [i + 1, i - 1, ...stayList.map((_, k) => k)]
    const target = order.map((k) => stayList[k]).find((o) => o && o !== st && !o.hotelId && (sameCity(o.city, hotelCity) || samePlace(o.city, hotelCity)))
    if (target) {
      target.hotelId = st.hotelId
      target.hotelName = name
      // that stay isn't missing a hotel any more
      for (let w = warnings.length - 1; w >= 0; w--) {
        if (/^No hotel named for \d+ nights? in /.test(warnings[w]) && samePlace(warnings[w].replace(/^No hotel named for \d+ nights? in (.+?) — pick one$/, '$1'), hotelCity)) warnings.splice(w, 1)
      }
      warnings.push(`${name} is in ${hotelCity} — booked it for the ${hotelCity} nights and picked a ${st.city} hotel for ${st.city}`)
    } else {
      warnings.push(`${name} is in ${hotelCity}, not ${st.city} — picked a ${st.city} hotel instead`)
    }
    st.hotelId = null
    st.hotelName = ''
    delete st.cityConflict
  })
  let dayPlan = null
  if (dayRoutes) {
    // The day plan decides where they sleep; a hotel named for a city ("stay at
    // Heevan in Pahalgam") is kept for that city's nights.
    dayPlan = buildDayPlan(dayRoutes, { nights: nightsTotal || (days > 1 ? days - 1 : 0) })
    stayList = dayPlan.stays.map((p) => {
      const named = stayList.find((x) => x.hotelId && sameCity(x.city || cat.hotels.find((h) => h.id === x.hotelId)?.city, p.city))
      return named ? { ...named, nights: p.nights, city: p.city } : { nights: p.nights, hotelId: null, hotelName: '', city: p.city, heard: p.city }
    })
    nightsTotal = dayPlan.nights
    days = dayPlan.nights + 1
  }
  if (rangeNights && !dayPlan) {
    if (nightsTotal && nightsTotal !== rangeNights) {
      warnings.push(`The dates are ${plural(rangeNights, 'night')} but you said ${plural(nightsTotal, 'night')} — using the dates`)
    }
    nightsTotal = rangeNights
    days = rangeNights + 1
  }
  const staySum = stayList.reduce((a, x) => a + (Number(x.nights) || 0), 0)
  let nights = nightsTotal || (days > 1 ? days - 1 : 0) || staySum
  if (!days && nights) days = nights + 1
  if (stayList.length && staySum !== nights) {
    warnings.push(`Hotel nights add up to ${staySum} but the trip is ${plural(nights, 'night')}`)
  }

  const intent =
    tripWordHeard || nights > 0 || days > 0 || stayList.length > 0 || (startDate && guests.heardAny)
      ? 'create_trip'
      : 'unknown'

  const cmd = {
    intent,
    transcript,
    clientName,
    clientPhone,
    clientEmail,
    adults: guests.heardAdults ? guests.adults : 2,
    children: guests.children,
    infants: guests.infants,
    childAges: guests.ages,
    startDate,
    nights,
    days,
    destinationId,
    destinationName,
    stays: stayList,
    // "… first" / "… at the end" put a stay somewhere on purpose: keep that order.
    stayOrderSaid: stays.some((x) => x.pos < -500 || x.pos > 500),
    dayPlan,
    vehicleId,
    vehicleName,
    vehicleQuantity,
    mealPlan,
    roomType,
    rooms,
    extraBeds,
    missing: [],
    warnings,
  }
  if (!clientName) cmd.missing.push('clientName')
  if (!guests.heardAdults) cmd.missing.push('adults')
  if (!startDate) cmd.missing.push('startDate')
  if (!nights) cmd.missing.push('nights')
  if (!stayList.length) cmd.missing.push('stays')
  if (!destinationName) cmd.missing.push('destination')
  if (!vehicleId) cmd.missing.push('vehicle')
  if (!mealPlan) cmd.missing.push('mealPlan')
  return cmd
}

/**
 * Check a (possibly user-edited) ChingCommand before building.
 * problems block the build; warnings don't. Pass the catalog (same shape as the parser's)
 * to also warn about hotels marked unavailable.
 */
export function validateChingCommand(cmd, catalog) {
  const problems = []
  const warnings = []
  if (!cmd || typeof cmd !== 'object') return { ok: false, problems: ['Nothing to build yet'], warnings }

  if (!String(cmd.clientName ?? '').trim()) problems.push('Client name is missing')
  const adults = Number(cmd.adults)
  if (!Number.isFinite(adults) || adults < 1) problems.push('At least 1 adult is needed')
  if (Number(cmd.children) < 0 || Number(cmd.infants) < 0) problems.push("Children/infants can't be negative")
  if (!cmd.startDate) problems.push('Start date is missing')
  else if (!isValidIsoDate(cmd.startDate)) problems.push(`Start date "${cmd.startDate}" is not a valid date`)
  const nights = Number(cmd.nights)
  if (!Number.isFinite(nights) || nights < 1) problems.push('Trip needs at least 1 night')

  const stays = Array.isArray(cmd.stays) ? cmd.stays : []
  const hotelsById = new Map((catalog && Array.isArray(catalog.hotels) ? catalog.hotels : []).map((h) => [String(h.id), h]))
  stays.forEach((st, i) => {
    const label = st && (st.hotelName || st.city || st.heard) ? ` (${st.hotelName || st.city || st.heard})` : ''
    if (!st || st.hotelId == null || st.hotelId === '') problems.push(`Pick a hotel for stay ${i + 1}${label}`)
    if (!(Number(st && st.nights) >= 1)) problems.push(`Stay ${i + 1}${label} needs at least 1 night`)
    const h = st && st.hotelId != null ? hotelsById.get(String(st.hotelId)) : null
    if (h && h.is_available === false) warnings.push(`${h.name} is marked unavailable`)
  })
  if (stays.length) {
    const sum = stays.reduce((a, st) => a + (Number(st && st.nights) || 0), 0)
    if (Number.isFinite(nights) && nights >= 1 && sum !== nights) {
      problems.push(`Hotel nights add up to ${sum} but the trip is ${plural(nights, 'night')}`)
    }
  } else {
    warnings.push('No hotels added — the trip will get a day plan but no accommodation')
  }
  const days = Number(cmd.days)
  if (days && Number.isFinite(nights) && nights >= 1 && days !== nights + 1) {
    warnings.push(`${plural(days, 'day')} doesn't match ${plural(nights, 'night')}; the builder will use ${nights + 1} days`)
  }
  return { ok: problems.length === 0, problems, warnings }
}
