// Day-by-day routes for Ching: "day 1 arrival in Srinagar, day 2 Srinagar to
// Gulmarg, day 3 Gulmarg to Pahalgam, day 4 Pahalgam to Srinagar, day 6
// departure" → one entry per day (arrival / move / local / day trip / leisure /
// departure), gaps filled (day 5 = Srinagar sightseeing), then a full plan:
// each day's title, destination city (the Itinerary tab's picker), cab route,
// and where the travellers sleep — consecutive nights in one city become one
// hotel stay. Used by the voice fill (buildTrip.js) and by voice editing
// (editTrip.js SET_DAY_ROUTES). Pure JS.

const ORDINAL = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
}
// "day 2", "day no 2", "2nd day", "second day", "on the 3rd day", "last day"
const MARKER = new RegExp(
  `\\b(?:day\\s*(?:no\\.?\\s*|number\\s*)?(\\d{1,2})\\b|(\\d{1,2})(?:st|nd|rd|th)\\s+day\\b|(${Object.keys(ORDINAL).join('|')}|last|final)\\s+day\\b)`,
  'g',
)
// Clauses with these verbs are edits ("make day 3 a leisure day", "add shikara on day 2"), not routes.
const EDIT_VERB = /\b(?:add|remove|delete|make|replace|swap|drop|cancel|include|exclude|skip|book|put|give|set|change|reduce|increase|extend|shorten|clear|email|send|export|save|undo)\b/
// Before a marker these also mean "an edit about that day" ("move the sightseeing to day 4").
const LEAD_VERB = /\b(?:move|shift|on|for|from|in|of|to|into)\s*(?:the\s*)?$/
const DEPART = /\b(?:depart(?:ure|ing|s)?|drop\s+(?:at|to|off)\s+(?:the\s+)?airport|airport\s+drop|fly(?:ing)?\s+(?:back|home|out)|leave\s+for\s+home|return(?:ing)?\s+home|back\s+home|go(?:ing)?\s+home|check\s*out\s+and\s+leave|end\s+of\s+(?:the\s+)?trip)\b/
const ARRIVE = /\b(?:arriv(?:al|e|es|ing)|land(?:s|ing)?|pick\s*up|reach(?:es|ing)?\s+(?:at\s+)?(?:the\s+)?airport)\b/
const EXCURSION = /\b(?:day\s*trip|excursion|half\s*day\s+trip|full\s*day\s+trip)\b|\band\s+(?:come\s+)?back\b|\breturn\s+(?:to|back)\b/
const LEISURE = /\b(?:leisure|free\s+day|at\s+leisure|rest\s+day|relax(?:ing)?|day\s+off)\b/
const MOVE_VERB = /\b(?:to|towards|drive|transfer|move|proceed|travel|shift|head|go(?:ing)?|via|then)\b/

const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)

/** Cities named in a piece of text, in order, via findCity(words[]) → display name | ''. */
function citiesIn(text, findCity) {
  const w = words(text)
  const out = []
  for (let i = 0; i < w.length; i += 1) {
    for (let len = Math.min(3, w.length - i); len >= 1; len -= 1) {
      const name = findCity(w.slice(i, i + len))
      if (name) {
        if (!out.length || out[out.length - 1] !== name) out.push(name)
        i += len - 1
        break
      }
    }
  }
  return out
}

/** One day's words → { kind, from, to, city } or null. */
export function classifyDay(text, findCity) {
  const t = ` ${String(text || '').toLowerCase()} `
  const cities = citiesIn(t, findCity)
  const first = cities[0] || null
  const last = cities[cities.length - 1] || null
  if (DEPART.test(t)) return { kind: 'departure', from: cities.length > 1 ? first : null, to: last }
  if (ARRIVE.test(t)) return { kind: 'arrival', from: cities.length > 1 ? first : null, to: last }
  if (cities.length && EXCURSION.test(t)) {
    // "day trip to Sonamarg", "Srinagar to Sonamarg and back"
    return { kind: 'excursion', from: cities.length > 1 ? first : null, to: last }
  }
  if (LEISURE.test(t)) return { kind: 'leisure', city: last }
  if (cities.length >= 2) return { kind: 'move', from: first, to: last }
  if (cities.length === 1) {
    // "drive to Gulmarg" (move from wherever they are) vs "Gulmarg" / "Gulmarg sightseeing".
    const before = t.slice(0, t.indexOf(first.toLowerCase().split(' ')[0]))
    if (/\b(?:to|towards|drive|transfer|move|proceed|travel|shift|head|go)\s+(?:to\s+)?$/.test(before.trimEnd() + ' ')) {
      return { kind: 'move', from: null, to: first }
    }
    return { kind: 'local', city: first }
  }
  return null
}

/**
 * Spoken text → { entries: { [day]: entry }, departureDay, claimed: [[start, end]] } or null.
 * edit: clauses carrying an edit verb are left alone (they're other edits);
 * minMarkers: how many "day N" markers make it a day plan (fill: 2, edit: 1).
 */
export function parseDayPlan(text, findCity, { minMarkers = 2, edit = false } = {}) {
  const s = String(text || '').toLowerCase()
  const marks = []
  let m
  MARKER.lastIndex = 0
  while ((m = MARKER.exec(s))) {
    const word = m[3]
    const day = m[1] ? +m[1] : m[2] ? +m[2] : ORDINAL[word] || 'last'
    marks.push({ day, at: m.index, end: m.index + m[0].length })
  }
  if (marks.length < minMarkers) return null
  const entries = {}
  const claimed = []
  let departureDay = null
  marks.forEach((mk, i) => {
    // The day's words run to the next marker (or the end), cut at a hard break.
    let end = i + 1 < marks.length ? marks[i + 1].at : s.length
    const tail = s.slice(mk.end, end)
    // The last day also ends where the other trip details start ("… day 4
    // Srinagar for Rahul, 2 adults"), so the client and guests aren't swallowed.
    const stop = tail.search(/[.;!?]|\|\s*\||\b(?:for|client|customer|starting|phone|mobile|email)\b|\b\d+\s+(?:adults?|kids?|child(?:ren)?|infants?|pax|people|persons|guests?)\b/)
    if (stop > 0 && i + 1 >= marks.length) end = mk.end + stop
    const body = s.slice(mk.end, end).replace(/^[\s,:-]*(?:is|will be|should be|=)?\s*/, '')
    if (edit) {
      // The clause around the marker: from the last comma / "and then" before it.
      const lead = s.slice(Math.max(0, mk.at - 40), mk.at)
      const leadClause = lead.split(/[,;|]|\band then\b|\bthen\b/).pop()
      if (EDIT_VERB.test(leadClause) || /\b(?:move|shift)\b/.test(leadClause) || LEAD_VERB.test(leadClause) || EDIT_VERB.test(body.split(/[,;|]/)[0])) return
    }
    const entry = classifyDay(body, findCity)
    if (!entry) return
    if (edit && entry.kind === 'leisure' && !entry.city) return // "a leisure day" is SET_DAY_LEISURE's job
    const day = mk.day === 'last' ? 'last' : mk.day
    if (entry.kind === 'departure') departureDay = day
    entries[day] = entry
    claimed.push([mk.at, end])
  })
  const routeLike = Object.values(entries).filter((e) => e.kind !== 'local' || e.city).length
  if (!routeLike || Object.keys(entries).length < Math.min(minMarkers, 2) && !edit) return null
  return { entries, departureDay, claimed }
}

/** Strip the claimed day clauses out of a text (so other parsers don't re-read them). */
export function withoutClaimed(text, claimed) {
  let out = String(text || '')
  ;[...claimed].sort((a, b) => b[0] - a[0]).forEach(([a, b]) => {
    out = `${out.slice(0, a)} | ${out.slice(b)}`
  })
  return out
}

/**
 * entries + context → the plan.
 * opts: { base: [{ overnight, title, location, keep }] (current trip, edit mode),
 *         nights: total nights wanted (fill mode, optional), firstCity }
 * → { days: [{ day, kind, title, location, route, tripType, overnight, changed }],
 *     stays: [{ city, nights, fromDay }], nights }
 */
export function buildDayPlan(parsed, { base = [], nights: wantNights = 0, firstCity = '' } = {}) {
  const entries = { ...(parsed?.entries || {}) }
  const numbered = Object.keys(entries).filter((k) => k !== 'last').map(Number)
  let maxDay = Math.max(0, ...numbered, base.length)
  let lastDay
  const depEntry = Object.entries(entries).find(([, e]) => e.kind === 'departure')
  if (depEntry) {
    lastDay = depEntry[0] === 'last' ? Math.max(maxDay + (entries.last && numbered.includes(maxDay) ? 1 : 0), wantNights + 1, 2) : Number(depEntry[0])
    if (depEntry[0] === 'last') {
      entries[lastDay] = entries.last
      delete entries.last
    }
  } else if (wantNights) {
    lastDay = Math.max(wantNights + 1, base.length)
    if (numbered.some((d) => d >= lastDay)) lastDay = Math.max(...numbered) + 1
  } else if (base.length && !numbered.some((d) => d >= base.length)) {
    lastDay = base.length
  } else {
    lastDay = maxDay + 1 // nobody said "departure": the day after the last one said
  }
  if (entries.last) {
    entries[lastDay] = entries.last
    delete entries.last
  }
  lastDay = Math.max(lastDay, 2)

  const days = []
  let prev = firstCity || base[0]?.overnight || ''
  for (let d = 1; d <= lastDay; d += 1) {
    let e = entries[d] || null
    const b = base[d - 1] || null
    const isLast = d === lastDay
    let changed = !!e
    if (!e) {
      const prevSame = d === 1 || prev === (base[d - 2]?.overnight ?? null) || (d > 1 && !base[d - 2])
      if (b && prevSame && (b.overnight || isLast)) {
        // Untouched day whose start didn't move: keep it exactly as it is (edit mode).
        days.push({ day: d, kind: b.overnight ? 'keep' : 'departure', title: b.title, location: b.location || b.overnight || prev, route: null, tripType: null, overnight: isLast ? null : b.overnight, changed: false })
        if (b.overnight && !isLast) prev = b.overnight
        continue
      }
      if (isLast) e = { kind: 'departure', from: null, to: null }
      else if (b?.overnight && b.overnight !== prev) e = { kind: 'move', from: prev, to: b.overnight }
      else e = { kind: 'local', city: b?.overnight || prev }
      changed = true
    }
    if (d === 1 && (e.kind === 'local' || e.kind === 'move')) e = { kind: 'arrival', from: e.kind === 'move' ? e.from : null, to: e.to || e.city }
    let kind = e.kind
    let overnight = null
    let title
    let route
    let tripType = 'Transfer'
    let location
    if (kind === 'departure' || (isLast && kind !== 'departure')) {
      // The last day: leave from where they slept (a "Pahalgam to Srinagar" last day ends at the airport).
      const from = e.kind === 'departure' ? e.from || prev : e.from || prev
      const to = e.kind === 'departure' ? e.to : e.to || e.city
      kind = 'departure'
      if (to && from && to !== from) {
        title = `${from} to ${to} · Departure`
        route = `${from} → ${to} (departure)`
      } else {
        title = `Departure from ${from || to || prev}`
        route = title
      }
      location = to || from || prev
    } else if (kind === 'arrival') {
      overnight = e.to || prev
      title = e.from && e.from !== overnight ? `Arrival in ${e.from}, transfer to ${overnight}` : `Arrival in ${overnight}`
      route = e.from && e.from !== overnight ? `${e.from} → ${overnight}` : title
      location = overnight
    } else if (kind === 'move') {
      const from = e.from || prev
      overnight = e.to
      title = from && from !== overnight ? `${from} to ${overnight}` : `${overnight} Sightseeing`
      route = from && from !== overnight ? `${from} → ${overnight}` : title
      tripType = from && from !== overnight ? 'Transfer' : 'Sightseeing'
      location = overnight
    } else if (kind === 'excursion') {
      overnight = e.from && e.from !== e.to ? e.from : prev
      title = `Day trip to ${e.to}`
      route = `${overnight} → ${e.to} → ${overnight}`
      tripType = 'Day Trip'
      location = e.to
    } else if (kind === 'leisure') {
      overnight = e.city || prev
      title = `Leisure day in ${overnight}`
      route = `${overnight} (at leisure)`
      tripType = 'Sightseeing'
      location = overnight
    } else {
      overnight = e.city || prev
      title = `${overnight} Sightseeing`
      route = title
      tripType = 'Sightseeing'
      location = overnight
    }
    days.push({ day: d, kind, title, location, route, tripType, overnight, changed })
    if (overnight) prev = overnight
  }

  // Consecutive nights in one city → one stay.
  const stays = []
  days.forEach((d) => {
    if (!d.overnight || d.kind === 'departure') return
    const last = stays[stays.length - 1]
    if (last && last.city === d.overnight && last.fromDay + last.nights === d.day) last.nights += 1
    else stays.push({ city: d.overnight, nights: 1, fromDay: d.day })
  })
  return { days, stays, nights: days.length - 1 }
}
