// Ching — deterministic, rule-based parser for spoken/typed Trip Builder commands.
// No AI model, no network. Pure JS: no React, no DOM, no imports outside utils/ching.
//
//   parseChingCommand(text, catalog, { today }) -> ChingCommand
//   validateChingCommand(cmd, catalog?)         -> { ok, problems, warnings }
//
// catalog = { hotels, destinations, vehicles } in the /api/builder/init shapes.
// See the Ching contract for the ChingCommand shape.

import { convertNumberWords, stripWakePhrase, hasWakePhrase, titleCase } from './text.js'
import { extractDate, extractDateRange, isValidIsoDate, toLocalMidnight } from './dates.js'
import { tripDestination, gazetteerKey, GAZETTEER } from './places.js'
import { normTokens, normKey, significantTokens, levRatio, bestMatch } from './fuzzy.js'
import { shortestPath } from './graph.js'

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
])
const PREPS = new Set(['in', 'at', 'inside'])
const TRIP_WORDS = new Set(['itinerary', 'itineraries', 'trip', 'tour', 'package', 'holiday', 'holidays', 'vacation', 'plan'])
// Words that end a hotel phrase ("2 nights in <hotel> then ...").
const BOUNDARY = new Set([
  'then', 'followed', 'after', 'afterwards', 'next', 'later', 'with', 'for', 'starting', 'start', 'starts',
  'begin', 'beginning', 'from', 'number', 'guests', 'guest', 'adults', 'adult', 'children', 'child', 'kids',
  'kid', 'infants', 'infant', ...TRIP_WORDS, 'phone', 'mobile', 'email', 'customer', 'client', 'date', 'total',
  'including', 'include', 'includes', 'plus', 'also', 'finally', 'lastly', 'last', 'via', 'please', 'ok',
  'okay', 'thanks', 'thank', 'nights', 'night', 'days', 'day', 'i', 'we', 'want', 'need', 'create', 'make',
  'build', 'rest', 'remaining',
])
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
  'week', 'weekend', 'month', 'tomorrow', 'today', 'tonight',
])
// Words that are never a client's name when it's said without "for"/"customer".
const LOOSE_NAME_REJECT = new Set([
  'new', 'quick', 'short', 'long', 'weekend', 'winter', 'summer', 'snow', 'romantic', 'luxury', 'budget',
  'create', 'make', 'build', 'book', 'plan', 'start', 'ok', 'okay', 'thanks', 'yes', 'no', 'hello', 'hi',
  'hey', 'ching', 'cab', 'car', 'taxi', 'room', 'rooms', 'meals', 'breakfast', 'dinner', 'lunch', 'only',
  'and', 'then', 'also', 'one', 'another', 'same', 'school', 'office', 'corporate', 'college', 'friends',
])
const NAME_REJECT = new Set([
  ...NAME_STOP, 'my', 'our', 'your', 'his', 'her', 'their', 'me', 'us', 'him', 'them', 'someone', 'somebody',
  'honeymoon', 'all', 'both', 'each', 'next', 'everyone', 'friends', 'two', 'customer', 'client', 'mr', 'mrs',
])
const VEHICLE_GENERIC = new Set(['car', 'cab', 'taxi', 'vehicle', 'ac', 'non', 'with', 'and', 'the', 'seater', 'driver'])
const TRAIL_TRIM = new Set(['and', 'the', 'stay', 'of', 'in', 'at'])

const REGIONS = new Set(Object.values(GAZETTEER).map((g) => g[2].toLowerCase()))
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

export function extractEmail(s) {
  const typed = /(?:\b(?:e-?mail|mail)(?:\s+(?:id|address))?\s*(?:is\s+|:\s*|-\s*)?)?\b([a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/
  let m = typed.exec(s)
  if (m) return { email: m[1], s: s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length) }
  const spoken =
    /\b(?:e-?mail|mail)(?:\s+(?:id|address))?\s*(?:is\s+|:\s*)?([a-z0-9._]+)\s*(?:@|at\s+the\s+rate(?:\s+of)?|at)\s*([a-z0-9-]+)\s*(?:dot|\.)\s*(com|in|org|net|co\s*(?:dot|\.)\s*in|co)\b/
  m = spoken.exec(s)
  if (m) {
    const tld = m[3].replace(/\s*(?:dot|\.)\s*/, '.').replace(/\s+/g, '')
    return { email: `${m[1]}@${m[2]}.${tld}`, s: s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length) }
  }
  return { email: '', s }
}

export function extractPhone(s) {
  const keyed =
    /\b(?:phone|mobile|mob|contact|cell|whatsapp|ph)\.?(?:\s+(?:number|no\.?|num))?\s*(?:is\s+|:\s*|-\s*)?(\+?\d(?:[\s-]?\d){9,12})(?!\d)/
  let m = keyed.exec(s)
  if (!m) m = /(?<![\d/.-])((?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5})(?![\d/.-])/.exec(s)
  if (!m) return { phone: '', s }
  const phone = m[1].replace(/[\s-]/g, '')
  return { phone, s: s.slice(0, m.index) + ' | ' + s.slice(m.index + m[0].length) }
}

function extractGuests(input) {
  let s = input
  const g = { adults: 0, children: 0, infants: 0, total: 0, heardAdults: false, heardAny: false }
  const take = (re, fn) => {
    s = s.replace(re, (...m) => {
      fn(m)
      g.heardAny = true
      return ' | '
    })
  }
  const KID = '(?:children|child|childs|kids|kid|kiddos?)'
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
// works whichever order the agent said things in.
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
  s = convertNumberWords(s)

  const ph = extractPhone(s)
  const clientPhone = ph.phone
  s = ph.s

  // Anything trip-like at all? (checked before spans are blanked out)
  const tripWordHeard = /\b(?:itinerar(?:y|ies)|trip|tour|package|holidays?|vacation|quotation|quote|booking)\b/.test(s)

  const meal = extractMealPlan(s)
  const mealPlan = meal.plan
  s = meal.s

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

  const guests = extractGuests(s)
  s = guests.s

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
      words.push(t)
      k++
    }
    const stop = at(k)
    while (words.length && TRAIL_TRIM.has(words[words.length - 1])) words.pop()
    return { words, end: k - 1, stop }
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

  // Stays — read as a shortest path through the words (see readStays).
  const stays = []
  const addStay = (n, words, from, to) => {
    const r = resolveStay(n, words, cat)
    stays.push({ pos: from, stay: r.stay })
    warnings.push(...r.warnings)
    mark(from, to)
    return r
  }
  for (const e of readStays(tok, used, cat, { collectAfter })) {
    if (e.kind === 'bare') {
      if (!nightsTotal) nightsTotal = e.n
      mark(e.from, e.to)
    } else {
      addStay(e.n, e.words, e.from, e.to)
    }
  }
  stays.sort((a, b) => a.pos - b.pos)

  // Leftover "N days"
  for (let i = 0; i < tok.length; i++) {
    if (isNum(at(i)) && DAY_UNITS.has(at(i + 1))) {
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
    if (start < 0) continue
    while (NAME_SKIP.has(at(start))) start++
    const words = []
    let k = start
    while (words.length < 4) {
      const w = at(k)
      if (w === '|' || NAME_STOP.has(w) || !/^[a-z][a-z'.]*$/.test(w)) break
      words.push(w)
      k++
    }
    if (!words.length || NAME_REJECT.has(words[0]) || words[0].length < 2) continue
    if (cityLookup([words[0]], cat) || cityLookup(words, cat)) continue
    clientName = titleCase(words.join(' ').replace(/\.+$/, ''))
    mark(start, k - 1)
  }

  // Name said without "for"/"customer": "Rahul's trip", "Rahul Sharma trip",
  // or a short phrase on its own between commas ("…, Rahul Sharma, 4 adults").
  const looseName = (from, to) => {
    const words = tok.slice(from, to + 1)
    if (!words.length || words.length > 3 || words.some((w, k) => used[from + k])) return ''
    if (!words.every((w) => /^[a-z][a-z'.]*$/.test(w) && w.length >= 2)) return ''
    const plain = words.map((w) => w.replace(/'s$/, ''))
    if (plain.some((w) => NAME_STOP.has(w) || NAME_REJECT.has(w) || LOOSE_NAME_REJECT.has(w) || BOUNDARY.has(w))) return ''
    if (cityLookup(plain, cat) || plain.some((w) => cityLookup([w], cat) || gazetteerKey(w) || REGIONS.has(w))) return ''
    if (matchHotel(plain, '', cat).hotel || cat.vehicles.some((v) => v.tokens.some((t) => plain.includes(t)))) return ''
    mark(from, to)
    return titleCase(plain.join(' '))
  }
  for (let i = 0; i < tok.length && !clientName; i++) {
    if (!TRIP_WORDS.has(tok[i])) continue
    for (let k = 3; k >= 1 && !clientName; k--) {
      if (i - k < 0 || (i - k - 1 >= 0 && at(i - k - 1) !== '|' && !['a', 'the', 'create', 'make', 'new'].includes(at(i - k - 1)))) continue
      clientName = looseName(i - k, i - 1)
    }
  }
  for (let i = 0; i < tok.length && !clientName; i++) {
    if (at(i) === '|' || (i > 0 && at(i - 1) !== '|')) continue
    let j = i
    while (j + 1 < tok.length && at(j + 1) !== '|') j++
    if (j + 1 >= tok.length && i === 0) break // the whole sentence is not a name
    clientName = looseName(i, j)
    i = j
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
  if (found) {
    destinationId = found.d.id
    destinationName = found.d.name
  } else {
    // A region the catalog doesn't have ("trip to Ladakh"), else the region /
    // city the stays are in (Srinagar + Gulmarg + Pahalgam → Kashmir).
    const region = tok.findIndex((t, i) => !used[i] && REGIONS.has(t))
    const fromStays = tripDestination(
      stays.map((x) => x.stay.city),
      cat.destinations.map((d) => d.raw),
    )
    if (region >= 0) destinationName = titleCase(tok[region])
    else if (fromStays) {
      destinationId = fromStays.id
      destinationName = fromStays.name
    }
  }

  // Nights / days reconciliation
  const stayList = stays.map((x) => x.stay)
  const staySum = stayList.reduce((a, x) => a + (Number(x.nights) || 0), 0)
  if (rangeNights && nightsTotal && nightsTotal !== rangeNights) {
    warnings.push(`The dates are ${plural(rangeNights, 'night')} but you said ${plural(nightsTotal, 'night')} — using the dates`)
  }
  if (rangeNights) nightsTotal = rangeNights
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
    startDate,
    nights,
    days,
    destinationId,
    destinationName,
    stays: stayList,
    vehicleId,
    vehicleName,
    mealPlan,
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
