// Ching as a travel agent: the BRIEF. A client's request is rarely a dictated
// spec ("2 nights in Lalit, 1 night in Khyber") — it's "plan a Kashmir trip
// for 4 people for 5 nights, budget hotels". This module reads that kind of
// sentence, asks only for what a travel agent has to know before planning
// (where, how many nights, how many people, from which date, and who it's
// for), and hands the finished request to the planner (buildTrip.js), which
// builds the route, hotels, cab and day plan from the agency's own catalog.
//
// Nothing here is invented: the facts of the trip (guests, date, nights,
// destination) are only what the agent said; the hotels and the cab are picked
// from the agency's own rows and shown as suggestions in the Trip Draft.
//
// Pure: no React, no network.
//   parseTripRequest(text, catalog, { today, settings }) → ChingCommand (repaired)
//   startBrief(text, ctx) / briefStep(state, text, ctx)  → { ready, text } | { say }
// ctx = { catalog (builder/init shapes), today, settings }
import { parseChingCommand } from './parseCommand.js'
import { hotelPreference, pickVehicle } from './buildTrip.js'
import { GAZETTEER, tripDestination } from './geo.js'
import { normTokens } from './fuzzy.js'
import { placeKey, samePlace } from './places.js'
import { convertNumberWords, normalizeTripWords, titleCase } from './text.js'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_SHORT = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 }
const monthIndex = (w) => (MONTHS.includes(w) ? MONTHS.indexOf(w) : w in MONTH_SHORT ? MONTH_SHORT[w] : -1)

// Words of a request that describe the trip, never a hotel or a person.
const REQUEST_WORDS = new Set([
  ...MONTHS, ...Object.keys(MONTH_SHORT),
  'budget', 'cheap', 'cheapest', 'economy', 'affordable', 'luxury', 'luxurious', 'premium', 'deluxe', 'standard',
  'best', 'good', 'nice', 'top', 'mid', 'range', 'midrange', 'decent', 'star', 'stars',
  'hotel', 'hotels', 'resort', 'resorts', 'stay', 'stays', 'accommodation', 'property', 'properties', 'room', 'rooms',
  'category', 'class', 'only', 'with', 'in', 'for', 'the', 'a', 'an', 'and', 'of', 'some', 'any',
  'winter', 'summer', 'snow', 'season', 'spring', 'autumn', 'holidays', 'vacation', 'vacations',
  'honeymoon', 'family', 'group', 'couple', 'friends', 'trip', 'tour', 'package', 'itinerary', 'holiday', 'plan',
])
const STATE_SKIP = new Set([
  'and', 'the', 'of', 'pradesh', 'islands', 'island', 'union', 'territory', 'state', 'nadu', 'bengal',
  'west', 'east', 'north', 'south', 'new', 'central', 'upper', 'lower', 'nagar', 'uttar', 'madhya',
  'andhra', 'arunachal', 'haveli', 'daman', 'diu', 'dadra', 'nicobar', 'tamil',
])

const clean = (t) =>
  normalizeTripWords(convertNumberWords(String(t || '').toLowerCase().replace(/[‘’]/g, "'")))
    .replace(/[?!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const hotelCities = (catalog) => [...new Set((catalog?.hotels || []).map((h) => String(h?.city || '').trim()).filter(Boolean))]

/**
 * Region names an agent says for a whole area ("kashmir", "ladakh"): the
 * gazetteer's regions and the words of the catalog destinations' states —
 * never a town that has hotels of its own.
 */
export function regionWords(catalog) {
  const cities = hotelCities(catalog).map(placeKey)
  const out = new Set(Object.values(GAZETTEER).map((g) => String(g[2]).toLowerCase()))
  for (const d of catalog?.destinations || []) {
    for (const w of normTokens(String(d?.state || ''))) if (w.length >= 3 && !STATE_SKIP.has(w)) out.add(w)
  }
  for (const w of [...out]) if (cities.includes(w)) out.delete(w)
  return out
}

/** The towns of the catalog said anywhere in the sentence, in the order said. */
export function citiesSaid(text, catalog) {
  const t = ` ${placeKey(text)} `
  const places = [...new Set([...hotelCities(catalog), ...(catalog?.destinations || []).map((d) => d?.name).filter(Boolean)])]
  return places
    .map((c) => ({ c, at: t.indexOf(` ${placeKey(c)} `) }))
    .filter((x) => x.at >= 0 && placeKey(x.c))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c)
    .filter((c, i, arr) => arr.findIndex((y) => samePlace(y, c)) === i)
}

/**
 * A budget for the whole trip ("package under 50000", "30k per person",
 * "budget is 1.5 lakh") — as opposed to a room rate cap ("hotels under 6000").
 * → { total, phrase } | null
 */
export function tripBudget(text, guests = 2) {
  const t = clean(text)
  const m = /\b(?:under|below|less than|within|upto|up to|max(?:imum)?(?: of)?|not more than|budget(?: is| of)?|around|approx(?:imately)?|about)\s*(?:rs\.?|₹|inr|rupees)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)?(?:\s*(?:rs\.?|rupees|inr))?(\s*(?:per person|per head|per pax|pp|each))?/.exec(t)
  // "30k per person" needs no "under": a price a head is always a budget.
  const pp = m ? null : /(?:rs\.?|₹|inr|rupees)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)?(?:\s*(?:rs\.?|rupees|inr))?(\s*(?:per person|per head|per pax|pp))\b/.exec(t)
  if (!m && !pp) return null
  if (!m) return tripBudgetFrom(pp, t, guests)
  return tripBudgetFrom(m, t, guests)
}
function tripBudgetFrom(m, t, guests) {
  const unit = m[2] || ''
  const amount = Number(m[1].replace(/,/g, '')) * (/^(?:k|thousand)$/.test(unit) ? 1000 : unit ? 100000 : 1)
  const perPerson = !!m[3]
  const before = t.slice(Math.max(0, m.index - 28), m.index)
  const wholeTrip = perPerson || amount >= 25000 || /\b(?:total|overall|package|trip|tour|all inclusive)\b/.test(before)
  if (!wholeTrip || amount < 3000) return null
  return { total: Math.round(perPerson ? amount * Math.max(1, guests) : amount), phrase: m[0] }
}

/**
 * parseChingCommand, then the misreadings of a request put right:
 *  - a region ("kashmir") or a trip word taken as the client's name;
 *  - "5 nights kashmir" booked into a hotel that has "Kashmir" in its name;
 *  - "a week in december budget hotels" / "in january" read as a hotel name;
 *  - a month with no day isn't a start date (kept as `month`, asked later);
 *  - a whole-trip budget becomes a room-rate cap the trip fits in (`pref`).
 */
export function parseTripRequest(text, catalog, { today, settings } = {}) {
  const cmd = parseChingCommand(text, catalog, { today })
  if (!cmd || cmd.intent !== 'create_trip') return cmd
  const regions = regionWords(catalog)
  const towns = hotelCities(catalog).map(placeKey)
  const said = clean(text)
  const words = normTokens(said)
  const missing = new Set(cmd.missing || [])

  // A client is a person: never a place, a region or a word describing the trip.
  if (cmd.clientName) {
    const nw = normTokens(cmd.clientName).filter((w) => !/^(?:mr|mrs|ms|miss|dr)$/.test(w))
    if (nw.length && nw.every((w) => regions.has(w) || towns.includes(w) || REQUEST_WORDS.has(w))) {
      cmd.clientName = ''
      missing.add('clientName')
      // …and the real one may be said later in the sentence ("client name is Rahul Sharma").
      const m = /\b(?:client|guest|customer)(?:'s)? name(?: is)? ((?:(?:mr|mrs|ms|miss|dr)\.? )?[a-z]+(?: [a-z]+){0,2})(?=\s*(?:,|$|\d))/.exec(said)
      if (m) {
        cmd.clientName = titleCase(m[1].replace(/\./g, ''))
        missing.delete('clientName')
      }
    }
  }

  // Stays that are really the region or a description of the trip.
  const dropped = []
  const kept = []
  for (const st of cmd.stays || []) {
    const heard = normTokens(st.heard || '').filter((w) => !/^\d+$/.test(w))
    const isRegion = heard.length > 0 && heard.every((w) => regions.has(w))
    const isTalk = !st.hotelId && !st.city && heard.length > 0 && heard.every((w) => REQUEST_WORDS.has(w) || regions.has(w))
    if (isRegion || isTalk) dropped.push(st)
    else kept.push(st)
  }
  if (dropped.length) {
    const gone = new Set(dropped.map((st) => String(st.hotelName || '').toLowerCase()))
    const goneHeard = dropped.map((st) => placeKey(st.heard || '')).filter(Boolean)
    cmd.stays = kept
    cmd.unmatchedHotels = (cmd.unmatchedHotels || []).filter((u) => !gone.has(String(u.heard || '').toLowerCase()))
    cmd.warnings = (cmd.warnings || []).filter((w) => !goneHeard.some((h) => placeKey(w).includes(h)))
    if (!cmd.nights) cmd.nights = dropped.reduce((n, st) => n + (Number(st.nights) || 0), 0)
    if (!kept.length) missing.add('stays')
  }

  // The region names the trip when it was said ("Kashmir 5N/6D", not "Srinagar 5N/6D").
  const region = words.find((w) => regions.has(w))
  const named = (catalog?.destinations || []).find((d) => d?.name && placeKey(d.name) === placeKey(cmd.destinationName))
  if (region && (dropped.length || !cmd.destinationName || (named && !words.includes(placeKey(named.name))))) {
    const own = (catalog?.destinations || []).find((d) => placeKey(d?.name) === region)
    cmd.destinationName = own?.name || titleCase(region)
    cmd.destinationId = own?.id ?? null
    missing.delete('destination')
  }
  // Several towns and no region said: the trip is named after their region
  // (Srinagar + Gulmarg + Pahalgam → "Kashmir"), one town → that town.
  if (!kept.length && !region) {
    const towns2 = citiesSaid(said, catalog)
    const isTown = !cmd.destinationName || towns2.some((c) => samePlace(c, cmd.destinationName))
    if (towns2.length && isTown) {
      const d = towns2.length > 1 ? tripDestination(towns2, catalog?.destinations || []) : null
      cmd.destinationName = d?.name || cmd.destinationName || towns2[0]
      cmd.destinationId = d ? d.id ?? null : cmd.destinationId ?? null
      missing.delete('destination')
    }
  }

  // "in december", "this january": a month, not a date.
  if (!cmd.startDate) {
    const m = new RegExp(`\\b(?:(in|during|for|this|next|coming|around|early|mid|late|end of)\\s+)?(${MONTHS.join('|')}|${Object.keys(MONTH_SHORT).join('|')})\\b`).exec(said)
    if (m && (m[2] !== 'may' || m[1])) cmd.month = monthIndex(m[2])
  }

  // A budget for the whole trip → the dearest room rate that still fits it.
  const guests = (Number(cmd.adults) || 0) + (Number(cmd.children) || 0)
  const budget = tripBudget(said, guests || 2)
  if (budget) {
    const nights = Number(cmd.nights) || 0
    const pref = hotelPreference(said.replace(budget.phrase, ' '))
    cmd.totalBudget = budget.total
    if (nights > 0) {
      const margin = Number(settings?.profit_percentage ?? 10) || 0
      const gst = settings?.include_gst === false ? 0 : Number(settings?.gst_percentage ?? 5) || 0
      const net = budget.total / ((1 + margin / 100) * (1 + gst / 100))
      const cab = (catalog?.vehicles || []).find((v) => String(v.id) === String(cmd.vehicleId)) || pickVehicle(catalog?.vehicles || [], guests || 2, catalog?.memory || null)
      const cabCost = !cab ? 0 : cab.rate_type === 'per_trip' ? Number(cab.price) || 0 : (Number(cab.price) || 0) * (nights + 1)
      const rooms = Number(cmd.rooms) || Math.max(1, Math.ceil((Number(cmd.adults) || 2) / 2))
      cmd.pref = { ...pref, maxPrice: Math.max(1, Math.floor((net - cabCost) / (rooms * nights))) }
    } else cmd.pref = { ...pref, maxPrice: null }
  }

  cmd.missing = [...missing]
  return cmd
}

// ── the brief: what must be known before a trip can be planned ───────────────
const ORDER = ['destination', 'nights', 'adults', 'startDate']
const STOP = /^(?:stop|cancel|exit|quit|abort|leave it|never ?mind|forget it|rehne do|chhodo)(?:\s+(?:it|this|the trip|now))?$/
const SKIP = /^(?:skip|skip it|pass|later|not now|don't know|dont know|no idea|pata nahi|baad mein)\b/

/** What's still needed, in the order an agent asks it. */
export function briefNeeds(cmd, catalog, text) {
  const missing = new Set(cmd?.missing || [])
  const need = []
  const hasPlace = !!cmd?.destinationName || (cmd?.stays || []).length > 0 || !!cmd?.dayPlan || citiesSaid(text, catalog).length > 0
  if (!hasPlace) need.push('destination')
  if (!(Number(cmd?.nights) > 0)) need.push('nights')
  if (missing.has('adults')) need.push('adults')
  if (!cmd?.startDate) need.push('startDate')
  return need.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
function heardLine(cmd, need) {
  const bits = []
  if (cmd.destinationName) bits.push(cmd.destinationName)
  if (Number(cmd.nights) > 0) bits.push(plural(cmd.nights, 'night'))
  if (!need.includes('adults')) {
    const kids = Number(cmd.children) || 0
    bits.push(`${plural(cmd.adults, 'adult')}${kids ? ` and ${kids} ${kids === 1 ? 'child' : 'children'}` : ''}`)
  }
  if (cmd.clientName) bits.push(`for ${cmd.clientName}`)
  return bits.join(', ')
}
function question(need, cmd, askName) {
  const month = Number.isInteger(cmd.month) ? titleCase(MONTHS[cmd.month]) : ''
  const ask = {
    destination: 'where they want to go',
    nights: 'how many nights',
    adults: 'how many people are travelling',
    startDate: month ? `which date in ${month} they arrive` : 'the date they arrive',
  }
  if (need.length === 1 && !askName) {
    return {
      destination: 'Where do they want to go?',
      nights: 'How many nights?',
      adults: 'How many people are travelling? Say the adults and any kids.',
      startDate: month ? `Which date in ${month} do they arrive?` : 'From which date?',
    }[need[0]]
  }
  const parts = [...(askName ? ["the client's name"] : []), ...need.map((k) => ask[k])]
  const last = parts.pop()
  return `Tell me ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`
}

const NOT_NAME = /^(?:people|persons?|pax|adults?|kids?|child|children|nights?|days?|from|starting|start|on|tomorrow|today|next|this|couple|skip|no|yes|just|only|about|around|we|they|two|three|four|five|six|seven|eight|nine|ten|a|an|the|to|in|trip|log|raat|din)$/

/** An answer, written the way the parser reads it. */
function asPhrase(answer, st) {
  const t = clean(answer)
  const only = st.ask.length === 1 ? st.ask[0] : null
  const num = /^(\d{1,3})$/.exec(t)
  // A bare number answers the one count that was asked.
  const counts = st.ask.filter((k) => k === 'nights' || k === 'adults')
  const dateToo = st.ask.includes('startDate') && Number.isInteger(st.month)
  if (num && counts.length === 1 && !dateToo) return `${num[1]} ${counts[0] === 'nights' ? 'nights' : 'adults'}`
  // "rahul sharma 4 people 10 november": the name said first, when it was asked.
  if (st.ask.includes('clientName') && st.ask.length > 1) {
    const lead = /^((?:(?:mr|mrs|ms|miss|dr)\.? )?[a-z]+(?: [a-z]+){0,2}?)(?:,| (?=\d)| (?=(?:from|starting|on|for|tomorrow|next|couple|family)\b))\s*(.*)$/.exec(t)
    const words = lead ? lead[1].replace(/^(?:mr|mrs|ms|miss|dr)\.? /, '').split(' ') : []
    if (lead && lead[2] && words.every((w) => !REQUEST_WORDS.has(w) && !NOT_NAME.test(w)) && !st.places?.some((p) => words.includes(p))) {
      const rest = asPhrase(lead[2], { ...st, ask: st.ask.filter((k) => k !== 'clientName') })
      return `${rest}, client name is ${lead[1]}`
    }
  }
  if (only === 'adults' && /^(?:a |just )?(?:couple|two of us)$/.test(t)) return '2 adults'
  if (only === 'destination' && !/\b(?:trip|tour|to|in)\b/.test(t)) return `trip to ${t}`
  if (only === 'clientName' && !/\b(?:client|name|for)\b/.test(t)) return `client name is ${t}`
  if (only === 'startDate' || st.ask.includes('startDate')) {
    // "the 20th" when the month is already known.
    const day = /^(?:on |from |the )*(\d{1,2})(?:st|nd|rd|th)?$/.exec(t)
    if (day && Number.isInteger(st.month)) return `starting ${day[1]} ${MONTHS[st.month]}`
    if (only === 'startDate' && !/^(?:from|starting|start|on)\b/.test(t)) return `starting ${t}`
  }
  return t
}

function evaluate(st, text, ctx) {
  Object.defineProperty(st, 'catalog', { value: ctx.catalog || {}, enumerable: false, configurable: true })
  const cmd = parseTripRequest(text, ctx.catalog || {}, { today: ctx.today, settings: ctx.settings })
  const need = cmd && cmd.intent === 'create_trip' ? briefNeeds(cmd, ctx.catalog || {}, text) : [...ORDER]
  return { cmd: cmd || {}, need }
}

function reply(st, cmd, need, lead = '') {
  // The name is asked along with the rest, once; it never holds the plan up.
  const askName = !cmd.clientName && !st.nameAsked && !st.nameSkipped
  if (askName) st.nameAsked = true
  st.ask = [...need, ...(askName ? ['clientName'] : [])]
  st.month = Number.isInteger(cmd.month) ? cmd.month : st.month
  st.places = [...regionWords(st.catalog || {}), ...hotelCities(st.catalog || {}).flatMap((c) => normTokens(c))]
  const got = heardLine(cmd, need)
  const opener = lead || (got ? `${got} — got it.` : "Let's plan it.")
  return `${opener} ${question(need, cmd, askName)}`
}

/**
 * A trip request on a blank trip. → { ready: true, text } when Ching knows
 * enough to plan it, else { state, say } with the one question to ask.
 */
export function startBrief(text, ctx = {}) {
  const st = { text: String(text || '').trim(), ask: [], month: null, nameAsked: false, nameSkipped: false, tries: 0 }
  const { cmd, need } = evaluate(st, st.text, ctx)
  if (!need.length) return { ready: true, text: st.text, state: st }
  return { ready: false, state: st, say: reply(st, cmd, need) }
}

/**
 * The agent's answer. → { handled, ready, text } | { handled, say } |
 * { handled: true, cancelled, say } | { handled: false, say } (not an answer:
 * the caller may treat it as something else, else say `say`).
 */
export function briefStep(st, answer, ctx = {}) {
  const t = clean(answer)
  if (STOP.test(t)) return { handled: true, cancelled: true, say: "Okay, I've dropped that trip." }
  const before = evaluate(st, st.text, ctx)
  if (SKIP.test(t) && st.ask.includes('clientName')) st.nameSkipped = true
  const phrase = asPhrase(answer, st)
  const text = st.text ? `${st.text}, ${phrase}` : phrase
  const after = evaluate(st, text, ctx)
  const gained = before.need.filter((k) => !after.need.includes(k)).length > 0
  // A name counts as an answer only when it was asked for, or said as one.
  const named = !before.cmd.clientName && !!after.cmd.clientName && (st.ask.includes('clientName') || /\b(?:client|name|guest|customer)\b/.test(t))
  const monthNow = !Number.isInteger(before.cmd.month) && Number.isInteger(after.cmd.month)
  if (!gained && !named && !monthNow && !st.nameSkipped) {
    st.tries += 1
    const q = question(before.need, before.cmd, false)
    return { handled: false, say: `Sorry, I didn't catch that. ${q}` }
  }
  if (gained || named || monthNow) st.text = text
  st.tries = 0
  if (!after.need.length) return { handled: true, ready: true, text: st.text }
  const now = gained || named || monthNow ? after : before
  return { handled: true, ready: false, say: reply(st, now.cmd, now.need) }
}

/**
 * Would this answer finish the brief? A dry run of briefStep (nothing kept):
 * lets the mic stop the moment the last missing piece is said.
 */
export function briefWouldPlan(st, answer, ctx = {}) {
  const probe = { ...st, ask: [...(st?.ask || [])] }
  const phrase = asPhrase(answer, probe)
  const text = probe.text ? `${probe.text}, ${phrase}` : phrase
  return evaluate(probe, text, ctx).need.length === 0
}

const DAY_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/**
 * What Ching has caught so far, to show while the agent is still speaking
 * ("Kashmir", "4 nights", "3 adults, 4 kids", "From 17 Oct"). `st` is the
 * pending brief, or null for a request that is just starting.
 */
export function briefHeard(st, said, ctx = {}) {
  const probe = st ? { ...st, ask: [...(st.ask || [])] } : { text: '', ask: [], month: null }
  const phrase = st ? asPhrase(said, probe) : String(said || '').trim()
  const text = probe.text ? `${probe.text}, ${phrase}` : phrase
  const { cmd, need } = evaluate(probe, text, ctx)
  if (!cmd || cmd.intent !== 'create_trip') return { lines: [], need }
  const lines = []
  if (cmd.clientName) lines.push(`Client: ${cmd.clientName}`)
  if (cmd.destinationName) lines.push(`Destination: ${cmd.destinationName}`)
  if (Number(cmd.nights) > 0) lines.push(`${plural(cmd.nights, 'night')} / ${cmd.nights + 1} days`)
  if (!need.includes('adults')) {
    const kids = Number(cmd.children) || 0
    lines.push(`Guests: ${plural(cmd.adults, 'adult')}${kids ? `, ${plural(kids, 'kid')}` : ''}`)
  }
  if (cmd.startDate) {
    const [y, m, d] = cmd.startDate.split('-').map(Number)
    lines.push(`From ${d} ${DAY_MONTH[m - 1]} ${y}`)
  }
  return { lines, need }
}

/** The question the brief is waiting on (to come back to after an aside). */
export function briefQuestion(st, ctx = {}) {
  const { cmd, need } = evaluate(st, st.text, ctx)
  return need.length ? question(need, cmd, false) : ''
}

/** "guide me step by step", "ask me one by one": the field-by-field interview. */
export const wantsStepByStep = (text) => /\b(?:step by step|one by one|field by field|guide me|ask me (?:everything|each|one)|guided)\b/.test(clean(text))

const TRIP_TALK = /\b(?:trip|tour|package|itinerary|holiday|holidays|vacation|honeymoon|getaway|visit|travel|travelling|traveling|going|ghumna|jana)\b/

/**
 * A request for a trip that names a place but no length yet ("Kashmir trip for
 * 4 people", "they want to visit Gulmarg in January").
 */
export function namesATrip(text, catalog) {
  const t = clean(text)
  if (!TRIP_TALK.test(t)) return false
  // "add a day trip to Sonamarg", "change the Gulmarg hotel": work on a trip, not a new one.
  if (/\b(?:day trip|excursion)\b/.test(t)) return false
  if (/^(?:(?:please|pls|now|also|and|then|ok|okay|ching|hey|can you|could you)\s+)*(?:add|change|remove|delete|set|move|swap|replace|update|put|book|cancel|open|show|find|search|send|email|download|export|save|mark)\b/.test(t)) return false
  const regions = regionWords(catalog || {})
  return normTokens(t).some((w) => regions.has(w)) || citiesSaid(t, catalog || {}).length > 0
}
