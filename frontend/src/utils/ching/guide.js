// Ching's guided trip: an interview that builds a new trip the way an agent
// would by hand — Trip Info first (one field at a time), then the Itinerary
// (where the guests are on day 1, day 2, …, picked from the agency's own
// destinations), then Logistics through the real Add Accommodation / Add
// Transport forms. Nothing is invented: a field Ching wasn't told stays empty
// and gets asked, hotels and cabs are only the ones the agent names, and the
// saved trip is only what the agent confirmed.
//
// Pure: no React, no network. The widget feeds each utterance to guideStep()
// and runs the returned ops against the open Trip Builder (editorBridge):
//   { op: 'tab', tab }                              switch tab
//   { op: 'patch', tripInfo?, includeGST?, inclusions?, exclusions? }
//   { op: 'day', day, destinationId, name, title, location }   Itinerary picker
//   { op: 'hotelForm', form } / { op: 'cabForm', form }         open + fill a form
//   { op: 'closeForms' }
//   { op: 'apply', actions }                        ADD_HOTEL / ADD_CAB (editTrip.js)
//   { op: 'command', type }                         SAVE / EXPORT_PDF
//   { op: 'discard' }                               throw the unsaved draft away
// ctx = { snapshot, catalog (builder/init: destinations, hotels, vehicles,
//         policies), today ('YYYY-MM-DD'), plan(actions) → { snapshot } }

import { parseChingCommand, extractEmail, extractPhone, formatPhone, matchHotel, prepareCatalog, extractMealPlan, MEAL_PLANS } from './parseCommand.js'
import { extractDate } from './dates.js'
import { convertNumberWords, normalizeTripWords, titleCase } from './text.js'
import { isRoadCab, addDays } from './buildTrip.js'
import { normTokens, levRatio, bestMatch } from './fuzzy.js'
import { samePlace, placeKey } from './places.js'
import { readNights, fixDurationText } from './duration.js'

// ── words ───────────────────────────────────────────────────────────────────
const clean = (t) =>
  normalizeTripWords(convertNumberWords(String(t || '').toLowerCase().replace(/[‘’]/g, "'")))
    .replace(/[?!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const YES = /^(?:yes|yeah|yep|yup|sure|ok|okay|haan|han|ji|ji haan|correct|right|please|go ahead|do it|of course|sounds good|fine)\b/
const NO = /^(?:no|nope|nah|not really|nahi|na|negative)\b/
const SKIP = /^(?:skip|skip it|skip this|pass|next|later|leave it|not now|don't have|dont have|don't know|dont know|no idea|none|nothing|n\/a|na)\b/
const BACK = /^(?:go back|back|previous|undo that|last question)\b/
const REPEAT = /^(?:repeat|again|say (?:that|it) again|what|pardon|sorry what|come again)\??$/
const STOP = /^(?:stop|cancel|exit|quit|end|abort)(?:\s+(?:it|this|the trip|the guide|creating|now))?$/
const SAVE = /^(?:save|save it|yes save|save the (?:trip|hotel|cab|car)|confirm|done|ok save|looks good|that's it|thats it|perfect)\b/
const HONORIFIC = /^(?:mr|mrs|ms|miss|mister|dr|sir|madam|janab|shri|smt)\.?$/i
const first = (name) => String(name || '').trim().split(/\s+/).filter((w) => !HONORIFIC.test(w))[0] || 'the client'
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const fmtRange = (a, b) => `${fmtDate(a)} – ${fmtDate(b)}`
const listOr = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
const listAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const numIn = (t) => {
  const m = clean(t).match(/\b(\d{1,3})\b/)
  return m ? Number(m[1]) : null
}

// ── Trip Info, one field at a time (the order of the Trip Info tab) ─────────
const INFO = [
  'clientName', 'clientPhone', 'clientEmail', 'adults', 'kids', 'startDate', 'nights',
  'destination', 'tripTitle', 'template', 'gst', 'travel', 'inclusions', 'exclusions',
]
function infoQuestion(key, st) {
  const who = first(st.v.clientName)
  switch (key) {
    case 'clientName': return "Let's build it together. Who is the trip for? Tell me the client's name."
    case 'clientPhone': return `What's ${who}'s phone number? (say "skip" if you don't have it)`
    case 'clientEmail': return `And ${who}'s email? (or "skip")`
    case 'adults': return 'How many adults are travelling?'
    case 'kids': return 'Any kids? Say how many, or "no kids".'
    case 'startDate': return 'When does the trip start?'
    case 'nights': return 'How many nights?'
    case 'destination': return 'What destination should the trip show — for example "Kashmir", or "Srinagar and Gulmarg"?'
    case 'tripTitle': {
      const s = suggestTitle(st)
      return s ? `What should I call the trip? Say a title, or "yes" for "${s}".` : 'What should I call the trip?'
    }
    case 'template': return 'Which template — Modern Elegant or Classic Professional?'
    case 'gst': return 'Include GST in the quote — yes or no?'
    case 'travel': return 'Are you arranging a flight, bus or train for them — yes or no?'
    case 'inclusions': return 'What is included? Say the items, "standard" for your saved list, or "none".'
    case 'exclusions': return 'And what is not included? Items, "standard", or "none".'
    default: return ''
  }
}
const suggestTitle = (st) => {
  const n = Number(st.v.nights)
  return st.v.destination && n > 0 ? `${st.v.destination} ${n}N/${n + 1}D` : ''
}

// What a whole sentence says, for the fields not answered yet ("Shah, 4 adults
// and 3 kids from 18 February for 5 nights"). Only what was actually heard.
function heard(text, ctx) {
  const cmd = parseChingCommand(text, ctx.catalog || {}, { today: ctx.today })
  const missing = new Set(cmd.missing || [])
  const out = {}
  if (cmd.clientName) out.clientName = cmd.clientName
  if (cmd.clientPhone) out.clientPhone = cmd.clientPhone
  if (cmd.clientEmail) out.clientEmail = cmd.clientEmail
  if (!missing.has('adults')) {
    out.adults = cmd.adults
    if (cmd.children || cmd.infants || /\b(?:kids?|child|children|infants?|bab(?:y|ies))\b/.test(clean(text))) {
      out.kids = cmd.children || 0
      out.infants = cmd.infants || 0
    }
  }
  if (cmd.startDate) out.startDate = cmd.startDate
  if (cmd.nights > 0) out.nights = cmd.nights
  const stays = (cmd.stays || []).filter((s) => s.city && s.nights > 0)
  if (stays.length) out.stays = stays
  return out
}

// A client name as it was said: "client name is Mr Bilal" → "Mr Bilal".
function readName(t) {
  const name = String(t || '')
    .toLowerCase()
    .replace(/^(?:the\s+)?(?:client|guest|customer)(?:'s)?\s*(?:name)?\s*(?:is|:)?\s*/, '')
    .replace(/^(?:name is|it'?s|its|his name is|her name is|he is|she is|this is)\s+/, '')
    .replace(/[^a-z\s'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.split(' ').length > 5) return null
  const words = name.split(' ')
  if (words.every((w) => HONORIFIC.test(w))) return null
  return titleCase(words.map((w) => (HONORIFIC.test(w) ? w.replace(/\.$/, '') : w)).join(' '))
}

// Which Trip Info field a sentence names ("correct the title", "client name …").
const FIELD_WORDS = [
  ['adults', /\badults?\b/],
  ['kids', /\b(?:kids?|child|children)\b/],
  ['clientEmail', /\b(?:e-?mail|mail id|mail)\b/],
  ['clientPhone', /\b(?:phone|mobile|contact|whatsapp|number)\b/],
  ['tripTitle', /\b(?:title|trip name|heading)\b/],
  ['clientName', /\b(?:name|client|guest|customer)\b/],
  ['startDate', /\b(?:date|start|starting|arrival)\b/],
  ['nights', /\b(?:nights?|duration|days?)\b/],
  ['destination', /\bdestination\b/],
  ['template', /\btemplate\b/],
  ['gst', /\bgst\b/],
  ['inclusions', /\binclusions?\b/],
  ['exclusions', /\bexclusions?\b/],
]
const fieldNamed = (t) => FIELD_WORDS.find(([, re]) => re.test(t))?.[0] || null
const FIELD_LABEL = {
  clientName: 'client name', clientPhone: 'phone', clientEmail: 'email', adults: 'adults', kids: 'kids',
  startDate: 'start date', nights: 'nights', destination: 'destination', tripTitle: 'title', template: 'template',
  gst: 'GST', travel: 'travel', inclusions: 'inclusions', exclusions: 'exclusions',
}

// "correct it", "that's wrong", "fix the title", "galat hai", "no, it's Bilal".
const CORRECT_LEAD =
  /^(?:no[,.!]?\s+)?(?:please\s+|ching\s+)?(?:(?:correct|fix|sudhar|sudhaar|theek|thik|sahi)\s+(?:karo|kar do|kijiye|it|that|this|ye|isko|the\s+[a-z ]+?)|sudharo|sudhaaro|change\s+(?:it|that|this|the\s+(?:title|name|client name|phone|number|email|nights|date|start date|destination|adults|kids|trip name))|(?:that'?s|that is|it'?s|its|this is|ye|yeh)\s+(?:wrong|incorrect|not right|not correct|galat(?:\s+hai)?)|wrong|incorrect|galat(?:\s+hai)?|not correct|that'?s not right)\b[\s,.!:-]*/i
const CORRECT_NO_IS = /^(?:no|nahi|nope)[,.!]?\s+(?:it'?s|its|it is|it should be|make it|the [a-z ]+? (?:is|should be))\s+/i

/** The correction in a sentence: { key?, value } — or null when it isn't one. */
function readCorrection(text) {
  const raw = String(text || '').trim()
  const low = raw.toLowerCase()
  let rest = null
  let soft = false
  if (CORRECT_NO_IS.test(low)) {
    rest = raw.replace(CORRECT_NO_IS, '')
    soft = true
  }
  else if (CORRECT_LEAD.test(low)) rest = raw.replace(CORRECT_LEAD, '')
  else return null
  const key = fieldNamed(low.slice(0, low.length - rest.length)) || null
  // "… the title to X", "… it, it should be X", "… nights: 4"
  const value = rest
    .replace(/^(?:the\s+)?(?:client\s+name|trip\s+title|trip\s+name|title|name|phone(?:\s+number)?|number|email|nights|start\s+date|date|destination|adults|kids)\b\s*/i, '')
    .replace(/^(?:to|as|into|is|should be|it should be|it'?s|its|make it|=|:|,)\s*/i, '')
    .replace(/^(?:to|as|is|it'?s)\s+/i, '')
    .trim()
  const named = rest.match(/^(?:the\s+)?(client\s+name|trip\s+title|title|name|phone|number|email|nights|start\s+date|date|destination|adults|kids)\b/i)
  return { key: key || (named ? fieldNamed(named[1].toLowerCase()) : null), value, soft }
}

/** "correct it" with nothing else said: mend the field the way it was most likely meant. */
function autoRepair(key, st) {
  const v = st.v[key]
  const raw = st.raw?.[key] || ''
  const n = Number(st.v.nights) || null
  if (key === 'tripTitle' && v) {
    const fixed = fixDurationText(v, n)
    return fixed !== v ? { tripTitle: fixed } : null
  }
  if (key === 'nights') {
    const r = readNights(clean(raw))
    return r && r !== v && r <= 60 ? { nights: r } : null
  }
  if (key === 'clientName' && raw) {
    const r = readName(clean(raw))
    return r && r !== v ? { clientName: r } : null
  }
  if (key === 'clientPhone' && raw) {
    const digits = raw.replace(/[^\d+]/g, '')
    const p = extractPhone(digits).phone
    return p && p !== v ? { clientPhone: p } : null
  }
  if (key === 'clientEmail' && raw) {
    const e = extractEmail(`email ${clean(raw).replace(/^(?:e-?mail|mail)\s+/, '')}`).email
    return e && e !== v ? { clientEmail: e } : null
  }
  return null
}

const valueSaid = (key, vals) => {
  const v = vals[key === 'gst' ? 'includeGST' : key]
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none'
  if (key === 'gst') return v ? 'included' : 'not included'
  if (key === 'nights') return `${v} night${v === 1 ? '' : 's'}`
  if (key === 'startDate') return fmtDate(v)
  if (key === 'template') return v === 'ClassicTemplate' ? 'Classic Professional' : 'Modern Elegant'
  return `"${v}"`
}

function infoAnswer(key, text, ctx, st) {
  const t = clean(text)
  if (SKIP.test(t) && key !== 'kids') return { skip: true }
  switch (key) {
    case 'clientName': {
      const name = readName(t)
      return name ? { clientName: name } : null
    }
    case 'clientPhone': {
      const p = extractPhone(t).phone
      return p && p.replace(/\D/g, '').length >= 8 ? { clientPhone: p } : null
    }
    case 'clientEmail': {
      const e = extractEmail(/\b(?:e-?mail|mail)\b/.test(t) ? t : `email ${t}`).email
      return e ? { clientEmail: e } : null
    }
    case 'adults': {
      const n = numIn(t)
      if (n == null) return null
      const h = heard(text, ctx)
      return { adults: n, ...(h.kids != null ? { kids: h.kids, infants: h.infants } : {}) }
    }
    case 'kids': {
      if (/^(?:no|none|zero|nil|no kids|no children|only adults|just adults|skip)\b/.test(t)) return { kids: 0, infants: 0 }
      const h = heard(`2 adults ${/\b(?:kids?|child|children|infants?)\b/.test(t) ? t : `${t} kids`}`, ctx)
      if (h.kids == null && numIn(t) == null) return null
      return { kids: h.kids ?? numIn(t), infants: h.infants || 0 }
    }
    case 'startDate': {
      const d = extractDate(t, ctx.today)
      return d ? { startDate: d.iso } : null
    }
    case 'nights': {
      // "4", "4 nights", "5 days", "4N 5D" — and "495", how "4N 5D" is often heard.
      const n = readNights(t) ?? (t.match(/^(\d{1,2})\b/) ? Number(t.match(/^(\d{1,2})\b/)[1]) : null)
      return n >= 1 && n <= 60 ? { nights: n } : null
    }
    case 'destination': {
      const places = placesIn(t, ctx)
      if (places.length) return { destination: places.map((p) => p.name).join(' - '), destinationId: places.length === 1 ? places[0].id : null }
      const words = t.replace(/^(?:it'?s|the destination is|destination is|to)\s+/, '').trim()
      return words ? { destination: titleCase(words) } : null
    }
    case 'tripTitle': {
      const s = suggestTitle(st)
      if ((YES.test(t) || /\b(?:you choose|you decide|suggest|your choice|that one|use that|any)\b/.test(t)) && s) return { tripTitle: s }
      const said = String(text || '').trim().replace(/^(?:call it|name it|title is|the title is|trip title is|it'?s)\s+/i, '')
      // "Kashmir four N five D" / "Kashmir 495" → "Kashmir 4N/5D"; other words stay as said.
      const words = convertNumberWords(said)
      const fixed = fixDurationText(words, Number(st.v.nights) || null)
      const raw = fixed !== words.replace(/\s+/g, ' ').trim() ? fixed : said
      return raw ? { tripTitle: raw.charAt(0).toUpperCase() + raw.slice(1) } : null
    }
    case 'template':
      if (/\b(?:modern|elegant|first)\b/.test(t)) return { template: 'ModernTemplate' }
      if (/\b(?:classic|professional|second)\b/.test(t)) return { template: 'ClassicTemplate' }
      return null
    case 'gst':
      if (/\b(?:no|without|exclude|don't|dont|nahi)\b/.test(t)) return { includeGST: false }
      if (YES.test(t) || /\b(?:include|with)\b/.test(t)) return { includeGST: true }
      return null
    case 'travel':
      if (NO.test(t) || /\b(?:own|by road|by car|not)\b/.test(t)) return { useFlight: false }
      if (YES.test(t) || /\b(?:flight|bus|train|plane)\b/.test(t)) return { useFlight: true }
      return null
    case 'inclusions':
    case 'exclusions': {
      if (/^(?:no|none|nothing|skip|empty)\b/.test(t)) return { [key]: [] }
      if (/\b(?:standard|default|usual|saved|same as always|normal)\b/.test(t)) {
        const p = ctx.catalog?.policies || {}
        const listKey = key === 'inclusions' ? 'default_inclusions' : 'default_exclusions'
        const std = ctx.catalog?.standard?.[key]
        const saved = (Array.isArray(std) && std.length ? std : Array.isArray(p[listKey]) ? p[listKey] : []).filter(Boolean)
        return saved.length ? { [key]: saved } : { [key]: [], note: `you have no saved ${key} yet (Policies page)` }
      }
      const items = String(text || '')
        .split(/,|;|\band\b|\balso\b|\bplus\b|\n/i)
        .map((x) => x.replace(/^\s*(?:the\s+)?/, '').trim())
        .filter((x) => x.length > 1)
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
      return items.length ? { [key]: items } : null
    }
    default:
      return null
  }
}

// The Trip Info patch for one answered value.
function infoPatch(vals) {
  const tripInfo = {}
  const out = {}
  if (vals.clientName != null) tripInfo.clientName = vals.clientName
  if (vals.clientPhone != null) tripInfo.clientPhone = formatPhone(vals.clientPhone)
  if (vals.clientEmail != null) tripInfo.clientEmail = vals.clientEmail
  if (vals.adults != null) tripInfo.adults = vals.adults
  if (vals.kids != null) tripInfo.kids5to12 = vals.kids
  if (vals.infants != null) tripInfo.kidsUpto5 = vals.infants
  if (vals.startDate != null) tripInfo.startDate = vals.startDate
  if (vals.nights != null) tripInfo.duration = String(vals.nights)
  if (vals.destination != null) tripInfo.destination = vals.destination
  if (vals.destinationId != null) tripInfo.destinationId = vals.destinationId
  if (vals.tripTitle != null) tripInfo.tripTitle = vals.tripTitle
  if (vals.template != null) tripInfo.template = vals.template
  if (vals.useFlight != null) tripInfo.useFlight = vals.useFlight
  if (Object.keys(tripInfo).length) out.tripInfo = tripInfo
  if (vals.includeGST != null) out.includeGST = vals.includeGST
  if (vals.inclusions) out.inclusions = vals.inclusions
  if (vals.exclusions) out.exclusions = vals.exclusions
  return Object.keys(out).length ? { op: 'patch', ...out } : null
}
// ── places (the agency's own destinations, then hotel cities) ───────────────
function placesIn(text, ctx) {
  const toks = normTokens(text)
  const found = []
  const consider = (name, id, raw) => {
    const seq = normTokens(name)
    const short = normTokens(placeKey(name))
    for (const s of [seq, short]) {
      if (!s.length) continue
      for (let i = 0; i + s.length <= toks.length; i++) {
        if (s.every((w, j) => toks[i + j] === w || (w.length >= 5 && levRatio(toks[i + j], w) >= 0.84))) {
          if (!found.some((f) => samePlace(f.name, name))) found.push({ name, id, raw, pos: i })
          return
        }
      }
    }
  }
  for (const d of ctx.catalog?.destinations || []) if (d?.name) consider(d.name, d.id, d)
  for (const h of ctx.catalog?.hotels || []) if (h?.city) consider(h.city, null, null)
  return found.sort((a, b) => a.pos - b.pos)
}
const destFor = (name, ctx) =>
  (ctx.catalog?.destinations || []).find((d) => samePlace(d.name, name) || samePlace(d.city, name)) || null

// ── Itinerary, day by day ───────────────────────────────────────────────────
function dayQuestion(d, st) {
  const total = st.v.nights + 1
  if (d === 1) return `Now the itinerary — ${plural(total, 'day')}. Day 1: where do they arrive?`
  if (d === total) return `Day ${d}, the last day: where do they leave from? (or "departure")`
  const prev = st.days[d - 1]?.city
  return `Day ${d}: where are they${prev ? ` — still ${prev}, a day trip, or moving on` : ''}?`
}

// One day's answer → the day it describes ("srinagar to gulmarg", "day trip to
// sonamarg", "leisure", "departure").
function readDay(d, text, ctx, st) {
  const t = clean(text)
  const total = st.v.nights + 1
  const prev = st.days[d - 1]?.city || ''
  const places = placesIn(t, ctx)
  const mk = (city, route, location = city) => {
    const dest = destFor(city, ctx)
    return { day: d, city, location, destinationId: dest?.id ?? null, name: dest?.name || city, title: `Day ${d}: ${route}` }
  }
  if (/\b(?:leisure|free day|rest day|at leisure|relax|same place|stay put)\b/.test(t) && prev) return mk(prev, `Leisure day in ${prev}`)
  if (!places.length) {
    if (/\b(?:departure|depart|leave|leaving|fly back|drop)\b/.test(t) && prev) return mk(prev, `Departure from ${prev}`)
    if (/\b(?:same|still|sightseeing|local)\b/.test(t) && prev) return mk(prev, `${prev} Sightseeing`)
    return null
  }
  const last = places[places.length - 1].name
  if (/\b(?:day trip|excursion|visit|trip to)\b/.test(t) && prev && !samePlace(prev, last)) return mk(last, `Day trip to ${last}`, prev)
  if (places.length >= 2) return mk(last, `${places[0].name} to ${last}`)
  if (d === 1) return mk(last, `Arrival in ${last}`)
  if (d === total || /\b(?:departure|depart|leave|leaving)\b/.test(t)) return mk(last, `Departure from ${last}`)
  if (prev && !samePlace(prev, last)) return mk(last, `${prev} to ${last}`)
  return mk(last, `${last} Sightseeing`)
}

// Days the agent laid out by stays ("srinagar 3 nights, gulmarg 2 nights").
function daysFromStays(stays, nights) {
  const cities = []
  stays.forEach((s) => {
    for (let i = 0; i < s.nights; i++) cities.push(s.city)
  })
  if (cities.length !== nights) return null
  const out = []
  for (let d = 1; d <= nights + 1; d++) {
    const city = cities[Math.min(d, nights) - 1]
    const prev = d > 1 ? cities[d - 2] : null
    const route = d === 1 ? `Arrival in ${city}` : d === nights + 1 ? `Departure from ${cities[nights - 1]}` : prev && !samePlace(prev, city) ? `${prev} to ${city}` : `${city} Sightseeing`
    out.push({ day: d, city: d === nights + 1 ? cities[nights - 1] : city, route })
  }
  return out
}

// ── Logistics ───────────────────────────────────────────────────────────────
// Nights still without a hotel, grouped by the itinerary city of each night.
export function openRuns(snapshot) {
  const ti = snapshot?.tripInfo || {}
  const start = String(ti.startDate || '').slice(0, 10)
  const nights = Number(ti.duration) || 0
  if (!start || nights < 1) return []
  const days = [...(snapshot.itinerary || [])].sort((a, b) => Number(a.day) - Number(b.day))
  const accs = (snapshot.accommodations || []).filter((a) => !a.cancelled && !a.cancelledAt)
  const runs = []
  for (let i = 0; i < nights; i++) {
    const date = addDays(start, i)
    const covered = accs.some((a) => String(a.checkIn).slice(0, 10) <= date && date < String(a.checkOut).slice(0, 10))
    if (covered) continue
    const day = days[i]
    const city = day?.location || day?.destination || ''
    const last = runs[runs.length - 1]
    if (last && addDays(last.start, last.nights) === date && samePlace(last.city, city)) last.nights += 1
    else runs.push({ start: date, nights: 1, city })
  }
  return runs
}
const roomTypes = (h) => [...new Set((h?.price_sections || []).map((s) => s.room_type).filter(Boolean))]
const hotelsIn = (city, ctx) =>
  (ctx.catalog?.hotels || []).filter((h) => h.is_available !== false && (samePlace(h.city, city) || !city))

function hotelQuestion(h, ctx) {
  const run = h.run
  const where = `${run.city || 'those nights'}, ${fmtRange(run.start, addDays(run.start, run.nights))} (${plural(run.nights, 'night')})`
  if (!h.hotel) {
    const names = hotelsIn(run.city, ctx).slice(0, 4).map((x) => x.name)
    return `Which hotel in ${where}?${names.length ? ` You have ${listAnd(names)}.` : ''}`
  }
  const types = roomTypes(h.hotel)
  if (!h.roomType && types.length > 1) return `Which room at ${h.hotel.name} — ${listOr(types)}?`
  if (!h.rooms) return 'How many rooms?'
  if (!h.mealPlan) return 'Which meal plan — room only, breakfast, breakfast and dinner, or all meals?'
  const kids = Number(ctx.snapshot?.tripInfo?.kids5to12) || 0
  if (kids > 0 && !h.kidBeds) return `The ${plural(kids, 'kid')} (5–12) — no bed (CNB), or extra beds?`
  return null
}
function readHotel(h, text, ctx) {
  const t = clean(text)
  const cat = prepareCatalog(ctx.catalog || {})
  const notes = []
  // The hotel's name is what's left once rooms, meal plan and room type are out.
  let rest = ` ${extractMealPlan(t).s} `
    .replace(/\b\d{1,2}\s*(?:rooms?|room)\b/g, ' ')
    .replace(/\b(?:super\s+deluxe|deluxe|standard|premium|executive|superior|luxury|family|suite|club|cottage)\s*(?:rooms?)?\b/g, ' ')
    .replace(/\b(?:breakfast|dinner|lunch|meals?|room only|only room|map|cp|ap|ep)\b/g, ' ')
  const words = normTokens(rest).filter((w) => !/^\d+$/.test(w) && !/^(?:hotel|the|at|in|a|an|use|book|add|take|with|rooms?|room|and|for|please|it|resort|stay|plan)$/.test(w))
  if (words.length) {
    const m = matchHotel(words, h.run.city, cat)
    if (m.hotel) {
      const raw = m.hotel.raw || m.hotel
      if (h.run.city && raw.city && !samePlace(raw.city, h.run.city)) notes.push(`${raw.name} is in ${raw.city}, not ${h.run.city}`)
      else if (!h.hotel || h.hotel.id !== raw.id) Object.assign(h, { hotel: raw, roomType: null })
    }
  }
  if (h.hotel) {
    // Longest first: "super deluxe" is not "deluxe".
    const type = [...roomTypes(h.hotel)].sort((a, b) => b.length - a.length).find((x) => new RegExp(`\\b${x.toLowerCase().replace(/[^a-z0-9 ]/g, '')}\\b`).test(t.replace(/[^a-z0-9 ]/g, '')))
    if (type) h.roomType = type
    else if (roomTypes(h.hotel).length === 1) h.roomType = roomTypes(h.hotel)[0]
  }
  const r = t.match(/\b(\d{1,2})\s*(?:rooms?|room)\b/) || (h.ask === 'rooms' ? t.match(/^(\d{1,2})\b/) : null)
  if (r && Number(r[1]) >= 1) h.rooms = Number(r[1])
  if (/\b(?:cnb|no bed|without (?:a |extra )?beds?|child no bed|share (?:the )?bed)\b/.test(t)) h.kidBeds = 'cnb'
  else if (/\b(?:extra beds?|with (?:a |an )?(?:extra )?beds?|own beds?|separate beds?)\b/.test(t) && h.ask === 'kidBeds') h.kidBeds = 'bed'
  const meal = extractMealPlan(t).plan
  if (meal) h.mealPlan = meal
  else if (h.ask === 'meal' && /\b(?:room only|only room|no meals?|without meals?)\b/.test(t)) h.mealPlan = MEAL_PLANS[0]
  return notes
}
const hotelAction = (h) => ({
  type: 'ADD_HOTEL',
  hotelId: h.hotel.id,
  hotelName: h.hotel.name,
  city: h.hotel.city || h.run.city,
  checkIn: h.run.start,
  checkOut: addDays(h.run.start, h.run.nights),
  ...(h.roomType ? { roomType: h.roomType } : {}),
  ...(h.rooms ? { rooms: h.rooms } : {}),
  ...(h.mealPlan ? { mealPlan: h.mealPlan } : {}),
  ...(h.kidBeds ? { kidBeds: h.kidBeds } : {}),
})
// The accommodation the engine would add (to show in the Add Accommodation form).
function plannedNew(before, after, key) {
  const ids = new Set((before?.[key] || []).map((x) => String(x.id)))
  return (after?.[key] || []).filter((x) => !ids.has(String(x.id)))
}

const roadCabs = (ctx) => (ctx.catalog?.vehicles || []).filter((v) => v && v.name && v.is_available !== false && isRoadCab(v))
const groupSize = (snap) => (Number(snap?.tripInfo?.adults) || 0) + (Number(snap?.tripInfo?.kids5to12) || 0)
function cabQuestion(c, ctx) {
  if (!c.vehicle) {
    const g = groupSize(ctx.snapshot)
    const cabs = roadCabs(ctx).sort((a, b) => (Number(b.seating_capacity || 0) >= g) - (Number(a.seating_capacity || 0) >= g) || Number(a.seating_capacity || 0) - Number(b.seating_capacity || 0))
    const names = cabs.slice(0, 4).map((v) => (v.seating_capacity ? `${v.name} (${v.seating_capacity} seats)` : v.name))
    return `Which vehicle?${names.length ? ` You have ${listAnd(names)}.` : ''}`
  }
  if (!c.days) return `For all ${plural(c.totalDays, 'day')}, or which days?`
  const seats = Number(c.vehicle.seating_capacity) || 0
  const g = groupSize(ctx.snapshot)
  if (!c.quantity && seats && seats < g) return `${c.vehicle.name} seats ${seats} and there are ${g} guests — how many vehicles?`
  return null
}
function readCab(c, text, ctx) {
  const t = clean(text)
  const cabs = roadCabs(ctx)
  const prepared = cabs.map((v) => ({ raw: v, id: v.id, tokens: normTokens(v.name).filter((w) => !/^(?:car|cab|the|a)$/.test(w)) }))
  const words = normTokens(t).filter((w) => !/^(?:add|a|an|the|car|cab|cabs|cars|taxi|vehicle|transport|transportation|for|all|days?|use|book|with|and|please)$/.test(w) && !/^\d+$/.test(w))
  if (words.length) {
    const m = bestMatch(words, prepared, { threshold: 0.6, margin: 0.05 })
    if (m.best && (m.confident || m.score >= 0.8)) c.vehicle = m.best.raw
  }
  if (/\b(?:all|whole|entire|every|full)\b/.test(t) || (c.ask === 'days' && YES.test(t))) c.days = Array.from({ length: c.totalDays }, (_, i) => i + 1)
  else {
    const list = []
    for (const m of t.matchAll(/\bdays?\s+(\d{1,2})(?:\s*(?:to|till|through|-)\s*(?:day\s+)?(\d{1,2}))?/g)) {
      const a = Number(m[1])
      const b = m[2] ? Number(m[2]) : a
      for (let d = a; d <= b; d++) list.push(d)
    }
    for (const m of t.matchAll(/\b(?:and|,)\s*(\d{1,2})\b(?!\s*(?:rooms?|cars?|cabs?|vehicles?))/g)) if (list.length) list.push(Number(m[1]))
    const days = [...new Set(list)].filter((d) => d >= 1 && d <= c.totalDays).sort((a, b) => a - b)
    if (days.length) c.days = days
  }
  const q = t.match(/\b(\d)\s*(?:cars?|cabs?|vehicles?|taxis?|of them|nos)\b/) || (c.ask === 'quantity' ? t.match(/^(\d)\b/) : null)
  if (q && Number(q[1]) >= 1) c.quantity = Number(q[1])
}
const cabAction = (c) => ({ type: 'ADD_CAB', vehicleId: c.vehicle.id, vehicleName: c.vehicle.name, days: c.days, ...(c.quantity ? { quantity: c.quantity } : {}) })
const daysText = (days, total) =>
  days.length === total ? `all ${plural(total, 'day')}` : days.length === 1 ? `day ${days[0]}` : `days ${listAnd(days.map(String))}`

// ── the state machine ──────────────────────────────────────────────────────
const HOTEL_ASK = /\b(?:add|book|select|choose|need|put)\b.*\b(?:hotels?|accommodations?|stays?|rooms?)\b|^(?:hotels?|accommodation)$/
const CAB_ASK = /\b(?:add|book|select|choose|need|arrange)\b.*\b(?:transport|transportation|cars?|cabs?|taxis?|vehicles?|innova|dzire|tempo)\b|^(?:transport|transportation|car|cab|vehicle)$/

// A sentence that starts with a field's name: "client name Mr Bilal",
// "phone 98765 43210", "title Kashmir 4N 5D". → { key, vals } or null.
const LABELLED =
  /^(?:the\s+)?(client'?s?\s+name|guest'?s?\s+name|customer\s+name|client|name|phone(?:\s+number)?|mobile(?:\s+number)?|contact(?:\s+number)?|whatsapp(?:\s+number)?|e-?mail(?:\s+id|\s+address)?|trip\s+title|trip\s+name|title|adults|kids|children|start\s+date|travel\s+date|nights|duration|destination)\b\s*(?:is|are|:|-|=|will be|should be)?\s+(.+)$/i
function explicitField(text, ctx, st) {
  const raw = String(text || '').trim()
  const m = raw.match(LABELLED)
  // "client name" alone (the value still coming) is not a name "Name".
  if (!m || /^(?:name|number|no|title|id|address|date|is|of)\b/i.test(m[2].trim())) return null
  const key = fieldNamed(m[1].toLowerCase())
  if (!key) return null
  const vals = infoAnswer(key, m[2], ctx, st)
  return vals && !vals.skip ? { key, vals, raw: m[2] } : null
}

function keep(st, key, vals, raw, ops) {
  delete vals.note
  Object.assign(st.v, vals)
  st.raw = st.raw || {}
  st.raw[key] = raw
  st.answered_[key] = true
  st.lastKey = key
  st.lastWhat = 'info'
  const p = infoPatch(vals)
  if (p) ops.push(p)
}

// Put right what Ching wrote: the named field, else the last one answered.
function correct(st, fix, text, ctx, ops, out) {
  if (!fix.key && st.lastWhat === 'day' && st.lastDay && (st.step === 'days' || st.step === 'logistics')) {
    const d = st.lastDay
    if (fix.value) {
      const day = readDay(d, fix.value, ctx, st)
      if (day) {
        st.days[d] = { city: day.city }
        ops.push({ op: 'day', ...day })
        return out(`Fixed — day ${d} is ${day.city}. ${currentQuestion(st, ctx)}`)
      }
    }
    delete st.days[d]
    if (st.step === 'logistics') {
      st.step = 'days'
      ops.push({ op: 'tab', tab: 'Itinerary' })
    }
    st.ask = d
    return out(`Sure — ${dayQuestion(d, st)}`)
  }
  if (!fix.key && (st.step === 'hotel' || st.step === 'cab')) {
    return out(`Tell me what to change — for example "room type deluxe", "2 rooms" or "breakfast and dinner". ${currentQuestion(st, ctx)}`)
  }
  const key = fix.key || st.lastKey
  if (!key) return out('What should I correct? Say the field and the right value — for example "the title is Kashmir 4N/5D".')
  if (key === 'nights' && st.step !== 'info' && Object.keys(st.days).length) {
    return out(`The days are already laid out for ${plural(st.v.nights, 'night')} — change the nights on the Trip Info tab and I'll carry on. ${currentQuestion(st, ctx)}`)
  }
  const vals = fix.value ? infoAnswer(key, fix.value, ctx, st) : autoRepair(key, st)
  if (vals && !vals.skip) {
    keep(st, key, vals, fix.value || st.raw?.[key] || '', ops)
    st.fixing = null
    const next = st.step === 'info' && st.ask === key ? advance(st, ctx, ops) : currentQuestion(st, ctx)
    return out(`Fixed — the ${FIELD_LABEL[key]} is now ${valueSaid(key, vals)}. ${next}`)
  }
  st.fixing = key
  const sug = key === 'tripTitle' && suggestTitle(st) ? ` Say it, or "yes" for "${suggestTitle(st)}".` : ''
  return out(`Sure — what should the ${FIELD_LABEL[key]} be?${sug}`)
}

/**
 * What the agent is saying right now, written into its field while they
 * speak (the guide's current question, or a field they name): a patch op, or
 * null. Changes nothing in the guide — the finished sentence still goes
 * through guideStep().
 */
const LIVE_KEYS = ['clientName', 'clientPhone', 'clientEmail', 'adults', 'kids', 'nights', 'destination', 'tripTitle']
export function guidePreview(st, text, ctx) {
  const t = clean(text)
  if (!t || STOP.test(t) || REPEAT.test(t) || BACK.test(t) || SKIP.test(t) || SAVE.test(t)) return null
  const tmp = st ? { ...st, v: { ...st.v } } : { step: 'info', v: {}, answered_: {} }
  const ex = explicitField(text, ctx, tmp)
  if (ex && LIVE_KEYS.includes(ex.key)) return infoPatch({ ...ex.vals, note: undefined })
  if (!st) return null
  const fix = readCorrection(text)
  if (fix) {
    const key = fix.key || st.lastKey
    if (!fix.value || !LIVE_KEYS.includes(key)) return null
    const a = infoAnswer(key, fix.value, ctx, tmp)
    return a && !a.skip ? infoPatch({ ...a, note: undefined }) : null
  }
  const key = st.fixing || (st.step === 'info' ? st.ask : null)
  if (!key || !LIVE_KEYS.includes(key)) return null
  const a = infoAnswer(key, text, ctx, tmp)
  return a && !a.skip ? infoPatch({ ...a, note: undefined }) : null
}

/**
 * "correct it" outside the guide, on any open trip: mend Trip Info fields
 * that were clearly misheard (a "495" title → "4N/5D"). → { patch, said } or null.
 */
export function repairTripInfo(tripInfo = {}) {
  const tripInfo2 = {}
  const said = []
  const n = Number(tripInfo.duration) || null
  if (tripInfo.tripTitle) {
    const fixed = fixDurationText(tripInfo.tripTitle, n)
    if (fixed !== tripInfo.tripTitle) {
      tripInfo2.tripTitle = fixed
      said.push(`the title is now "${fixed}"`)
    }
  }
  if (tripInfo.clientName && /[a-z]/.test(tripInfo.clientName.charAt(0))) {
    tripInfo2.clientName = titleCase(tripInfo.clientName)
    said.push(`the client name is now "${tripInfo2.clientName}"`)
  }
  return said.length ? { patch: { op: 'patch', tripInfo: tripInfo2 }, said } : null
}

/** Is this "correct it" / "that's wrong" / "fix the title to …"? */
export const isCorrection = (text) => !!readCorrection(text)

/**
 * "correct it" / "correct the title to …" on an open trip when no guide runs.
 * → { patch?, say } for a Trip Info correction, or null when the sentence is
 * about something else (a hotel, a day…) and belongs to the trip editor.
 */
export function correctTripInfo(text, ctx) {
  const fix = readCorrection(text)
  if (!fix) return null
  const ti = ctx.snapshot?.tripInfo || {}
  if (fix.key) {
    if (!fix.value) {
      const r = repairTripInfo(ti)
      const mine = r && r.patch.tripInfo[fix.key] != null
      return mine
        ? { patch: { op: 'patch', tripInfo: { [fix.key]: r.patch.tripInfo[fix.key] } }, say: `Fixed — the ${FIELD_LABEL[fix.key]} is now "${r.patch.tripInfo[fix.key]}".` }
        : { say: `What should the ${FIELD_LABEL[fix.key]} be? Say it like "the ${FIELD_LABEL[fix.key]} is …".` }
    }
    const st = { step: 'info', v: { nights: Number(ti.duration) || null, destination: ti.destination, clientName: ti.clientName }, answered_: {} }
    const a = infoAnswer(fix.key, fix.value, ctx, st)
    if (!a || a.skip) return { say: `I couldn't read the ${FIELD_LABEL[fix.key]} in that — say it again?` }
    delete a.note
    return { patch: infoPatch(a), say: `Fixed — the ${FIELD_LABEL[fix.key]} is now ${valueSaid(fix.key, a)}.` }
  }
  if (fix.value) return null
  const r = repairTripInfo(ti)
  if (r) return { patch: r.patch, say: `Fixed — ${r.said.join(' and ')}.` }
  return { say: 'Tell me what to correct — for example "correct the title to Kashmir 4N/5D" or "the client name is Mr Bilal".' }
}

/** Start (or restart) the guide for a blank trip. `text` may already carry answers. */
export function startGuide(text, ctx) {
  const st = { step: 'info', ask: null, v: {}, days: {}, history: [], answered_: {} }
  const ops = [{ op: 'tab', tab: 'Trip Info' }]
  const said = heard(text || '', ctx)
  const ex = explicitField(text || '', ctx, st)
  if (ex) {
    Object.assign(said, ex.vals)
    delete said.note
  }
  absorb(st, said, ops)
  const next = advance(st, ctx, ops)
  const told = Object.keys(st.v).length
  return { state: st, ops, say: told ? `Got it. ${next}` : next }
}

// Take in heard values: Trip Info fields, and days laid out by stays.
function absorb(st, vals, ops) {
  const fresh = {}
  for (const [k, v] of Object.entries(vals)) {
    if (k === 'stays' || v == null) continue
    if (st.v[k] === undefined) fresh[k] = v
  }
  Object.assign(st.v, fresh)
  const p = infoPatch(fresh)
  if (p) ops.push(p)
  if (vals.stays && st.v.nights && !Object.keys(st.days).length) {
    const plan = daysFromStays(vals.stays, st.v.nights)
    if (plan) st.pendingDays = plan // laid down when the itinerary step begins
    if (!st.v.destination) {
      const cities = [...new Set(vals.stays.map((s) => s.city))]
      st.suggestDestination = cities.join(' - ')
    }
  }
}

// Ask the next unanswered question (moving tab to tab as the steps change).
function advance(st, ctx, ops) {
  if (st.step === 'info') {
    const key = INFO.find((k) => !answered(st, k))
    if (key) {
      st.ask = key
      if (key === 'destination' && st.suggestDestination) return `What destination should the trip show? Say it, or "yes" for "${st.suggestDestination}".`
      return infoQuestion(key, st)
    }
    st.step = 'days'
    st.ask = null
    ops.push({ op: 'tab', tab: 'Itinerary' })
    if (st.pendingDays) {
      for (const p of st.pendingDays) {
        const dest = destFor(p.city, ctx)
        st.days[p.day] = { city: p.city }
        ops.push({ op: 'day', day: p.day, destinationId: dest?.id ?? null, name: dest?.name || p.city, title: `Day ${p.day}: ${p.route}`, location: p.city })
      }
      st.pendingDays = null
      const nextDay = nextOpenDay(st)
      if (!nextDay) return `${enterLogistics(st, ops)}`
    }
  }
  if (st.step === 'days') {
    const d = nextOpenDay(st)
    if (d) {
      st.ask = d
      return dayQuestion(d, st)
    }
    return enterLogistics(st, ops)
  }
  if (st.step === 'logistics') return logisticsPrompt(st, ctx)
  return ''
}
const answered = (st, k) => k in st.answered_ || st.v[k] !== undefined || (k === 'gst' && st.v.includeGST !== undefined) || (k === 'travel' && st.v.useFlight !== undefined)
const nextOpenDay = (st) => {
  for (let d = 1; d <= st.v.nights + 1; d++) if (!st.days[d]) return d
  return null
}
function enterLogistics(st, ops) {
  st.step = 'logistics'
  st.ask = null
  ops.push({ op: 'tab', tab: 'Logistics' })
  const route = Object.keys(st.days)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => st.days[d].city)
    .filter((c, i, a) => c && (i === 0 || !samePlace(c, a[i - 1])))
  return `The itinerary is in — ${listAnd(route)}. Now logistics: say "add hotel" to book the hotels, or "add transport" for the car.`
}
function logisticsPrompt(st, ctx) {
  const runs = openRuns(ctx.snapshot)
  if (runs.length) {
    st.offer = 'hotel'
    return `Next, the hotel for ${runs[0].city || 'the open nights'} (${fmtRange(runs[0].start, addDays(runs[0].start, runs[0].nights))}) — shall I open Add Hotel? Say "yes", or "add transport".`
  }
  st.offer = 'cab'
  return 'Every night has a hotel. Shall I add the transport? Say "yes", or "done" to finish.'
}

function beginHotel(st, text, ctx, ops) {
  const runs = openRuns(ctx.snapshot)
  if (!runs.length) return 'Every night already has a hotel. Say "add transport", or "done".'
  const t = clean(text)
  const places = placesIn(t, ctx)
  const run = (places.length && runs.find((r) => samePlace(r.city, places[0].name))) || runs[0]
  st.step = 'hotel'
  // The kids' bed choice carries over from the first hotel ("same as before").
  st.h = { run, hotel: null, roomType: null, rooms: null, mealPlan: null, kidBeds: st.kidBeds || null, ask: null }
  ops.push({ op: 'tab', tab: 'Logistics' })
  const notes = readHotel(st.h, t, ctx)
  return hotelNext(st, ctx, ops, notes)
}
function hotelNext(st, ctx, ops, notes = []) {
  const h = st.h
  const q = hotelQuestion(h, ctx)
  // Show the form as far as it's known.
  if (h.hotel) {
    const r = ctx.plan ? ctx.plan([hotelAction(h)]) : null
    const acc = r ? plannedNew(ctx.snapshot, r.snapshot, 'accommodations')[0] : null
    ops.push({
      op: 'hotelForm',
      form: acc
        ? { ...acc, rooms: h.rooms ? String(h.rooms) : acc.rooms, mealPlan: h.mealPlan || '', roomType: h.roomType || acc.roomType }
        : { city: h.hotel.city || h.run.city, hotelId: h.hotel.id, name: h.hotel.name, checkIn: h.run.start, checkOut: addDays(h.run.start, h.run.nights) },
    })
    h.preview = acc
  } else {
    ops.push({ op: 'hotelForm', form: { city: h.run.city, checkIn: h.run.start, checkOut: addDays(h.run.start, h.run.nights), hotelId: null, name: '' } })
  }
  const lead = notes.length ? `${notes.join('. ')}. ` : ''
  if (q) {
    h.ask = !h.hotel ? 'hotel' : !h.roomType && roomTypes(h.hotel).length > 1 ? 'roomType' : !h.rooms ? 'rooms' : !h.mealPlan ? 'meal' : 'kidBeds'
    return lead + q
  }
  h.ask = 'confirm'
  const price = Number(h.preview?.pricePerRoom) > 0 ? ` — ₹${Number(h.preview.pricePerRoom).toLocaleString('en-IN')} a room a night` : ''
  return `${lead}${h.hotel.name}, ${h.roomType || 'room'}, ${plural(h.rooms, 'room')}, ${h.mealPlan}, ${fmtRange(h.run.start, addDays(h.run.start, h.run.nights))}${price}. Say "save", or change something.`
}

function beginCab(st, text, ctx, ops) {
  const total = (Number(ctx.snapshot?.tripInfo?.duration) || 0) + 1
  if (!(ctx.snapshot?.itinerary || []).length) return 'The trip has no days yet — let\'s do the itinerary first.'
  st.step = 'cab'
  st.c = { vehicle: null, days: null, quantity: null, ask: null, totalDays: Math.max(1, (ctx.snapshot.itinerary || []).length || total) }
  ops.push({ op: 'tab', tab: 'Logistics' })
  readCab(st.c, clean(text), ctx)
  return cabNext(st, ctx, ops)
}
function cabNext(st, ctx, ops) {
  const c = st.c
  const q = cabQuestion(c, ctx)
  let row = null
  if (c.vehicle && c.days && ctx.plan) {
    const r = ctx.plan([cabAction(c)])
    row = r ? plannedNew(ctx.snapshot, r.snapshot, 'transportation')[0] : null
  }
  ops.push({
    op: 'cabForm',
    form: row || {
      vehicleId: c.vehicle?.id ?? null,
      vehicleType: c.vehicle?.name || '',
      date: ctx.snapshot?.tripInfo?.startDate || '',
      quantity: c.quantity || 1,
    },
  })
  if (q) {
    c.ask = !c.vehicle ? 'vehicle' : !c.days ? 'days' : 'quantity'
    return q
  }
  c.ask = 'confirm'
  return `${c.quantity > 1 ? `${c.quantity} × ` : ''}${c.vehicle.name} for ${daysText(c.days, c.totalDays)}, routed from the itinerary${row?.route ? ` (day ${c.days[0]}: ${row.route})` : ''}. Say "save", or change something.`
}

/**
 * One utterance during the guide → { handled, ops, say, done }. `handled:
 * false` lets the rest of Ching take it (the widget then repeats the open
 * question).
 */
export function guideStep(st, text, ctx) {
  st.answered_ = st.answered_ || {}
  ctx = { ...ctx, said: String(text || '') }
  const t = clean(text)
  const ops = []
  const out = (say, extra = {}) => ({ handled: true, ops, say, ...extra })
  if (!t) return { handled: false, ops }

  // Stopped: keep (save) or throw away.
  if (st.step === 'stopped') {
    if (/\b(?:discard|delete|throw|remove|don'?t (?:keep|save)|no)\b/.test(t)) return out('Discarded — nothing was saved.', { ops: [{ op: 'discard' }], done: true })
    if (/\b(?:save|keep|yes)\b/.test(t)) return out('Saving what we have.', { ops: [{ op: 'command', type: 'SAVE' }], done: true })
    return { handled: false, ops, done: true }
  }
  if (STOP.test(t)) {
    st.step = 'stopped'
    ops.push({ op: 'closeForms' })
    return out('Okay, I\'ve stopped. Say "save" to keep this trip, or "discard" to throw it away.')
  }
  if (REPEAT.test(t)) return out(currentQuestion(st, ctx))

  // "correct it" / "that's wrong" / "fix the title to …": mend what was written.
  const fix = readCorrection(text)
  // "no, it's not included" answers a yes/no question; it isn't a correction.
  const answersAsked = fix?.soft && st.step === 'info' && ['gst', 'travel', 'kids', 'inclusions', 'exclusions'].includes(st.ask)
  // In the hotel / car forms "change the room type to deluxe" is just the next answer.
  const formEdit = fix && fix.value && !fix.key && (st.step === 'hotel' || st.step === 'cab')
  if (fix && !answersAsked && !formEdit) return correct(st, fix, text, ctx, ops, out)
  // The answer to "what should the title be?" after a correction.
  if (st.fixing) {
    const key = st.fixing
    if (SKIP.test(t)) {
      st.fixing = null
      return out(`Okay, I've left it. ${currentQuestion(st, ctx)}`)
    }
    const a = infoAnswer(key, text, ctx, st)
    if (!a || a.skip) return { handled: false, ops }
    keep(st, key, a, text, ops)
    st.fixing = null
    const next = st.step === 'info' && st.ask === key ? advance(st, ctx, ops) : currentQuestion(st, ctx)
    return out(`Fixed — the ${FIELD_LABEL[key]} is now ${valueSaid(key, a)}. ${next}`)
  }

  // Jumps the agent can make at any point.
  if (st.step !== 'info' || answered(st, 'nights')) {
    if (HOTEL_ASK.test(t) && st.step !== 'hotel') {
      if (st.step === 'days' || st.step === 'info') {
        const d = nextOpenDay(st)
        if (st.step === 'info' || d) return out(`Let's finish the itinerary first. ${currentQuestion(st, ctx)}`)
      }
      if (st.step === 'cab') ops.push({ op: 'closeForms' })
      return out(beginHotel(st, text, ctx, ops))
    }
    if (CAB_ASK.test(t) && st.step !== 'cab') {
      if (st.step === 'hotel') ops.push({ op: 'closeForms' })
      if (st.step === 'days' && nextOpenDay(st)) return out(`Let's finish the itinerary first. ${currentQuestion(st, ctx)}`)
      if (st.step === 'info') return out(`Let's finish the trip details first. ${currentQuestion(st, ctx)}`)
      return out(beginCab(st, text, ctx, ops))
    }
  }

  if (st.step === 'info') {
    const key = st.ask
    if (BACK.test(t) && st.history.length) {
      const prev = st.history.pop()
      delete st.v[prev]
      delete st.answered_[prev]
      st.ask = prev
      return out(infoQuestion(prev, st))
    }
    if (key === 'destination' && st.suggestDestination && YES.test(t)) {
      const vals = { destination: st.suggestDestination }
      const places = placesIn(st.suggestDestination, ctx)
      if (places.length === 1) vals.destinationId = places[0].id
      return takeInfo(st, key, vals, ctx, ops, out)
    }
    // "phone 98765 43210" while Ching asked for the name: that field, then the question again.
    const ex = explicitField(text, ctx, st)
    if (ex && ex.key !== key && !(key === 'clientName' && ex.key === 'clientName')) {
      keep(st, ex.key, ex.vals, ex.raw, ops)
      const next = answered(st, key) ? advance(st, ctx, ops) : infoQuestion(key, st)
      return out(`Got it — the ${FIELD_LABEL[ex.key]} is ${valueSaid(ex.key, ex.vals)}. ${next}`)
    }
    const a = infoAnswer(key, text, ctx, st)
    if (a?.skip) {
      st.answered_[key] = true
      st.history.push(key)
      const next = advance(st, ctx, ops)
      return out(`Skipped. ${next}`)
    }
    // Other fields said in the same breath ("Shah, 98765 43210").
    const extra = heard(text, ctx)
    if (a) delete extra[Object.keys(a)[0]]
    // A name only comes from its own question (or "a trip for Shah" at the
    // start) — never guessed from a stray sentence ("what's the…" → "What").
    delete extra.clientName
    if (!a && !Object.keys(extra).length) return { handled: false, ops }
    if (!a) {
      absorb(st, extra, ops)
      const next = advance(st, ctx, ops)
      return out(`Noted. ${next}`)
    }
    absorb(st, extra, ops)
    return takeInfo(st, key, a, ctx, ops, out)
  }

  if (st.step === 'days') {
    // "day 2 gulmarg, day 3 pahalgam" — several days at once.
    const parts = [...t.matchAll(/\bday\s+(\d{1,2})\b\s*[:,-]?\s*(.*?)(?=\bday\s+\d{1,2}\b|$)/g)]
    const items = parts.length ? parts.map((m) => [Number(m[1]), m[2]]) : [[st.ask, t]]
    const allRest = /\b(?:all|rest of the|remaining|every)\s+(?:the\s+)?days?\b/.test(t)
    const done = []
    for (const [d, phrase] of items) {
      if (!(d >= 1 && d <= st.v.nights + 1)) continue
      const day = readDay(d, phrase, ctx, st)
      if (!day) continue
      st.days[d] = { city: day.city }
      ops.push({ op: 'day', ...day })
      done.push(d)
    }
    if (allRest && done.length) {
      const city = st.days[done[done.length - 1]].city
      for (let d = 1; d <= st.v.nights + 1; d++) {
        if (st.days[d]) continue
        const day = readDay(d, city, ctx, st)
        st.days[d] = { city: day.city }
        ops.push({ op: 'day', ...day })
      }
    }
    if (!done.length) {
      const places = placesIn(t, ctx)
      if (!places.length && /[a-z]{4,}/.test(t) && !HOTEL_ASK.test(t) && !CAB_ASK.test(t)) {
        const names = (ctx.catalog?.destinations || []).slice(0, 5).map((d) => d.name)
        return out(`I couldn't find that in your destinations${names.length ? ` (${listAnd(names)}…)` : ''}. ${dayQuestion(st.ask, st)}`)
      }
      return { handled: false, ops }
    }
    st.lastDay = done[done.length - 1]
    st.lastWhat = 'day'
    const next = advance(st, ctx, ops)
    const said = done.map((d) => `Day ${d}: ${st.days[d].city}`).join(', ')
    return out(`${said}. ${next}`)
  }

  if (st.step === 'logistics') {
    if (YES.test(t) && st.offer === 'hotel') return out(beginHotel(st, '', ctx, ops))
    if (YES.test(t) && st.offer === 'cab') return out(beginCab(st, '', ctx, ops))
    if (/^(?:done|finish|finished|that's all|thats all|no|nothing else|all set|complete)\b/.test(t)) return finishGuide(st, ops, out)
    return { handled: false, ops }
  }

  if ((st.step === 'hotel' || st.step === 'cab') && /^(?:done|finish|finished|that's all|thats all|all set)$/.test(t)) return finishGuide(st, ops, out)
  if (st.step === 'hotel') {
    const h = st.h
    if (SKIP.test(t) || /^(?:cancel|close)\b/.test(t)) {
      st.step = 'logistics'
      ops.push({ op: 'closeForms' })
      return out(`Okay, no hotel there for now. ${logisticsPrompt(st, ctx)}`)
    }
    if (h.ask === 'confirm' && SAVE.test(t)) {
      if (h.kidBeds) st.kidBeds = h.kidBeds
      const action = hotelAction(h)
      const r = ctx.plan ? ctx.plan([action]) : null
      ops.push({ op: 'apply', actions: [action] }, { op: 'closeForms' })
      st.step = 'logistics'
      const after = { ...ctx, snapshot: r?.snapshot || ctx.snapshot }
      return out(`Saved ${h.hotel.name}. ${logisticsPrompt(st, after)}`)
    }
    const before = JSON.stringify([h.hotel?.id, h.roomType, h.rooms, h.mealPlan, h.kidBeds])
    const notes = readHotel(h, t, ctx)
    if (JSON.stringify([h.hotel?.id, h.roomType, h.rooms, h.mealPlan, h.kidBeds]) === before && !notes.length) {
      if (h.ask === 'hotel') {
        const names = hotelsIn(h.run.city, ctx).slice(0, 4).map((x) => x.name)
        return out(`I couldn't find that hotel in ${h.run.city}.${names.length ? ` You have ${listAnd(names)}.` : ''}`)
      }
      return { handled: false, ops }
    }
    return out(hotelNext(st, ctx, ops, notes))
  }

  if (st.step === 'cab') {
    const c = st.c
    if (SKIP.test(t) || /^(?:cancel|close)\b/.test(t)) {
      st.step = 'logistics'
      ops.push({ op: 'closeForms' })
      return out('Okay, no transport for now. Say "add transport" later, or "done" to finish.')
    }
    if (c.ask === 'confirm' && SAVE.test(t)) {
      ops.push({ op: 'apply', actions: [cabAction(c)] }, { op: 'closeForms' })
      st.step = 'logistics'
      st.offer = null
      return out(`Saved the ${c.vehicle.name}. Anything else — another hotel or car? Or say "done".`)
    }
    const before = JSON.stringify([c.vehicle?.id, c.days, c.quantity])
    readCab(c, t, ctx)
    if (JSON.stringify([c.vehicle?.id, c.days, c.quantity]) === before) {
      if (c.ask === 'vehicle') return out(`I couldn't find that vehicle. ${cabQuestion(c, ctx)}`)
      return { handled: false, ops }
    }
    return out(cabNext(st, ctx, ops))
  }
  return { handled: false, ops }
}

function takeInfo(st, key, vals, ctx, ops, out) {
  const note = vals.note
  delete vals.note
  Object.assign(st.v, vals)
  st.answered_[key] = true
  st.history.push(key)
  st.raw = st.raw || {}
  st.raw[key] = ctx.said ?? ''
  st.lastKey = key
  st.lastWhat = 'info'
  const p = infoPatch(vals)
  if (p) ops.push(p)
  const next = advance(st, ctx, ops)
  return out(`${note ? `Okay — ${note}. ` : ''}${next}`)
}

function finishGuide(st, ops, out) {
  st.step = 'finished'
  ops.push({ op: 'closeForms' }, { op: 'tab', tab: 'Pricing' })
  return out('That\'s the trip. Check the price here — say "save" to save it, or "export" for the PDF.', { done: true })
}

/** The question the guide is waiting on (to repeat it after Ching handled something else). */
export function currentQuestion(st, ctx) {
  if (!st) return ''
  if (st.fixing) return `What should the ${FIELD_LABEL[st.fixing]} be?`
  if (st.step === 'info' && st.ask) {
    if (st.ask === 'destination' && st.suggestDestination) return `What destination should the trip show? Say it, or "yes" for "${st.suggestDestination}".`
    return infoQuestion(st.ask, st)
  }
  if (st.step === 'days' && st.ask) return dayQuestion(st.ask, st)
  if (st.step === 'hotel') return hotelQuestion(st.h, ctx) || 'Say "save", or change something.'
  if (st.step === 'cab') return cabQuestion(st.c, ctx) || 'Say "save", or change something.'
  if (st.step === 'logistics') return 'Say "add hotel", "add transport", or "done".'
  if (st.step === 'stopped') return 'Say "save" to keep this trip, or "discard" to throw it away.'
  return ''
}

/** "add hotel" / "add transport" on a trip that already has its days: the Logistics part alone. */
export function startLogistics(text, ctx) {
  const ti = ctx.snapshot?.tripInfo || {}
  const st = { step: 'logistics', ask: null, v: { nights: Number(ti.duration) || 0, clientName: ti.clientName || '' }, days: {}, history: [], answered_: {}, standalone: true }
  const ops = []
  const say = CAB_ASK.test(clean(text)) ? beginCab(st, text, ctx, ops) : beginHotel(st, text, ctx, ops)
  return { state: st, ops, say }
}

/** Does this sentence ask for a hotel / a cab (the guided Logistics forms)? */
export const wantsHotel = (t) => HOTEL_ASK.test(clean(t))
export const wantsCab = (t) => CAB_ASK.test(clean(t))
