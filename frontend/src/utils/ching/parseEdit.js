// Ching — deterministic, rule-based parser for spoken/typed EDITS to an open trip.
// No AI model, no network. Pure JS: no React, no DOM, no imports outside utils/ching.
//
//   parseChingEdit(text, context, catalog, { today }) ->
//     { intent: "edit" | "create" | "unknown", actions, unrecognized, warnings }
//   isCreateRequest(text) -> boolean   (a request for a brand-new trip, not an edit)
//
// context = buildEditContext(snapshot) (see ching-edit-contract.md);
// catalog = { hotels, destinations, vehicles, activities } from /api/builder/init.
// Each clause of the utterance becomes zero or more actions; a clause that can't be
// understood goes to `unrecognized` — never a guessed action.

import { convertNumberWords, normalizeTripWords, stripWakePhrase, titleCase } from './text.js'
import { extractDate, toLocalMidnight } from './dates.js'
import { normTokens, normKey, significantTokens, levRatio, bestMatch } from './fuzzy.js'
import { parseInclusionClause } from './inclusions.js'
import { parseDayPlan, withoutClaimed } from './dayPlan.js'
import { parseAmount } from './pricing.js'
import { prepareCatalog, cityLookup, sameCity, matchHotel, extractMealPlan, extractEmail, extractPhone } from './parseCommand.js'

const COMMAND_TYPES = new Set([
  'EXPORT_PDF', 'EXPORT_EXCEL', 'EMAIL_ME', 'SAVE', 'SEND_PROPOSAL', 'SEND_PAYMENT_LINK', 'SEND_REMINDER',
])
const STAY_STRUCTURE = new Set(['SET_STAY_NIGHTS', 'ADD_STAY', 'REMOVE_STAY'])
const TRIP_NOUN = '(?:trip|itinerary|itineraries|tour|package|quotation|quote|holiday|vacation)'
const SPLIT_VERBS = new Set([
  'change', 'make', 'reduce', 'increase', 'decrease', 'replace', 'swap', 'switch', 'remove', 'delete', 'skip',
  'drop', 'shift', 'move', 'export', 'download', 'undo', 'keep', 'set', 'give', 'add', 'use', 'extend',
  'shorten', 'email', 'send', 'save', 'include', 'put', 'cancel', 'update', 'apply', 'whatsapp', 'share',
  'copy', 'remind', 'ask',
])
// A verb right after one of these belongs to the same clause ("i want to change", "can you add").
const NO_SPLIT_PREV = new Set([
  'to', 'you', 'i', 'we', 'please', 'pls', 'can', 'could', 'would', 'will', 'lets', "let's", 'kindly', 'and',
  'then', 'also', 'just', 'now', 'us', "i'd", 'me', 'should', 'must', 'not', "don't", 'dont', 'the',
  'my', 'your', 'his', 'her', 'their', 'a', 'an', 'by', 'via', 'on', 'in', 'of', 'no', 'it', 'through', 'over',
])
const SPLIT_NOUNS = new Set(['margin', 'markup', 'gst'])
const CARRY_LEAD = new Set(['no', 'without', 'with', 'plus', 'including', 'excluding', 'zero'])
const NOUN_LEAD = new Set([
  ...NO_SPLIT_PREV, 'with', 'without', 'including', 'excluding', 'inclusive', 'exclusive', 'plus', 'minus', 'trip',
  'profit', 'our', 'total', 'percent', 'of',
])
const LEAD_FILLER =
  /^(?:(?:please|pls|kindly|can you|could you|would you|will you|i want to|i want you to|i would like to|i'd like to|i need to|i need you to|let's|lets|just|now|ok|okay|also|and|then|so|ching|hey|hi|hello|go ahead and)\s+)+/
const TRAIL_FILLER = /(?:\s+(?:please|pls|for me|now|thanks|thank you|ok|okay|as well|too))+$/
const NOISE = /^(?:please|pls|ok|okay|thanks|thank you|ching|hello|hey|hi|yes|yeah|that's it|thats it|done|and|then|also|so)?$/
const GENERIC_HOTEL = new Set([
  'grand', 'palace', 'inn', 'house', 'residency', 'heritage', 'royal', 'view', 'valley', 'park', 'hill', 'hills',
  'lake', 'boutique', 'suites', 'suite', 'lodge', 'camp', 'cottage', 'cottages', 'villa', 'villas', 'regency',
  'plaza', 'international', 'continental', 'deluxe', 'premium', 'luxury', 'hotel', 'resort', 'home', 'stay',
  'homestay', 'houseboat', 'group', 'retreat', 'spa',
])
const ORD_DAY = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const tokEq = (a, b, ratio = 0.85) => a === b || (a.length >= 5 && b.length >= 5 && levRatio(a, b) >= ratio)
const toksOf = (s) => String(s || '').split(/\s+/).filter(Boolean)

function matchSeq(toks, seq, from = 0) {
  if (!seq.length) return -1
  for (let i = from; i + seq.length <= toks.length; i++) {
    let ok = true
    for (let k = 0; k < seq.length && ok; k++) ok = tokEq(toks[i + k], seq[k])
    if (ok) return i
  }
  return -1
}

function normalizeSpeech(text) {
  return stripWakePhrase(String(text ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')).text
}

/**
 * True when the text asks for a NEW trip ("create a 5 day 4 night trip for Rahul",
 * "plan a new itinerary for …", "build an itinerary for Ravi 3 nights") rather than an
 * edit of the open one ("make the trip 6 nights", "make it a 6 night trip", "make day 3 …").
 */
export function isCreateRequest(text) {
  const s = convertNumberWords(normalizeSpeech(text))
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, '$1 ')
    .replace(/[,;!?]+|\.(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return false
  if (/\b(?:instead|this trip|the trip|current|existing|same trip)\b/.test(s)) return false
  if (new RegExp(`\\bnew\\s+(?:[\\w']+\\s+){0,3}?${TRIP_NOUN}\\b`).test(s)) return true
  const verbA = `\\b(?:create|make|build|plan|prepare|generate|draft|design|want|need|book)\\s+(?:me\\s+|us\\s+)?(?:a|an|another)\\b(?:\\s+[\\w']+){0,6}?\\s+${TRIP_NOUN}\\b`
  if (new RegExp(verbA).test(s)) return true
  if (new RegExp(`^(?:an?\\s+)?\\d+\\s*(?:days?|nights?|d|n)\\b.*\\b${TRIP_NOUN}\\s+for\\b`).test(s)) return true
  return false
}

// ---------- context / catalog preparation ----------

function prepareContext(context, cat) {
  const c = context || {}
  const cityKeys = new Set([...cat.cities.keys()])
  const stays = (Array.isArray(c.stays) ? c.stays : []).map((s, i) => ({
    index: Number.isInteger(s.index) ? s.index : i,
    hotelId: s.hotelId ?? null,
    hotelName: String(s.hotelName || ''),
    city: String(s.city || ''),
    nights: Number(s.nights) || 0,
    mealPlan: s.mealPlan || '',
  }))
  stays.forEach((s) => s.city && cityKeys.add(normKey(s.city)))
  stays.forEach((s) => {
    s.cityTokens = normTokens(s.city)
    s.hotelFull = normTokens(s.hotelName)
    s.hotelSig = significantTokens(s.hotelFull).filter(
      (t) => t.length >= 4 && !GENERIC_HOTEL.has(t) && !cityKeys.has(t) && !/^\d+$/.test(t),
    )
  })
  const days = (Array.isArray(c.days) ? c.days : []).map((d, i) => ({
    day: Number(d.day) || i + 1,
    title: String(d.title || ''),
    location: String(d.location || ''),
    activities: Array.isArray(d.activities) ? d.activities : [],
  }))
  const activities = (Array.isArray(c.activities) ? c.activities : []).map((a, i) => ({
    index: Number.isInteger(a.index) ? a.index : i,
    name: String(a.name || ''),
    dayNumber: a.dayNumber,
    location: a.location || '',
    tokens: significantTokens(normTokens(a.name)),
  }))
  return {
    nights: Number(c.nights) || stays.reduce((a, s) => a + s.nights, 0),
    adults: Number(c.adults) || 0,
    children: Number(c.children) || 0,
    infants: Number(c.infants) || 0,
    marginPercent: Number(c.marginPercent) || 0,
    vehicle: c.vehicle || null,
    // Client's name words (3+ letters) so "whatsapp it to rahul" is recognised as the client.
    clientTokens: normTokens(c.clientName).filter((t) => t.length >= 3 && !/^(?:mr|mrs|ms|miss|shri|smt)$/.test(t)),
    stays,
    days,
    activities,
  }
}

function prepareEditCatalog(catalog) {
  const cat = prepareCatalog(catalog)
  const destById = new Map(cat.destinations.map((d) => [String(d.id), d.name]))
  cat.activities = (Array.isArray(catalog?.activities) ? catalog.activities : [])
    .filter((a) => a && a.name)
    .map((a) => ({
      raw: a,
      id: a.id,
      name: String(a.name),
      location: destById.get(String(a.destination_id)) || '',
      price: Number.isFinite(Number(a.selling_price)) && a.selling_price !== null && a.selling_price !== '' ? Number(a.selling_price) : null,
      tokens: significantTokens(normTokens(a.name)),
    }))
  return cat
}

// ---------- mention finders ----------

/** Stays of the open trip mentioned in the tokens (by city or hotel name). */
function stayMentions(toks, S) {
  const hits = []
  for (const st of S.stays) {
    let pos = -1
    if (st.hotelSig.length) pos = toks.findIndex((t) => st.hotelSig.some((h) => tokEq(t, h, 0.8)))
    else if (st.hotelFull.length >= 2) pos = matchSeq(toks, st.hotelFull)
    if (pos >= 0) hits.push({ stay: st.index, pos, via: 'hotel' })
    const cp = matchSeq(toks, st.cityTokens)
    if (cp >= 0) hits.push({ stay: st.index, pos: cp, via: 'city', city: st.city })
  }
  const warnings = []
  const hotelStays = new Set(hits.filter((h) => h.via === 'hotel').map((h) => h.stay))
  const keep = hits.filter((h) => h.via === 'hotel')
  const byCity = new Map()
  hits.filter((h) => h.via === 'city').forEach((h) => {
    const k = normKey(h.city)
    if (!byCity.has(k)) byCity.set(k, [])
    byCity.get(k).push(h)
  })
  for (const group of byCity.values()) {
    if (group.length === 1) keep.push(group[0])
    else if (group.some((h) => hotelStays.has(h.stay))) continue
    else {
      const first = group.slice().sort((a, b) => a.stay - b.stay)[0]
      const st = S.stays.find((s) => s.index === first.stay)
      warnings.push(`${group[0].city} has ${group.length} stays — using the first one (${st?.hotelName || 'no hotel'})`)
      keep.push(first)
    }
  }
  const best = new Map()
  keep.forEach((h) => {
    if (!best.has(h.stay) || best.get(h.stay).pos > h.pos) best.set(h.stay, h)
  })
  const list = [...best.values()].sort((a, b) => a.pos - b.pos || a.stay - b.stay)
  return { list, warnings }
}

/** A city named in the tokens (open-trip cities first, then catalog cities). */
function findCity(toks, S, cat) {
  let found = null
  const consider = (name) => {
    const seq = normTokens(name)
    const pos = matchSeq(toks, seq)
    if (pos >= 0 && (!found || pos < found.pos)) found = { name, pos, len: seq.length }
  }
  S.stays.forEach((s) => s.city && consider(s.city))
  for (const display of cat.cities.values()) consider(display)
  return found
}

function daysIn(c) {
  const out = []
  const re = /\bday\s+(\d{1,2})\b/g
  let m
  while ((m = re.exec(c))) out.push({ day: +m[1], index: m.index, end: m.index + m[0].length })
  return out
}

/** Which day of the open trip is "the <city> sightseeing" etc. */
function findDayByCity(city, S, { exclude = null } = {}) {
  const key = normKey(city)
  if (!key) return null
  let best = null
  for (const d of S.days) {
    if (d.day === exclude) continue
    const title = normKey(d.title)
    const loc = normKey(d.location)
    let score = 0
    if (title.includes(key)) score += 3
    if (loc.includes(key)) score += 2
    if (!score) continue
    if (/\b(?:sightseeing|sight seeing|tour|excursion|visit|local|explore|exploring)\b/.test(title)) score += 2
    if (new RegExp(`\\bto\\s+${key}\\b`).test(title)) score -= 2
    if (!d.activities.length) score -= 1
    if (!best || score > best.score) best = { day: d.day, score }
  }
  return best && best.score > 0 ? best.day : null
}

function checkDay(day, S, warnings) {
  if (S.days.length && (day < 1 || day > S.days.length)) {
    warnings.push(`There's no day ${day} — the trip has ${S.days.length} days`)
    return false
  }
  return true
}

// ---------- clause handlers: (c, toks, env) -> Action[] | null ----------

/** Sending the client proposal / approval link: { type: 'SEND_PROPOSAL', channel } or null. */
const mentionsClient = (c, toks, env) =>
  /\b(?:client|customer|guest|guests|him|her|them)\b/.test(c) ||
  (env.S.clientTokens.length > 0 && toks.some((t) => env.S.clientTokens.includes(t)))
const PAYMENT_WORD = /\b(?:pay|paying|payment|payments|paid|advance|balance|deposit|dues?|outstanding|instal(?:l)?ments?|booking amount)\b/
const TO_ME = /\b(?:me|my|myself|mine|inbox)\b/

/** "remind the client" / "send a payment reminder on whatsapp" -> SEND_REMINDER. */
function reminderCommand(c, toks, env) {
  if (!/\b(?:remind|reminder|reminders|nudge|follow\s*up|chase)\b/.test(c)) return null
  const clientRef = mentionsClient(c, toks, env)
  if (TO_ME.test(c) && !clientRef) return null
  return {
    type: 'SEND_REMINDER',
    kind: PAYMENT_WORD.test(c) ? 'payment' : 'proposal',
    channel: /\bwhatsapp\b/.test(c) ? 'whatsapp' : 'email',
  }
}

/** "send the payment link to the client" / "ask the client to pay the advance" -> SEND_PAYMENT_LINK. */
function paymentLinkCommand(c, toks, env) {
  if (!PAYMENT_WORD.test(c)) return null
  if (!/\b(?:link|url|send|share|copy|ask|collect|request|whatsapp|e-?mail|mail)\b/.test(c)) return null
  const clientRef = mentionsClient(c, toks, env)
  // "send me the payment link" -> the agent wants the link itself.
  if (TO_ME.test(c) && !clientRef) return { type: 'SEND_PAYMENT_LINK', channel: 'link' }
  let channel = 'whatsapp'
  if (/\bwhatsapp\b/.test(c)) channel = 'whatsapp'
  else if (/\b(?:e-?mail|mail)\b/.test(c)) channel = 'email'
  else if (/\b(?:copy|get|show|open|generate)\b/.test(c) || (/\bshare\b/.test(c) && !clientRef)) channel = 'link'
  return { type: 'SEND_PAYMENT_LINK', channel }
}

/** "export excel" / "download the spreadsheet quotation" -> EXPORT_EXCEL. */
function excelCommand(c) {
  if (/\b(?:excel|xls|xlsx|spreadsheet|spread sheet)\b/.test(c)) return { type: 'EXPORT_EXCEL' }
  if (/\bsheet\b/.test(c) && /\b(?:export|download|quotation|quote)\b/.test(c)) return { type: 'EXPORT_EXCEL' }
  return null
}

function proposalCommand(c, toks, env) {
  const clientRef = mentionsClient(c, toks, env)
  const proposal = /\b(?:proposal|approval|quote|quotation)\b/.test(c)
  const link = /\b(?:link|url)\b/.test(c)
  const toMe = /\b(?:me|my|myself|mine|inbox)\b/.test(c) && !clientRef
  const emailWord = /\b(?:e-?mail|mail)\b/.test(c)
  if (/\bwhatsapp\b/.test(c)) return toMe ? null : 'whatsapp'
  if (link) {
    if (toMe) return null
    if (emailWord || (/\bsend\b/.test(c) && clientRef)) return 'email'
    if (/\b(?:copy|share|send|get|give|open|show|generate|create)\b/.test(c) || proposal) return 'link'
    return null
  }
  if (toMe) return null
  if (emailWord && clientRef) return 'email'
  if (/\bsend\b/.test(c) && (clientRef || proposal)) return 'email'
  if (/\b(?:share|copy)\b/.test(c) && (clientRef || proposal)) return 'link'
  return null
}

function hCommands(c, toks, env) {
  if (/\b(?:undo|revert)\b/.test(c) || /^(?:go back|cancel that|cancel the last change|take that back)$/.test(c)) {
    return [{ type: 'UNDO' }]
  }
  const other = reminderCommand(c, toks, env) || paymentLinkCommand(c, toks, env) || excelCommand(c)
  if (other) {
    // "download the pdf and the excel" -> both, in spoken order.
    const pdfAt = c.search(/\bpdf\b/)
    if (other.type === 'EXPORT_EXCEL' && pdfAt >= 0) {
      return pdfAt < c.search(/\b(?:excel|xlsx?|spread\s?sheet|sheet)\b/) ? [{ type: 'EXPORT_PDF' }, other] : [other, { type: 'EXPORT_PDF' }]
    }
    return [other]
  }
  const channel = proposalCommand(c, toks, env)
  if (channel) return [{ type: 'SEND_PROPOSAL', channel }]
  if (/\b(?:e-?mail|mail|send)\b/.test(c)) {
    if (/\b(?:client|customer|guest|him|her|them)\b/.test(c)) return null
    if (/\b(?:me|my|myself|mine|inbox)\b/.test(c) || /^(?:e-?mail|mail|send)(?:\s+(?:it|this|that|the\s+(?:pdf|itinerary|trip|quote|quotation|file)))?$/.test(c)) {
      return [{ type: 'EMAIL_ME' }]
    }
    return null
  }
  if (/\b(?:export|download|print)\b/.test(c) || /\bpdf\b/.test(c)) return [{ type: 'EXPORT_PDF' }]
  // "make the quotation" (no price said — "quote 45000" is a target price).
  if (/\b(?:make|prepare|create|generate|build|give me)\s+(?:the\s+|a\s+|my\s+)?(?:quotation|quote)\b/.test(c) && !/\d/.test(c)) return [{ type: 'EXPORT_PDF' }]
  if (/\bsave\b/.test(c) && toksOf(c).length <= 5) return [{ type: 'SAVE' }]
  return null
}

// "quote 45000 all inclusive", "make the total 45k", "final price should be
// 1.2 lakh", "price it at 15000 per person" → the margin that hits it.
const AMOUNT = String.raw`(?:rs\.?|₹|inr|rupees)?\s*(\d[\d,]*(?:\.\d+)?\s*(?:k|thousand|lakhs?|lacs?|l)?)\b`
const TARGET_RE = new RegExp(
  String.raw`\b(?:quote(?:\s+(?:it|this|the\s+(?:trip|package|client)))?(?:\s+(?:at|for|as))?|price\s+(?:it|this|the\s+(?:trip|package))\s+at|sell\s+(?:it|this)\s+(?:at|for)|make\s+(?:the\s+|it\s+)?(?:total|final\s+price|price|package\s+price|grand\s+total|quote|cost)(?:\s+(?:to|as))?|(?:the\s+)?(?:total|final\s+price|grand\s+total|package\s+price|quoted\s+price|price)\s+(?:should\s+be|to\s+be|must\s+be|will\s+be|is|of|at|=)|(?:set|change|bring|round)\s+(?:the\s+)?(?:total|final\s+price|price|grand\s+total)(?:\s+(?:to|at|down\s+to|up\s+to))?|(?:final\s+(?:price|total|quote|amount|cost)|total\s+(?:price|amount|cost)|package\s+(?:price|cost)|grand\s+total|all\s+inclusive(?:\s+price)?(?:\s+of)?))\s+` + AMOUNT,
)
// "grand mumtaz room rate 5500", "the hotel price is 5000 per night".
function hHotelRate(c, toks, env) {
  if (!/\b(?:rate|price|tariff|cost|charges?)\b|\bper\s+(?:night|room)\b/.test(c)) return null
  if (/\b(?:cab|cabs|car|vehicle|taxi|activity|activities|ticket|tickets|margin|markup|gst|total|quote|quotation|person|head|pax|final|package|overall|budget|inclusive|trip)\b/.test(c)) return null
  const named = stayMentions(toks, env.S).list.length > 0
  if (!named && !/\b(?:hotel|hotels|room|rooms|tariff)\b|\bper\s+(?:night|room)\b/.test(c)) return null
  const amounts = [...c.matchAll(/(?:rs\.?|₹|inr)?\s*(\d[\d,]*(?:\.\d+)?\s*(?:k\b|thousand\b)?)(?!\s*(?:nights?|days?|rooms?|adults?|star|stars|%|percent))/g)]
    .map((m) => parseAmount(m[1]))
    .filter((n) => n >= 300)
  if (!amounts.length) return null
  return scopeStays(toks, env).map((stay) => ({ type: 'SET_HOTEL_RATE', stay, price: amounts[0] }))
}

function hTargetTotal(c, toks, env) {
  if (/\b(?:margin|profit|markup|mark up|gst)\b/.test(c)) return null
  // A hotel's, cab's or ticket's price is not the trip total.
  if (/\b(?:hotel|room|rooms|tariff|cab|car|vehicle|taxi|activity|ticket|bed)\b|\bper\s+(?:night|room|day)\b/.test(c)) return null
  const m = c.match(TARGET_RE)
  if (!m) return null
  let amount = parseAmount(m[1])
  if (!amount) return null
  if (/\bper\s+(?:person|head|pax|adult)\b/.test(c)) amount *= Math.max(1, (env.S.adults || 0) + (env.S.children || 0))
  return [{ type: 'SET_TARGET_TOTAL', amount }]
}

function hMargin(c, toks, env) {
  if (!/\b(?:margin|profit|markup|mark up)\b/.test(c)) return null
  // "make the margin 10000 rupees" / "margin ₹10k": an amount, not 10000%.
  if (!/%|\bpercent\b|\bpc\b|\bby\b/.test(c)) {
    const am = c.match(/(?:rs\.?|₹|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|rs|rupees|inr)?\b/)
    if (am) {
      const amount = parseAmount(am[0].replace(/\b(?:rs|rupees|inr)\b/, ''))
      const money = /₹|\brs\b|\brupees\b|\binr\b/.test(c) || (am[2] && !/^(?:rs|rupees|inr)$/.test(am[2])) || amount > 100
      if (money && amount != null) return [{ type: 'SET_MARGIN_AMOUNT', amount }]
    }
  }
  // The number next to the word ("15% margin", "margin of 15"), never just the
  // first number in a long clause ("… 28th november … 15% margin").
  const near =
    c.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b|pc\b)\s*(?:of\s+)?(?:profit\s+)?(?:margin|markup|mark up|profit)\b/) ||
    c.match(/\b(?:margin|markup|mark up|profit)\s*(?:of|to|at|is|as|=|:|by)?\s*(\d+(?:\.\d+)?)/) ||
    c.match(/(\d+(?:\.\d+)?)\s*(?:of\s+)?(?:profit\s+)?(?:margin|markup|mark up|profit)\b/)
  const m = near || (toksOf(c).length <= 6 ? c.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b|pc\b)?/) : null)
  if (!m) {
    if (/\b(?:remove|no|zero|without)\b/.test(c)) return [{ type: 'SET_MARGIN', percent: 0 }]
    return null
  }
  let pct = +m[1]
  if (/\bby\b/.test(c)) {
    if (/\b(?:increase|raise|add|more|up)\b/.test(c)) pct = env.S.marginPercent + pct
    else if (/\b(?:decrease|reduce|lower|cut|less|down)\b/.test(c)) pct = Math.max(0, env.S.marginPercent - pct)
  }
  return [{ type: 'SET_MARGIN', percent: pct }]
}

function hGst(c) {
  if (!/\bgst\b/.test(c)) return null
  if (/\b(?:remove|no|without|exclude|excluding|don't|dont|drop|minus|off|not)\b/.test(c)) {
    return [{ type: 'SET_GST', include: false, percent: null }]
  }
  const m = c.match(/(\d+(?:\.\d+)?)\s*(?:%|percent\b)?/)
  return [{ type: 'SET_GST', include: true, percent: m ? +m[1] : null }]
}

const NAME_STOP = new Set(['and', 'with', 'for', 'on', 'in', 'at', 'from', 'to', 'the', 'please', 'phone', 'email', 'mobile', 'then'])
function hClientName(c, toks, env) {
  const m =
    c.match(/\b(?:client|customer|guest)(?:'s)?\s+name\s+(?:to|is|as|should be|=)?\s*(.+)$/) ||
    c.match(/\bname\s+(?:to|is|as|should be|=)\s*(.+)$/) ||
    c.match(/^(?:change|update|set|correct)\s+(?:the\s+)?name\s+(.+)$/) ||
    c.match(/\brename\s+(?:the\s+)?(?:client|customer|guest|trip)?\s*(?:to|as)\s+(.+)$/)
  if (!m) return null
  const words = []
  for (const w of toksOf(m[1])) {
    if (NAME_STOP.has(w) || !/^[a-z][a-z'.]*$/.test(w) || words.length >= 4) break
    words.push(w)
  }
  const skip = new Set(['mr', 'mrs', 'ms', 'dr', 'miss', 'shri', 'smt'])
  while (words.length && skip.has(words[0].replace(/\.$/, ''))) words.shift()
  if (!words.length) return null
  env.client.clientName = titleCase(words.join(' ').replace(/\.+$/, ''))
  return [{ type: 'SET_CLIENT', _marker: true }]
}

function scopeStays(toks, env) {
  const { list, warnings } = stayMentions(toks, env.S)
  if (!list.length) return ['all']
  env.warnings.push(...warnings)
  return list.map((h) => h.stay)
}

function hMeals(c, toks, env) {
  let plan = ''
  const neg = c.match(/\b(?:remove|no|without|drop|cancel|exclude|skip)\s+(?:the\s+|all\s+|any\s+)?(breakfast|meals?|food|dinner|lunch)\b/)
  if (neg) {
    plan = neg[1] === 'dinner' ? 'Only Room + Breakfast' : neg[1] === 'lunch' ? 'Breakfast + Dinner' : 'Only Room'
  } else {
    plan = extractMealPlan(c).plan
    if (!plan && /\bdinner\b/.test(c)) plan = 'Breakfast + Dinner'
    if (!plan && /\blunch\b/.test(c)) plan = 'Breakfast + Lunch + Dinner'
  }
  if (!plan) return null
  return scopeStays(toks, env).map((stay) => ({ type: 'SET_MEAL_PLAN', stay, mealPlan: plan }))
}

function hRooms(c, toks, env) {
  const m = c.match(/\b(\d{1,2})\s+(?:more\s+|extra\s+)?rooms?\b/) || c.match(/\brooms?\s*(?:to|=|:|as|is)?\s*(\d{1,2})\b/)
  if (!m) return null
  if (/\b(?:more|extra|additional|another|less|fewer)\b/.test(c)) return null // no room count in context to add to
  const rooms = +m[1]
  if (rooms < 1) return null
  return scopeStays(toks, env).map((stay) => ({ type: 'SET_ROOMS', stay, rooms }))
}

const VEHICLE_WORD = /\b(?:vehicle|vehicles|cab|cabs|car|cars|taxi|transport|transportation|driver)\b/
function vehicleHits(toks, cat) {
  const found = []
  for (const v of cat.vehicles) {
    const pos = []
    v.tokens.forEach((vt) => {
      const i = toks.findIndex((t) => t === vt || t === vt + 's' || (vt.length >= 5 && t.length >= 5 && levRatio(t, vt) >= 0.8))
      if (i >= 0) pos.push(i)
    })
    if (pos.length) found.push({ v, pos: Math.min(...pos), hits: pos.length, ratio: pos.length / v.tokens.length })
  }
  // One spoken phrase may hit several vehicles ("innova" vs "innova crysta"): keep the best per position.
  const byPos = new Map()
  found.forEach((f) => {
    const cur = byPos.get(f.pos)
    if (!cur || f.hits > cur.hits || (f.hits === cur.hits && f.ratio > cur.ratio)) byPos.set(f.pos, f)
  })
  return [...byPos.values()].sort((a, b) => a.pos - b.pos)
}

function hVehicle(c, toks, env) {
  const hits = vehicleHits(toks, env.cat)
  const generic = VEHICLE_WORD.test(c)
  if (!hits.length && (!generic || /\bday\s+\d/.test(c))) return null
  const removeVerb = /\b(?:no|remove|without|drop|cancel|delete|skip)\b|\b(?:don't|dont|do not)\s+need\b/.test(c)
  const setVerb = /\b(?:to|with|use|into|instead|change|switch|swap|replace|book|make|need|want|give)\b/.test(c)
  if (removeVerb && (generic || hits.length) && !/\b(?:to|with|into)\b/.test(c)) return [{ type: 'REMOVE_VEHICLE' }]
  const candidates = hits.filter((h) => {
    const prev = toks.slice(Math.max(0, h.pos - 2), h.pos).join(' ')
    return !/\b(?:from|replace|of)\b/.test(prev)
  })
  if (candidates.length) {
    const pick = candidates[candidates.length - 1].v
    return [{ type: 'SET_VEHICLE', vehicleId: pick.id, vehicleName: pick.name }]
  }
  if (generic && setVerb) {
    const m = c.match(/\b(?:to|with|use|into)\s+(?:an?\s+|the\s+)?([a-z0-9 ]+)$/)
    const what = m ? m[1].replace(VEHICLE_WORD, '').trim() : ''
    if (what) {
      env.warnings.push(`Couldn't find "${what}" in your vehicles`)
      return []
    }
  }
  return null
}

const REMOVE_VERB = /\b(?:remove|delete|drop|cancel|skip|exclude)\b|\b(?:don't|dont|do not)\s+want\b|^no\b/
function hRemoveActivity(c, toks, env) {
  if (!REMOVE_VERB.test(c) || !env.S.activities.length) return null
  const days = daysIn(c)
  const rest = c
    .replace(/\b(?:on|from|in)?\s*(?:the\s+)?day\s+\d{1,2}\b/g, ' ')
    .replace(/\b(?:remove|delete|drop|cancel|skip|exclude|don't|dont|do|not|want|no|the|activity|activities|from|trip|itinerary|plan)\b/g, ' ')
  const heard = normTokens(rest)
  if (!heard.length) return null
  const r = bestMatch(heard, env.S.activities)
  if (!r.confident) return null
  let target = r.best
  if (days.length) {
    const same = env.S.activities.filter((a) => normKey(a.name) === normKey(target.name) && Number(a.dayNumber) === days[0].day)
    if (same.length) target = same[0]
  }
  return [{ type: 'REMOVE_ACTIVITY', index: target.index }]
}

const LEISURE = /\b(?:leisure|free|rest|relax\w*|off|nothing planned)\b/
const PLAN_WORDS = /\b(?:sightseeing|sight seeing|sightseeings|plan|plans|activities|activity|tours?|visits?|excursions?|everything|programm?e?)\b/
function hDays(c, toks, env) {
  const { S } = env
  const days = daysIn(c)
  const moveVerb = /\b(?:move|shift|push|transfer|postpone|prepone)\b/.test(c)
  if (moveVerb) {
    const to = c.match(/\bto\s+day\s+(\d{1,2})\b/)
    if (!to) return null
    const toDay = +to[1]
    const toIdx = to.index + to[0].indexOf('day')
    const other = days.find((d) => d.index !== toIdx)
    let fromDay = other ? other.day : null
    if (fromDay == null) {
      const city = findCity(toks, S, env.cat)
      if (city) fromDay = findDayByCity(city.name, S, { exclude: toDay })
      if (fromDay == null) {
        env.warnings.push(`Couldn't tell which day to move to day ${toDay}`)
        return []
      }
    }
    if (!checkDay(fromDay, S, env.warnings) || !checkDay(toDay, S, env.warnings)) return []
    return [{ type: 'MOVE_DAY_PLAN', fromDay, toDay }]
  }
  const clearVerb = /\b(?:remove|clear|delete|cancel|drop|skip|no|empty)\b/.test(c)
  if (days.length) {
    if (LEISURE.test(c)) {
      return days.filter((d) => checkDay(d.day, S, env.warnings)).map((d) => ({ type: 'SET_DAY_LEISURE', day: d.day }))
    }
    if (clearVerb) {
      const leftover = c
        .replace(/\b(?:on|from|in|of|for)?\s*(?:the\s+)?day\s+\d{1,2}\b/g, ' ')
        .replace(/\b(?:remove|clear|delete|cancel|drop|skip|no|empty|the|all|out|everything)\b/g, ' ')
        .trim()
      if (PLAN_WORDS.test(c) || !leftover) {
        return days.filter((d) => checkDay(d.day, S, env.warnings)).map((d) => ({ type: 'CLEAR_DAY_SIGHTSEEING', day: d.day }))
      }
    }
    return null
  }
  // "remove the pahalgam sightseeing" (no day number)
  if (clearVerb && /\b(?:sightseeing|sight seeing|excursions?|tour)\b/.test(c)) {
    const city = findCity(toks, S, env.cat)
    const day = city ? findDayByCity(city.name, S) : null
    if (day != null) return [{ type: 'CLEAR_DAY_SIGHTSEEING', day }]
  }
  return null
}

function hDate(c, toks, env) {
  if (/\bday\s+\d/.test(c) || /\b\d+\s*(?:nights?|days?)\b/.test(c)) return null
  const d = extractDate(c, env.today)
  if (!d) return null
  env.warnings.push(...d.notes)
  return [{ type: 'SET_START_DATE', date: d.iso }]
}

function parseAddStay(c, nights, env) {
  let m = c.match(/\b\d+\s+(?:more\s+|extra\s+)?nights?\s+(?:stay\s+)?(?:in|at)\s+(.+)$/)
  let place = m ? m[1] : null
  if (!place) {
    m = c.match(/\b(?:add|include)\s+(?:a\s+stay\s+(?:in|at)\s+)?(.+?)\s+for\s+\d+\s+nights?\b/)
    place = m ? m[1] : null
  }
  if (!place) return null
  let after = null
  const pos = place.match(/\s+(after|before)\s+(.+)$/)
  if (pos) {
    place = place.slice(0, pos.index)
    const { list } = stayMentions(toksOf(normKey(pos[2])), env.S)
    if (list.length) {
      after = pos[1] === 'after' ? list[0].stay : list[0].stay - 1
      if (after < 0) {
        env.warnings.push("Can't add a stay before the first one — adding it at the end")
        after = null
      }
    }
  }
  place = place.replace(/\s+(?:at the end|in the end|too|as well|also)$/, '').trim()
  const words = toksOf(place)
  let cityText = words
  let hotelText = []
  const split = words.findIndex((w, i) => i > 0 && (w === 'at' || w === 'in'))
  if (split > 0) {
    const left = words.slice(0, split)
    const right = words.slice(split + 1)
    if (words[split] === 'in' && !cityLookup(left, env.cat) && cityLookup(right, env.cat)) {
      cityText = right
      hotelText = left
    } else {
      cityText = left
      hotelText = right
    }
  }
  let city = cityLookup(cityText, env.cat)
  const action = { type: 'ADD_STAY', hotelId: null, hotelName: '', city: '', nights, after }
  if (!city && !hotelText.length) {
    const asHotel = matchHotel(cityText, '', env.cat)
    if (asHotel.hotel) {
      Object.assign(action, { hotelId: asHotel.hotel.id, hotelName: asHotel.hotel.name, city: asHotel.hotel.city })
      return action
    }
  }
  if (!city) city = titleCase(cityText.filter((w) => w !== 'the').join(' '))
  action.city = city
  if (hotelText.length) {
    const h = matchHotel(hotelText, city, env.cat)
    if (h.hotel) {
      Object.assign(action, { hotelId: h.hotel.id, hotelName: h.hotel.name, city: h.hotel.city || city })
      if (h.hotel.city && !sameCity(h.hotel.city, city)) env.warnings.push(`${h.hotel.name} is in ${h.hotel.city}, not ${city}`)
    } else {
      action.hotelName = titleCase(hotelText.join(' '))
      env.warnings.push(`Couldn't find "${hotelText.join(' ')}" in your hotels — pick one for ${city}`)
    }
  } else {
    env.warnings.push(`No hotel named for the new ${plural(nights, 'night')} in ${city} — pick one`)
  }
  return action
}

function hNights(c, toks, env) {
  const { S } = env
  const actions = []
  let s = c
  // Explicit trip length inside the clause: "6 night trip", "trip of 6 nights", "make it 7 days"
  const tripRe = new RegExp(
    `\\b(\\d{1,2})\\s+(nights?|days?)\\s+(?:long\\s+)?${TRIP_NOUN}\\b|\\b${TRIP_NOUN}\\s+(?:of\\s+|to\\s+|for\\s+)?(\\d{1,2})\\s+(nights?|days?)\\b`,
  )
  let tm = s.match(tripRe)
  const plusWords = /\b(?:more|extra|additional|another|extend|increase|add|plus)\b/
  const minusWords = /\b(?:less|fewer|reduce|cut|shorten|decrease|minus|remove|drop)\b/
  const tripNights = (n, unit, rel) => {
    let nights = /^day/.test(unit) ? n - 1 : n
    if (rel > 0) nights = S.nights + nights
    if (rel < 0) nights = S.nights - nights
    return { type: 'SET_TRIP_NIGHTS', nights: Math.max(1, nights) }
  }
  const relOf = (text) => {
    if (/\bto\s+\d+\s+(?:nights?|days?)\b/.test(text)) return 0
    if (plusWords.test(text) && !/\b(?:less|fewer)\b/.test(text)) return 1
    if (minusWords.test(text)) return -1
    return 0
  }
  if (tm) {
    const n = +(tm[1] || tm[3])
    const unit = tm[2] || tm[4]
    actions.push(tripNights(n, unit, /\bby\b/.test(s) ? relOf(s) : 0))
    s = s.slice(0, tm.index) + ' ' + s.slice(tm.index + tm[0].length)
  }
  s = s.replace(/\b(?:an?\s+)?(?:extra|additional|another)\s+night\b/g, '1 more night')
  const counts = []
  const cre = /\b(\d{1,2})\s+(?:more\s+|extra\s+|additional\s+|less\s+|fewer\s+)?nights?\b/g
  let m
  while ((m = cre.exec(s))) counts.push({ n: +m[1], index: m.index })
  const stoks = toksOf(s)
  const { list: mentions, warnings: mw } = stayMentions(stoks, S)

  if (!counts.length) {
    if (actions.length) return actions
    // "remove pahalgam", "skip pahalgam", "don't go to pahalgam"
    if (/\b(?:remove|skip|drop|delete|cancel|exclude|avoid)\b|\b(?:don't|dont|do not|not)\s+(?:go|going)\s+to\b|^no\b/.test(s) && mentions.length) {
      env.warnings.push(...mw)
      return mentions.map((h) => ({ type: 'REMOVE_STAY', stay: h.stay }))
    }
    // "make the trip 7 days" / "make it 6 days"
    const dm = s.match(/\b(\d{1,2})\s+days?\b/)
    if (dm && !mentions.length && /\b(?:trip|tour|itinerary|package|it|total|whole|entire|overall)\b/.test(s) && !/\bday\s+\d/.test(s)) {
      return [tripNights(+dm[1], 'days', relOf(s))]
    }
    return null
  }

  // New place: "add 2 nights in sonamarg (at hotel x) (after srinagar)" / "add <hotel> for 2 nights"
  if (/\b(?:add|include|plus)\b/.test(s) && !/\b(?:trip|tour|itinerary|package)\b/.test(s)) {
    const pm =
      s.match(/\b\d+\s+(?:more\s+|extra\s+)?nights?\s+(?:stay\s+)?(?:in|at)\s+(.+?)(?:\s+(?:after|before)\s+.+)?$/) ||
      s.match(/\b(?:add|include)\s+(?:a\s+stay\s+(?:in|at)\s+)?(.+?)\s+for\s+\d+\s+nights?\b/)
    if (pm && !stayMentions(toksOf(normKey(pm[1])), S).list.length) {
      const add = parseAddStay(s, counts[0].n, env)
      if (add) return [...actions, add]
    }
  }

  if (!mentions.length) {
    if (/\b(?:trip|tour|itinerary|package|holiday|it|total|overall|whole|entire|altogether|in all)\b/.test(s)) {
      return [...actions, tripNights(counts[0].n, 'nights', relOf(s))]
    }
    return actions.length ? actions : null
  }

  env.warnings.push(...mw)
  const rel = relOf(s)
  const pairs =
    counts.length === mentions.length
      ? mentions.map((h, i) => [h, counts[i].n])
      : mentions.map((h) => [h, counts[0].n])
  if (counts.length > 1 && counts.length !== mentions.length) {
    env.warnings.push('Heard more night counts than places — applied the first one')
  }
  for (const [h, n] of pairs) {
    const st = S.stays.find((x) => x.index === h.stay)
    const nights = rel > 0 ? st.nights + n : rel < 0 ? st.nights - n : n
    if (nights <= 0) {
      env.warnings.push(`${st.city || st.hotelName} would have no nights left — removing that stay`)
      actions.push({ type: 'REMOVE_STAY', stay: h.stay })
    } else {
      actions.push({ type: 'SET_STAY_NIGHTS', stay: h.stay, nights })
    }
  }
  return actions
}

function hHotel(c, toks, env) {
  const { S, cat } = env
  let X = null
  let Y = null
  let m = c.match(/\b(?:replace|swap|switch|change)\s+(?:the\s+)?(.+?)\s+(?:with|by|for|to|into)\s+(?:the\s+)?(.+)$/)
  if (m) [X, Y] = [m[1], m[2]]
  if (!m) {
    m = c.match(/\b(?:use|put|choose|pick|go with|stay at|stay in|book)\s+(?:the\s+)?(.+?)(?:\s+instead\s+of\s+(?:the\s+)?(.+?))?(?:\s+instead)?$/)
    if (m) [Y, X] = [m[1], m[2] || null]
  }
  if (!m) {
    m = c.match(/^(?:the\s+)?(.+?)\s+instead\s+of\s+(?:the\s+)?(.+)$/)
    if (m) [Y, X] = [m[1], m[2]]
  }
  if (!m || !Y) return null
  Y = Y.replace(/\s+instead$/, '').trim()
  let cityHint = ''
  const ym = Y.match(/^(.+?)\s+(?:in|for|at)\s+(?:the\s+)?(.+)$/)
  if (ym) {
    const cityWords = toksOf(ym[2]).filter((w) => !['hotel', 'stay', 'hotels'].includes(w))
    const city = cityLookup(cityWords, cat) || (S.stays.find((s) => sameCity(s.city, cityWords.join(' ')))?.city ?? '')
    if (city) {
      cityHint = city
      Y = ym[1]
    }
  }
  // Which stay?
  let targets = []
  if (X) {
    const { list, warnings } = stayMentions(toksOf(normKey(X)), S)
    targets = list.map((h) => h.stay)
    env.warnings.push(...warnings)
  }
  if (!targets.length && cityHint) {
    const hs = S.stays.filter((s) => sameCity(s.city, cityHint))
    if (hs.length) targets = [hs[0].index]
    if (hs.length > 1) env.warnings.push(`${cityHint} has ${hs.length} stays — using the first one`)
  }
  const targetStay = targets.length ? S.stays.find((s) => s.index === targets[0]) : null
  const h = matchHotel(toksOf(Y), targetStay?.city || cityHint || '', cat)
  if (!h.hotel) {
    if (!targetStay) return null
    env.warnings.push(`Couldn't find "${Y}" in your hotels`)
    return []
  }
  let stay = targetStay
  if (!stay) {
    const hs = S.stays.filter((s) => sameCity(s.city, h.hotel.city))
    if (!hs.length) {
      if (X) return null
      env.warnings.push(`${h.hotel.name} is in ${h.hotel.city || 'another city'} — there's no stay there to replace`)
      return []
    }
    if (hs.length > 1) env.warnings.push(`${h.hotel.city} has ${hs.length} stays — using the first one`)
    stay = hs[0]
  }
  if (String(stay.hotelId) === String(h.hotel.id)) {
    env.warnings.push(`${stay.city || 'That stay'} is already at ${h.hotel.name}`)
    return []
  }
  if (h.hotel.city && stay.city && !sameCity(h.hotel.city, stay.city)) {
    env.warnings.push(`${h.hotel.name} is in ${h.hotel.city}, not ${stay.city}`)
  }
  return [{ type: 'REPLACE_HOTEL', stay: stay.index, hotelId: h.hotel.id, hotelName: h.hotel.name, city: h.hotel.city || stay.city }]
}

function hAddActivity(c, toks, env) {
  const { S, cat } = env
  const vm = c.match(/^(?:also\s+)?(?:add|include|book|put|schedule|plus)\s+(.+)$/)
  if (!vm) return null
  // "add shikara on day 2 and gondola phase 2 on day 3": one activity per day.
  const parts = vm[1].split(/(?<=\bday\s+\d{1,2})\s+(?:and|&|also|plus)\s+(?:also\s+)?/)
  if (parts.length > 1) {
    const out = []
    for (const p of parts) {
      const one = hAddActivity(`add ${p}`, toksOf(`add ${p}`), env)
      if (!one) return null
      out.push(...one)
    }
    return out
  }
  // "add shikara ride and pony ride": both are catalog activities.
  const pair = vm[1].split(/\s+(?:and|&)\s+(?:also\s+|a\s+|the\s+)?/)
  if (pair.length > 1 && pair.every((p) => !/^\d/.test(p))) {
    const out = []
    for (const p of pair) {
      const one = hAddActivity(`add ${p}`, toksOf(`add ${p}`), env)
      if (!one || !one.every((x) => x.type === 'ADD_ACTIVITY')) {
        out.length = 0
        break
      }
      out.push(...one)
    }
    if (out.length) return out
  }
  let rest = vm[1]
  let day = null
  let persons = null
  let location = null
  const dm = rest.match(/\s*\b(?:on|to|for|in|into)?\s*(?:the\s+)?day\s+(\d{1,2})\b/)
  if (dm) {
    day = +dm[1]
    rest = rest.slice(0, dm.index) + ' ' + rest.slice(dm.index + dm[0].length)
  }
  // "for 2 adults and 1 child": children get the child rate.
  let children = null
  const cm = rest.match(/\s*\b(?:and\s+|plus\s+|with\s+)?(\d{1,2})\s+(?:children|child|childs|kids?)\b/)
  if (cm) {
    children = +cm[1]
    rest = rest.slice(0, cm.index) + ' ' + rest.slice(cm.index + cm[0].length)
  }
  const pm =
    rest.match(/\bfor\s+(\d{1,3})\s+(?:people|persons?|pax|guests?|adults?|tickets?|members|of us)\b/) ||
    rest.match(/\b(\d{1,3})\s+(?:tickets?|adults?)\b/)
  if (pm) {
    persons = +pm[1]
    rest = rest.slice(0, pm.index) + ' ' + rest.slice(pm.index + pm[0].length)
  }
  rest = rest.replace(/\bfor\s+(?:everyone|all|all of us)\b/, ' ')
  const lm = rest.match(/\s+(?:in|at)\s+([a-z ]+?)\s*$/)
  if (lm) {
    const city = cityLookup(toksOf(lm[1]), cat) || S.stays.find((s) => sameCity(s.city, lm[1]))?.city
    if (city) {
      location = city
      rest = rest.slice(0, lm.index)
    }
  }
  rest = rest
    .replace(/\b(?:to|in|into)\s+the\s+(?:trip|itinerary|plan)\b/g, ' ')
    .replace(/\s+(?:activity|activities|too|also|as well)\s*$/g, ' ')
    .replace(/^\s*(?:an?|the|some)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!rest) return null
  if (/\b(?:nights?|adults?|child|children|kids?|infants?|babies|baby|rooms?|breakfast|dinner|lunch|meals?|gst|margin|vehicle|cab|car|stay)\b/.test(rest)) {
    return null
  }
  if (day != null && !checkDay(day, S, env.warnings)) return []
  const heard = normTokens(rest)
  let r = { confident: false }
  if (location) {
    const pool = cat.activities.filter((a) => sameCity(a.location, location))
    if (pool.length) r = bestMatch(heard, pool)
  }
  if (!r.confident && cat.activities.length) r = bestMatch(heard, cat.activities)
  if (r.confident) {
    const a = r.best
    // A rate option said with it ("gondola phase 2") picks that rate row.
    const said = ` ${normTokens(rest).join(' ')} `
    const option = (a.raw?.price_sections || [])
      .map((s) => String(s.option || '').trim())
      .find((o) => o && said.includes(` ${normTokens(o).join(' ')} `)) || null
    return [{
      type: 'ADD_ACTIVITY', day, activityId: a.id, name: a.name,
      location: a.location || location || null, persons,
      ...(children != null ? { children } : {}),
      ...(option ? { option } : {}),
    }]
  }
  if (day == null && location) {
    day = findDayByCity(location, S)
    if (day == null) return null
  }
  if (day == null) return null
  return [{ type: 'ADD_DAY_ITEM', day, text: titleCase(rest) }]
}

const GUEST_TYPES = [
  ['adults', '(?:adults?|elders?|seniors?|grown\\s*ups?|men|women)'],
  ['children', '(?:children|child|childs|kids?)'],
  ['infants', '(?:infants?|babies|baby|toddlers?)'],
  ['total', '(?:guests?|people|persons?|pax|travell?ers?|members)'],
]
function hGuests(c, toks, env) {
  const { S } = env
  const out = {}
  const clauseRel = /^(?:add|plus|increase)\b/.test(c) ? 1 : /^(?:remove|reduce|minus|decrease)\b/.test(c) ? -1 : 0
  for (const [key, word] of GUEST_TYPES) {
    let m = c.match(
      new RegExp(`\\b(?:(add|plus|remove|minus)\\s+)?(?:an?\\s+)?(\\d{1,2})\\s+(more\\s+|extra\\s+|additional\\s+|less\\s+|fewer\\s+)?${word}(\\s+(?:more|less|extra))?\\b`),
    )
    if (m) {
      const n = +m[2]
      const cue = `${m[1] || ''} ${m[3] || ''} ${m[4] || ''}`
      let rel = /\b(?:add|plus|more|extra|additional)\b/.test(cue) ? 1 : /\b(?:remove|minus|less|fewer)\b/.test(cue) ? -1 : clauseRel
      out[key] = { n, rel }
      continue
    }
    m = c.match(new RegExp(`\\b(?:number\\s+of\\s+)?${word}\\s*(?:to|=|:|is|as)?\\s*(\\d{1,2})\\b`))
    if (m) {
      out[key] = { n: +m[1], rel: 0 }
      continue
    }
    if (key !== 'total' && key !== 'adults' && new RegExp(`\\b(?:no|without|remove\\s+(?:the\\s+|all\\s+)?)\\s*${word}\\b`).test(c)) {
      out[key] = { n: 0, rel: 0 }
    }
  }
  if (!Object.keys(out).length) return null
  const val = (key, cur) => {
    const o = out[key]
    if (!o) return null
    const v = o.rel > 0 ? cur + o.n : o.rel < 0 ? cur - o.n : o.n
    return Math.max(0, v)
  }
  const action = {
    type: 'SET_GUESTS',
    adults: val('adults', S.adults),
    children: val('children', S.children),
    infants: val('infants', S.infants),
  }
  if (out.total && action.adults == null) {
    const total = val('total', S.adults + S.children + S.infants)
    action.adults = Math.max(1, total - (action.children ?? S.children) - (action.infants ?? S.infants))
  }
  if (action.adults != null && action.adults < 1) {
    env.warnings.push('At least 1 adult is needed — keeping 1')
    action.adults = 1
  }
  return [action]
}

// "add airport pickup to inclusions", "flights are not included", "standard exclusions".
function hInclusions(c) {
  // "add airport pickup to inclusions and flights are not included" → two edits.
  const parts = c.split(/\s+and\s+(?=(?:also\s+)?(?:add|remove|move|put|include|exclude|[a-z ]+?\s+(?:is|are)\s+(?:not\s+)?(?:included|excluded)\b))/)
  if (parts.length > 1) {
    const acts = parts.map((p) => parseInclusionClause(p))
    if (acts.every(Boolean)) return acts.flat()
  }
  return parseInclusionClause(c)
}

const HANDLERS = [
  hInclusions, hCommands, hHotelRate, hTargetTotal, hMargin, hGst, hClientName, hMeals, hRooms, hVehicle, hRemoveActivity, hDays, hDate, hNights, hHotel,
  hAddActivity, hGuests,
]

// ---------- clause splitting ----------

function splitClauses(s) {
  const toks = s
    .replace(/(\d)\.(\d)/g, '$1․$2') // protect decimals
    .replace(/[,;!?]+|\.(?=\s|$)/g, ' | ')
    .replace(/․/g, '.')
    .split(/\s+/)
    .filter(Boolean)
  const clauses = []
  let cur = []
  const flush = () => {
    if (cur.length) clauses.push(cur.join(' '))
    cur = []
  }
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const nx = toks[i + 1] || ''
    const nx2 = toks[i + 2] || ''
    if (t === '|') {
      flush()
      continue
    }
    if (t === 'then' || (t === 'and' && nx === 'then')) {
      flush()
      if (t === 'and') i++
      continue
    }
    if (t === 'and' || t === 'also' || t === 'plus') {
      const splitsHere =
        SPLIT_VERBS.has(nx) ||
        nx === 'also' ||
        (nx === 'day' && /^\d/.test(nx2)) ||
        (/^\d+$/.test(nx) && /^(?:nights?|more|extra)$/.test(nx2)) ||
        /^(?:make|give|no)$/.test(nx)
      if (splitsHere && t !== 'plus') {
        flush()
        continue
      }
    }
    if (SPLIT_VERBS.has(t) && cur.length && !NO_SPLIT_PREV.has(cur[cur.length - 1])) flush()
    // Speech has no commas: "add gondola on day 3 margin 15 percent" — a
    // margin/GST clause starts at its noun unless a word leads into it
    // ("set margin", "with gst", "no margin", "the margin").
    if (SPLIT_NOUNS.has(t) && cur.length) {
      const prev = cur[cur.length - 1]
      // "margin 12% gst 18%", "margin 20 percent no gst": one noun per clause.
      if (cur.some((w) => SPLIT_NOUNS.has(w))) {
        const carry = []
        // "… margin 20% 5% gst": the number right before belongs to this noun
        // unless it follows the earlier noun directly ("margin 12% gst").
        if ((CARRY_LEAD.has(prev) || /^\d/.test(prev)) && cur.length >= 2 && !SPLIT_NOUNS.has(cur[cur.length - 2])) carry.push(cur.pop())
        else if (CARRY_LEAD.has(prev)) carry.push(cur.pop())
        flush()
        cur.push(...carry)
      } else if (!NOUN_LEAD.has(prev) && !SPLIT_VERBS.has(prev) && !/^\d/.test(prev)) {
        flush()
      } else if (/^\d+$/.test(prev) && /^\d/.test(/^(?:of|to|at|is|=)$/.test(nx) ? nx2 : nx)) {
        // "… on day 3 margin 15 percent": the margin has its own number, so
        // the bare 3 before it belongs to the clause before.
        flush()
      } else if (CARRY_LEAD.has(prev) && cur.length >= 2 && !NOUN_LEAD.has(cur[cur.length - 2]) && !SPLIT_VERBS.has(cur[cur.length - 2])) {
        // "… with innova no gst": "no gst" is its own clause.
        cur.pop()
        flush()
        cur.push(prev)
      }
    }
    cur.push(t)
  }
  flush()
  return clauses
}

function cleanClause(c) {
  return c.replace(LEAD_FILLER, '').replace(TRAIL_FILLER, '').trim()
}

/**
 * Parse an edit utterance against the open trip. `force` skips the new-trip
 * check (used to pick extras like activities/margin out of a full trip request).
 * @returns {{ intent: 'edit'|'create'|'unknown', actions: object[], unrecognized: string[], warnings: string[] }}
 */
export function parseChingEdit(text, context, catalog, { today, force = false } = {}) {
  const result = { intent: 'unknown', actions: [], unrecognized: [], warnings: [] }
  let s = normalizeSpeech(text)
  if (!s) return result
  if (!force && isCreateRequest(s)) return { ...result, intent: 'create' }

  const cat = prepareEditCatalog(catalog)
  const S = prepareContext(context, cat)
  const env = { S, cat, today: toLocalMidnight(today), warnings: result.warnings, client: { clientName: null, clientPhone: null, clientEmail: null } }

  // Contact details are pulled out of the whole utterance first (they contain dots / digits).
  const RESIDUE =
    /(?:\b(?:change|update|set|add|and|also)\s+)?(?:\b(?:the|his|her|their)\s+)?(?:\b(?:client|customer|guest)(?:'s)?\s+)?(?:\b(?:e-?mail|mail|phone|mobile|contact|whatsapp|cell)(?:\s+(?:id|address|number|no))?\s*)?(?:\b(?:is|to|as)\s*|:\s*)?\|/
  const em = extractEmail(s)
  if (em.email) {
    env.client.clientEmail = em.email
    s = em.s.replace(RESIDUE, ' , ')
  }
  s = s
    .replace(/\bg\s*\.?\s*s\s*\.?\s*t\b\.?/g, 'gst')
    .replace(/\bper\s+cent\b/g, 'percent')
    .replace(/\b(?:whats|what's|what|wats|watts)\s*app\b|\bwhatsapp?\b|\bwatsapp\b/g, 'whatsapp')
    .replace(/([a-z])-(?=[a-z])/g, '$1 ')
    .replace(/(\d)-(?=[a-z])/g, '$1 ')
    // "45,000" / "1,20,000" are one number, not two clauses ("days 2,3" stay apart).
    .replace(/(\d),(?=\d{2},\d{3}\b)/g, '$1')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
  s = normalizeTripWords(convertNumberWords(s))
  const ph = extractPhone(s)
  if (ph.phone) {
    env.client.clientPhone = ph.phone
    s = ph.s.replace(RESIDUE, ' , ')
  }
  // Day references: "third day" / "3rd day" / "day 2's" / "last day" -> "day N"
  s = s
    .replace(new RegExp(`\\b(${Object.keys(ORD_DAY).join('|')})\\s+day\\b`, 'g'), (m, w) => `day ${ORD_DAY[w]}`)
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\s+day\b/g, 'day $1')
    .replace(/\bday\s+(?:no\.?|number)\s+(\d)/g, 'day $1')
    .replace(/\bday\s+(\d{1,2})(?:'s|s)\b/g, 'day $1')
    .replace(/\blast\s+day\b/g, S.days.length ? `day ${S.days.length}` : 'last day')
    .replace(/\s+/g, ' ')

  let handled = false
  // A day-by-day route ("day 3 Gulmarg to Pahalgam", "day 6 departure") → one
  // SET_DAY_ROUTES action; its clauses are removed so other handlers skip them.
  const dayRoutes = parseDayPlan(s, (w) => cityLookup(w, cat), { minMarkers: 1, edit: true })
  if (dayRoutes) {
    result.actions.push({ type: 'SET_DAY_ROUTES', entries: dayRoutes.entries })
    s = withoutClaimed(s, dayRoutes.claimed)
    handled = true
  }
  for (const raw of splitClauses(s)) {
    const c = cleanClause(raw)
    if (NOISE.test(c)) continue
    // Questions ("is breakfast included in gulmarg?") are never turned into edits.
    if (/^(?:what|what's|whats|how|why|when|which|who|where|is|are|does|did|was|were|will|should)\b/.test(c)) {
      result.unrecognized.push(c)
      continue
    }
    const toks = toksOf(c)
    let acts = null
    for (const h of HANDLERS) {
      acts = h(c, toks, env)
      if (acts) break
    }
    if (acts) {
      handled = true
      result.actions.push(...acts)
    } else {
      result.unrecognized.push(c)
    }
  }

  // One SET_CLIENT carrying everything heard about the client.
  const { clientName, clientPhone, clientEmail } = env.client
  if (clientName || clientPhone || clientEmail) {
    handled = true
    const merged = { type: 'SET_CLIENT', clientName, clientPhone, clientEmail }
    const at = result.actions.findIndex((a) => a.type === 'SET_CLIENT')
    result.actions = result.actions.filter((a) => a.type !== 'SET_CLIENT')
    if (at >= 0) result.actions.splice(Math.min(at, result.actions.length), 0, merged)
    else result.actions.push(merged)
  }

  // Order: edits as spoken, but a trip-length change goes after the per-stay night changes it
  // must respect, and export/email/save commands run last.
  let edits = result.actions.filter((a) => !COMMAND_TYPES.has(a.type))
  const cmds = result.actions.filter((a) => COMMAND_TYPES.has(a.type))
  const trips = edits.filter((a) => a.type === 'SET_TRIP_NIGHTS')
  let lastStay = -1
  edits.forEach((a, i) => {
    if (STAY_STRUCTURE.has(a.type)) lastStay = i
  })
  if (trips.length && lastStay >= 0) {
    const firstTrip = edits.indexOf(trips[0])
    if (firstTrip < lastStay) {
      edits = edits.filter((a) => a.type !== 'SET_TRIP_NIGHTS')
      let insertAt = -1
      edits.forEach((a, i) => {
        if (STAY_STRUCTURE.has(a.type)) insertAt = i
      })
      edits.splice(insertAt + 1, 0, ...trips)
    }
  }
  result.actions = [...edits, ...cmds]
  if (handled || result.actions.length) result.intent = 'edit'
  return result
}
