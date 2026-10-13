// A CLIENT's own words — a WhatsApp voice note played to Ching, or its text
// pasted in: "Hi, so I'm planning to be in Kashmir from the 26th of November
// until the 30th… I want to stay for 2 days in Gulmarg and one day in Sonmarg…
// we are four people and one infant… okay with one room… decent hotels, three
// or four stars… do the gondola on the 27th… departure from Srinagar railway
// station." That is a story, not a dictated spec, and the trip parser
// (parseCommand.js) reads it badly: it was written for an agent's short
// requests. So the story is read here for its facts and rewritten as the
// plain request the parser already understands:
//   "kashmir trip, 4 adults 1 infant, starting 26 november 2026, 4 nights,
//    1 night in srinagar, 2 nights in gulmarg, 1 night in sonamarg, 1 room,
//    2 extra beds, 3 star, add gondola phase 1 on day 2"
// Only what the client said goes in; nothing is invented. Pure, no network.
import { extractDate, extractDateRange } from './dates.js'
import { convertNumberWords, normalizeTripWords, titleCase } from './text.js'
import { levRatio, normTokens } from './fuzzy.js'
import { placeKey, samePlace } from './places.js'
import { GAZETTEER, GATEWAYS } from './geo.js'
import { readWishes } from './meaning.js'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const ONE = '(?:\\d{1,2}|a|an|one)'
const num = (w) => (/^\d+$/.test(w) ? Number(w) : 1)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const clean = (t) =>
  normalizeTripWords(convertNumberWords(String(t || '').toLowerCase().replace(/[‘’]/g, "'")))
    .replace(/\bp\.\s?m\.?/g, 'pm')
    .replace(/\ba\.\s?m\.?/g, 'am')
    .replace(/\s+/g, ' ')
    .trim()

// Someone telling their own plans: "I'm planning", "we are 4 people", "my parents".
const FIRST_PERSON = /\b(?:i'?m|i am|i'll|i will|i want|i would|i'd|i was|we are|we're|we want|we would|we'd|we will|we'll|we have|we need|planning to|plan to|looking (?:for|to)|my (?:parents|wife|husband|family|sister|brother|baby|kids?|children|son|daughter|mother|father|friends?)|let me know|all (?:\d+|of us))\b/g

/** A client's story rather than an agent's request? (long, told in the first person) */
export function isNarrative(text) {
  const t = clean(text)
  const words = t.split(' ').length
  if (words < 18) return false
  const hits = (t.match(FIRST_PERSON) || []).length
  return hits >= 2 || (hits >= 1 && words >= 40)
}

/**
 * A story has begun and may run on for a minute or two, with pauses: the mic
 * should wait for it to end instead of answering at the first breath.
 */
export function soundsLikeAStory(text) {
  const t = clean(text)
  return t.split(' ').length >= 8 && (t.match(FIRST_PERSON) || []).length > 0
}

// ── places ───────────────────────────────────────────────────────────────────
function placeNames(catalog) {
  const names = [
    ...(catalog?.hotels || []).map((h) => String(h?.city || '').split(',')[0].trim()),
    ...(catalog?.destinations || []).map((d) => d?.name),
  ].filter(Boolean)
  const seen = []
  for (const n of names) if (!seen.some((s) => samePlace(s, n))) seen.push(n)
  return seen
}
const regionsOf = (catalog) => {
  const out = new Set(Object.values(GAZETTEER).map((g) => String(g[2]).toLowerCase()))
  for (const d of catalog?.destinations || []) for (const w of normTokens(String(d?.state || ''))) if (w.length >= 5 && !['jammu', 'pradesh'].includes(w)) out.add(w)
  return out
}

/** Place names as the speech engine wrote them → the catalog's ("sonmarg" → "sonamarg"). */
function fixPlaces(t, places) {
  const keys = places.map((p) => placeKey(p)).filter((k) => k && !k.includes(' '))
  return t.replace(/[a-z]{5,}/g, (w) => {
    if (keys.includes(w)) return w
    const hit = keys.find((k) => Math.abs(k.length - w.length) <= 2 && k[0] === w[0] && levRatio(w, k) >= 0.8)
    return hit || w
  })
}

// ── the facts ────────────────────────────────────────────────────────────────
function readParty(t) {
  // "we are 4 people", "4 of us", "family of 6", "there will be 3 adults"
  const grown = /\b(?:we are|we're|we will be|there (?:are|will be)|total(?: of)?|group of|family of|party of)\s+(\d{1,2})\s*(?:people|persons?|pax|adults?|members|of us|guests)?\b/.exec(t) ||
    /\b(\d{1,2})\s+(?:people|persons|pax|adults|of us|members|guests)\b/.exec(t)
  const adultsOnly = /\b(\d{1,2})\s+adults?\b/.exec(t)
  const couple = /\b(?:a couple|just (?:the )?two of us|me and my (?:wife|husband|partner))\b/.test(t)
  const kids = /\b(\d{1,2}|a|one)\s+(?:kids?|child|children)\b/.exec(t)
  // An infant is counted once however often the baby is mentioned.
  const infant = new RegExp(`\\b(${ONE})\\s+(?:infants?|bab(?:y|ies)|toddlers?)\\b`).exec(t) || (/\b(?:my|our|the) (?:baby|infant|toddler)\b/.test(t) ? ['', '1'] : null)
  const adults = adultsOnly ? Number(adultsOnly[1]) : grown ? Number(grown[1]) : couple ? 2 : 0
  return { adults, kids: kids ? num(kids[1]) : 0, infants: infant ? num(infant[1]) : 0 }
}

function readStays(t, places) {
  const alt = places.map((p) => esc(placeKey(p))).filter(Boolean).sort((a, b) => b.length - a.length).join('|')
  if (!alt) return []
  const found = []
  const take = (place, n, at) => {
    const name = places.find((p) => placeKey(p) === place)
    if (!name || found.some((f) => samePlace(f.city, name))) return
    found.push({ city: name, nights: n, at })
  }
  let m
  // "2 days in gulmarg", "one night at sonamarg"
  const a = new RegExp(`\\b(${ONE})\\s+(?:days?|nights?)\\s+(?:in|at)\\s+(${alt})\\b`, 'g')
  while ((m = a.exec(t))) take(m[2], num(m[1]), m.index)
  // "gulmarg for 2 nights"
  const b = new RegExp(`\\b(${alt})\\s+for\\s+(${ONE})\\s+(?:days?|nights?)\\b`, 'g')
  while ((m = b.exec(t))) take(m[1], num(m[2]), m.index)
  return found.sort((x, y) => x.at - y.at)
}

/** The town they land in / reach first ("once we reach the hotel in Srinagar"). */
function arrivalTown(t, places) {
  const alt = places.map((p) => esc(placeKey(p))).filter(Boolean).join('|')
  const m = new RegExp(`\\b(?:reach|reaching|arriv\\w+|land\\w*|check(?:ing)? in|first (?:day|night|evening))\\b[^.]{0,60}?\\b(${alt})\\b`).exec(t)
  if (m) return places.find((p) => placeKey(p) === m[1]) || null
  const said = places.filter((p) => new RegExp(`\\b${esc(placeKey(p))}\\b`).test(t))
  return said.find((p) => GATEWAYS.includes(placeKey(p))) || null
}

function readRooms(t, party) {
  const m = new RegExp(`\\b(${ONE}|single)\\s+rooms?\\b`).exec(t)
  if (!m) return null
  const rooms = m[1] === 'single' ? 1 : num(m[1])
  // "one room to accommodate all four of us": the others sleep on extra beds.
  const extraBeds = Math.max(0, (party.adults || 0) - rooms * 2)
  return { rooms, extraBeds }
}

function readClass(t) {
  const stars = [...t.matchAll(/\b([1-7])\s*-?\s*stars?\b/g)].map((m) => Number(m[1]))
  const no = '(?:not|no|nothing|don\'?t (?:want|need)|without)\\s+(?:\\w+\\s+){0,3}?'
  const lux = /\b(?:luxury|luxurious|premium|high[- ]?fi|hi[- ]?fi|fancy|lavish|five star)\b/
  const notLux = new RegExp(`\\b${no}(?:luxury|luxurious|premium|high[- ]?fi|hi[- ]?fi|fancy|lavish|expensive)\\b`).test(t)
  const budget = /\b(?:budget|cheap|cheapest|economy|affordable|low cost)\b/.test(t) && !new RegExp(`\\b${no}(?:budget|cheap)\\b`).test(t)
  if (stars.length) return { stars: Math.min(...stars), range: [...new Set(stars)].sort() }
  if (budget) return { tier: 'budget' }
  if (lux.test(t) && !notLux) return { tier: 'luxury' }
  return {}
}

/**
 * Things to do that the agency sells, with the day they were asked for. Of
 * several days offered ("the gondola on the 27th or the 28th") the one spent
 * wholly in that place is taken — not the day they drive in.
 */
function readActivities(t, catalog, startIso, nights, stays) {
  const out = []
  const sentences = t.split(/(?<=[.?!])\s+/)
  const start = startIso ? new Date(`${startIso}T00:00:00Z`) : null
  // Where they sleep each night (index 0 = the night of day 1).
  const sleep = stays.flatMap((s) => Array.from({ length: s.nights }, () => s.city))
  for (const act of catalog?.activities || []) {
    const words = normTokens(act?.name || '').filter((w) => w.length >= 4 && !/^(?:phase|ride|tour|visit|ticket|tickets|entry|with|and|full|half|day)$/.test(w))
    const word = words.find((w) => new RegExp(`\\b${esc(w)}`).test(t))
    if (!word) continue
    const s = sentences.find((x) => new RegExp(`\\b${esc(word)}`).test(x)) || ''
    const after = s.slice(s.search(new RegExp(`\\b${esc(word)}`)))
    const days = []
    if (start) {
      for (const m of after.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b/g)) {
        for (let n = 1; n <= (nights || 30) + 1; n += 1) {
          const d = new Date(start.getTime() + (n - 1) * 86400000)
          if (d.getUTCDate() === Number(m[1]) && !days.includes(n)) days.push(n)
        }
      }
    }
    const home = (catalog?.destinations || []).find((d) => String(d.id) === String(act.destination_id))?.name
    const whole = days.find((n) => home && sleep[n - 2] && sleep[n - 1] && samePlace(sleep[n - 2], home) && samePlace(sleep[n - 1], home))
    out.push({ name: act.name, day: whole || days[0] || null })
  }
  return out
}

function readEnds(t) {
  const out = {}
  const time = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b[^.]{0,30}\b(?:landing|arrival|arriving|flight lands?)\b|\b(?:landing|arrival|arriving|land(?:s|ing)? at|reach(?:ing)? (?:at|by))\b[^.]{0,30}?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(t)
  if (time) {
    const h = time[1] || time[4]
    const mm = time[2] || time[5]
    out.arrivalTime = `${h}${mm ? `:${mm}` : ''} ${(time[3] || time[6]).toUpperCase()}`
  }
  // Where they leave from: a station / airport said near a word of leaving.
  // The most exact mention wins ("Srinagar railway station" over "the railway station").
  const STOP = /^(?:the|a|from|to|at|and|then|morning|evening|night|go|going|our|my)$/
  let best = null
  for (const m of t.matchAll(/\b((?:[a-z]+ )?)(railway station|train station|airport|bus stand|bus station)\b/g)) {
    const around = t.slice(Math.max(0, m.index - 70), m.index + m[0].length + 40)
    if (!/\b(?:departure|departing|depart|leaving|leave|drop|go to|going to|back to|check ?out|return)\b/.test(around)) continue
    const lead = m[1].trim()
    const name = `${lead && !STOP.test(lead) ? `${lead} ` : ''}${m[2]}`
    if (!best || name.length > best.length) best = name
  }
  if (best) out.departFrom = titleCase(best)
  return out
}

const isoParts = (iso) => iso.split('-').map(Number)

/**
 * A client's story → { text (the plain request), client, arrivalTime,
 * departFrom, classRange, notes[] } — or null when it isn't one, or holds no
 * trip. catalog = builder/init shapes (+ activities).
 */
export function readNarrative(raw, catalog = {}, { today } = {}) {
  if (!isNarrative(raw)) return null
  const places = placeNames(catalog)
  const t = fixPlaces(clean(raw), places)
  const notes = []

  const range = extractDateRange(t, today)
  const single = range ? null : extractDate(t, today)
  const startIso = range?.iso || single?.iso || ''
  const saidNights = /\b(\d{1,2})\s*nights?\b(?!\s+(?:in|at)\b)/.exec(t)

  const party = readParty(t)
  let stays = readStays(t, places)
  const stayNights = stays.reduce((n, s) => n + s.nights, 0)
  let nights = range?.nights || (saidNights ? Number(saidNights[1]) : 0) || stayNights
  // The night they land isn't always counted ("2 days in Gulmarg and one in
  // Sonamarg" on a 4-night trip): it is spent where they arrive.
  const first = arrivalTown(t, places)
  if (stays.length && nights > stayNights && first && !stays.some((s) => samePlace(s.city, first))) {
    stays = [{ city: first, nights: nights - stayNights }, ...stays]
  } else if (first && stays.length > 1) {
    const i = stays.findIndex((s) => samePlace(s.city, first))
    if (i > 0) stays = [stays[i], ...stays.filter((_, k) => k !== i)]
  }
  if (!nights && !stays.length && !startIso && !party.adults) return null

  const region = normTokens(t).find((w) => regionsOf(catalog).has(w) && !places.some((p) => placeKey(p) === w))
  const rooms = readRooms(t, party)
  const cls = readClass(t)
  const ends = readEnds(t)
  const acts = readActivities(t, catalog, startIso, nights, stays)
  const name = /\b(?:my name is|this is|i am|i'm|myself)\s+((?:mr|mrs|ms|dr)\.? )?([a-z]+(?: [a-z]+)?)\b(?=\s*(?:,|\.|and|from|here|speaking|$))/.exec(t)
  const client = name && !/^(?:planning|looking|going|coming|travelling|traveling|interested|okay|ok|fine|here|also|not|so|just)\b/.test(name[2]) ? titleCase(`${name[1] || ''}${name[2]}`.replace(/\./g, '')) : ''

  const bits = [`${region || (stays.length === 1 ? placeKey(stays[0].city) : '')} trip`.trim()]
  if (party.adults) {
    bits.push(`${party.adults} adults${party.kids ? ` ${party.kids} kids` : ''}${party.infants ? ` ${party.infants} infant${party.infants > 1 ? 's' : ''}` : ''}`)
  }
  if (startIso) {
    const [y, m, d] = isoParts(startIso)
    bits.push(`starting ${d} ${MONTHS[m - 1]} ${y}`)
  }
  if (nights) bits.push(`${nights} nights`)
  for (const s of stays) bits.push(`${s.nights} night${s.nights === 1 ? '' : 's'} in ${placeKey(s.city)}`)
  if (rooms) {
    bits.push(`${rooms.rooms} room${rooms.rooms === 1 ? '' : 's'}`)
    if (rooms.extraBeds) bits.push(`${rooms.extraBeds} extra beds`)
    notes.push(rooms.extraBeds ? `${rooms.rooms} room for all ${party.adults}, with ${rooms.extraBeds} extra bed${rooms.extraBeds === 1 ? '' : 's'}, as the client asked` : `${rooms.rooms} room${rooms.rooms === 1 ? '' : 's'}, as the client asked`)
  }
  if (cls.stars) {
    bits.push(`${cls.stars} star`)
    if (cls.range.length > 1) notes.push(`Client asked for ${cls.range.join(' or ')} star: quoted ${cls.stars} star`)
  } else if (cls.tier) bits.push(`${cls.tier} hotels`)
  for (const a of acts) {
    if (a.day) bits.push(`add ${a.name.toLowerCase()} on day ${a.day}`)
    else notes.push(`Client mentioned ${a.name}: say which day to add it`)
  }
  if (ends.arrivalTime) notes.push(`Arrives ${ends.arrivalTime}`)
  if (ends.departFrom) notes.push(`Leaves from ${ends.departFrom}`)

  // What the stay should be like ("good views", "riverside", "my parents") is
  // read from the client's own words by the meaning tree (meaning.js).
  return { text: bits.filter(Boolean).join(', '), client, notes, classRange: cls.range || null, wishes: readWishes(t), ...ends }
}
