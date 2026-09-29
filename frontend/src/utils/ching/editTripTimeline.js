// Ching trip-edit timeline: inserting / deleting whole days consistently across
// hotels, day plan, cabs and activities, then re-titling the auto-titled days.
//
// The trip is a sequence of days; day d is startDate + (d - 1), and the night
// of day d belongs to the stay whose [checkIn, checkOut) contains that date.
import {
  addDays,
  diffDays,
  fmtDay,
  newId,
  sameName,
  getStays,
  hasDayPrefix,
  stripDayPrefix,
  dayLines,
  setLines,
  LEISURE_LINE,
  findDestination,
  cityLines,
  sameLines,
  plural,
} from './editTripUtil.js'

export const dateOfDay = (st, n) => addDays(st.s.tripInfo.startDate, n - 1)
export const dayOfDate = (st, date) => diffDays(st.s.tripInfo.startDate, date) + 1

export const isFullTripCab = (t) => /^\s*Full trip\s*:/i.test(String(t?.route || ''))

/** Title text ("X to Y") -> cab route ("X → Y"), exactly as buildTrip.js does. */
export const routeOf = (rest) => String(rest || '').replace(' to ', ' → ')
const cabTypeOf = (rest) => (/Sightseeing/.test(rest) ? 'Sightseeing' : 'Transfer')

const isKnown = (st, name) => !!name && st.known.has(String(name).trim().toLowerCase())
export const addKnown = (st, name) => {
  if (name) st.known.add(String(name).trim().toLowerCase())
}

/** Whether a title (without "Day N:") is one of Ching's auto patterns for known places. */
export function isAutoTitle(st, rest) {
  const t = String(rest || '').trim()
  let m = /^Arrival in (.+)$/i.exec(t)
  if (m) return isKnown(st, m[1])
  m = /^Departure from (.+)$/i.exec(t)
  if (m) return isKnown(st, m[1])
  m = /^(.+?) Sightseeing$/i.exec(t)
  if (m) return isKnown(st, m[1])
  m = /^(.+?) (?:to|→) (.+)$/i.exec(t)
  if (m) return isKnown(st, m[1]) && isKnown(st, m[2])
  return false
}

/** Ordered distinct cities of the current stays (for "Full trip: A → B" cab routes). */
export const staySequence = (st) =>
  getStays(st.s.accommodations)
    .map((a) => a.city)
    .filter((c, i, arr) => c && (i === 0 || !sameName(c, arr[i - 1])))

/** A per-day cab booking inside a stay's block (prefers a Sightseeing one). */
export function blockCab(st, acc) {
  const inBlock = (st.s.transportation || []).filter(
    (t) => !isFullTripCab(t) && t.date && t.date >= acc.checkIn && t.date < acc.checkOut,
  )
  return inBlock.find((t) => t.tripType === 'Sightseeing') || inBlock[inBlock.length - 1] || null
}

/** Any per-day cab booking on the trip (most common vehicle). */
export function anyDayCab(st) {
  const perDay = (st.s.transportation || []).filter((t) => !isFullTripCab(t))
  if (!perDay.length) return null
  const counts = new Map()
  perDay.forEach((t) => counts.set(String(t.vehicleId ?? t.vehicleType), (counts.get(String(t.vehicleId ?? t.vehicleType)) || 0) + 1))
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const same = perDay.filter((t) => String(t.vehicleId ?? t.vehicleType) === best)
  return same.find((t) => t.tripType === 'Sightseeing') || same[0]
}

function sightseeingCab(template, date, city) {
  return {
    id: newId(),
    vehicleId: template.vehicleId ?? null,
    tripType: 'Sightseeing',
    route: `${city} Sightseeing`,
    destination: city,
    date,
    vehicleType: template.vehicleType || '',
    quantity: template.quantity || 1,
    remarks: '',
    markupPercentage: template.markupPercentage ?? '',
  }
}

function newDay(st, city) {
  const dest = findDestination(st.catalog, city)
  const lines = cityLines(st.catalog, city)
  const day = {
    id: newId(),
    day: 0,
    title: `Day 0: ${city} Sightseeing`,
    location: city,
    destinationId: dest?.id ?? null,
    description: '',
    activities: [],
    photo: dest?.image_url || dest?.image_path || null,
  }
  setLines(day, lines.length ? lines : [LEISURE_LINE])
  return day
}

const shiftDayNumber = (value, by) => (typeof value === 'string' ? String(Number(value) + by) : Number(value) + by)
const numericDay = (value) => (value === '' || value == null ? NaN : Number(value))

/**
 * Insert k new days starting on `pivot` (the date the first new day falls on).
 * Every date >= pivot moves k days later (a check-out only when > pivot, so the
 * stay ending on the pivot keeps its dates — `extendAcc` is extended instead).
 * Returns the number of cab bookings added.
 */
export function insertDays(st, pivot, k, city, { extendAcc = null, cab = null } = {}) {
  const { s } = st
  const pivotDay = dayOfDate(st, pivot)

  for (const acc of s.accommodations) {
    if (acc === extendAcc) continue
    if (acc.checkIn && acc.checkIn >= pivot) acc.checkIn = addDays(acc.checkIn, k)
    if (acc.checkOut && acc.checkOut > pivot) acc.checkOut = addDays(acc.checkOut, k)
  }
  if (extendAcc) extendAcc.checkOut = addDays(extendAcc.checkOut, k)

  for (const t of s.transportation) {
    if (t.date && t.date >= pivot) t.date = addDays(t.date, k)
  }
  for (const a of s.tripActivities) {
    const n = numericDay(a.dayNumber)
    if (Number.isFinite(n) && n >= pivotDay) a.dayNumber = shiftDayNumber(a.dayNumber, k)
  }

  if (s.itinerary.length) {
    const at = Math.min(Math.max(pivotDay - 1, 0), s.itinerary.length)
    const days = Array.from({ length: k }, () => newDay(st, city))
    s.itinerary.splice(at, 0, ...days)
  }

  let added = 0
  if (cab) {
    for (let j = 0; j < k; j += 1) {
      s.transportation.push(sightseeingCab(cab, addDays(pivot, j), city))
      added += 1
    }
  }
  return added
}

/**
 * Delete k days starting on date d0. Dates inside the range collapse onto d0
 * (cancelled hotels) or are removed (cabs); later dates move k days earlier.
 * Returns the number of cab bookings removed.
 */
export function deleteRange(st, d0, k) {
  const { s } = st
  const end = addDays(d0, k)
  const fromDay = dayOfDate(st, d0)
  const map = (d) => (!d || d < d0 ? d : d >= end ? addDays(d, -k) : d0)

  for (const acc of s.accommodations) {
    acc.checkIn = map(acc.checkIn)
    acc.checkOut = map(acc.checkOut)
  }

  let removed = 0
  s.transportation = s.transportation.filter((t) => {
    if (t.date && t.date >= d0 && t.date < end && !isFullTripCab(t)) {
      removed += 1
      return false
    }
    t.date = map(t.date)
    return true
  })

  for (const a of s.tripActivities) {
    const n = numericDay(a.dayNumber)
    if (!Number.isFinite(n)) continue
    if (n >= fromDay && n < fromDay + k) {
      a.dayNumber = ''
      st.warnings.push(`${a.name || 'An activity'} was on day ${n}, which was removed — pick a new day for it`)
    } else if (n >= fromDay + k) {
      a.dayNumber = shiftDayNumber(a.dayNumber, -k)
    }
  }

  const from = Math.max(fromDay - 1, 0)
  const to = Math.min(fromDay - 1 + k, s.itinerary.length)
  if (to > from) {
    const gone = s.itinerary.splice(from, to - from)
    gone.forEach((day, i) => {
      const rest = stripDayPrefix(day.title)
      if (rest && !isAutoTitle(st, rest)) {
        st.warnings.push(`Removed day ${from + i + 1} "${rest}" (it had a custom plan)`)
      }
    })
  }
  return removed
}

/**
 * Renumber the day plan, rewrite "Day N:" prefixes and re-title the days that
 * still carry an auto title from the current city sequence. Cab bookings whose
 * route was derived from the old title follow the new one.
 */
export function retitle(st) {
  const { s, catalog } = st
  const days = s.itinerary
  const N = days.length
  if (!N) return
  const stays = getStays(s.accommodations)
  const cities = []
  for (let i = 0; i < N; i += 1) {
    const date = dateOfDay(st, i + 1)
    const stay = stays.find((a) => a.checkIn && a.checkOut && a.checkIn <= date && date < a.checkOut)
    cities[i] = stay?.city || cities[i - 1] || days[i].location || ''
  }
  const lastNight = N >= 2 ? cities[N - 2] : cities[0]

  days.forEach((day, i) => {
    const n = i + 1
    const oldTitle = String(day.title || '')
    const rest = stripDayPrefix(oldTitle)
    day.day = n
    if (!isAutoTitle(st, rest)) {
      if (hasDayPrefix(oldTitle)) day.title = `Day ${n}: ${rest}`
      return
    }
    const here = cities[i]
    let next
    if (n === 1 && N > 1) next = `Arrival in ${here}`
    else if (n === N) next = `Departure from ${lastNight}`
    else if (cities[i - 1] && !sameName(cities[i - 1], here)) next = `${cities[i - 1]} to ${here}`
    else next = `${here} Sightseeing`
    const loc = n === N ? lastNight : here
    day.title = `Day ${n}: ${next}`
    if (next === rest && sameName(loc, day.location)) return

    // Cab bookings generated from the old title follow the new one.
    const date = dateOfDay(st, n)
    if (next !== rest) {
      for (const t of s.transportation) {
        if (t.date === date && t.route === routeOf(rest)) {
          t.route = routeOf(next)
          t.tripType = cabTypeOf(next)
          t.destination = loc
        }
      }
    }
    if (!sameName(loc, day.location)) {
      const oldLoc = day.location
      const lines = dayLines(day)
      const oldDefault = cityLines(catalog, oldLoc)
      if (oldLoc && lines.length && oldDefault.length && sameLines(lines, oldDefault)) {
        const fresh = cityLines(catalog, loc)
        setLines(day, n === N ? [] : fresh.length ? fresh : [LEISURE_LINE])
      } else if (oldLoc && lines.length && !(lines.length === 1 && sameName(lines[0], LEISURE_LINE))) {
        st.warnings.push(`Day ${n} is now in ${loc} but its plan still lists the ${oldLoc} activities — check it`)
      }
      const dest = findDestination(catalog, loc)
      day.location = loc
      day.destinationId = dest?.id ?? null
      if (!Array.isArray(day.activities)) setLines(day, dayLines(day))
      else day.description = day.activities.join('\n')
    }
  })
}

/** After any structural edit: re-title days and keep a per-trip cab's route in step. */
export function finishStructural(st, beforeSequence) {
  retitle(st)
  const before = `Full trip: ${beforeSequence.join(' → ')}`
  const after = `Full trip: ${staySequence(st).join(' → ')}`
  if (before === after) return
  for (const t of st.s.transportation) if (t.route === before) t.route = after
}

/** "1 cab booking added (13 Nov)" style change lines. */
export function cabLine(st, added, removed, dates = []) {
  if (added) {
    const when = dates.length ? ` (${dates.map((d) => fmtDay(d)).join(', ')})` : ''
    st.changes.push(`Cabs: ${plural(added, 'sightseeing booking')} added${when}`)
  }
  if (removed) st.changes.push(`Cabs: ${plural(removed, 'booking')} removed with the dropped days`)
}
