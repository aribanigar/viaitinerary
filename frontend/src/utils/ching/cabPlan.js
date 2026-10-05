// Day-wise cab bookings — one row per day of the plan, shared by the voice fill
// (buildTrip.js) and voice editing (editTrip.js SET_VEHICLE).
//
// The Trip Builder prices every booking at vehicle price × quantity. A cab
// with a per-trip rate is therefore priced on day 1 only; the other days still
// get their own row (route, date, city) so the Logistics tab and the PDF read
// day by day, but carry no vehicleId (no price) and say they're included.

export const INCLUDED_NOTE = 'Included in the full-trip cab rate'

export const isIncludedCab = (t) => !t?.vehicleId && String(t?.remarks || '') === INCLUDED_NOTE

const stripDay = (title) => String(title || '').replace(/^Day\s*\d+\s*:\s*/i, '')

/** Day title → cab route: "Srinagar to Gulmarg" → "Srinagar → Gulmarg". */
export const cabRouteOf = (title) => stripDay(title).replace(' to ', ' → ')

/**
 * days: [{ day, title, location }] in order; vehicle: catalog vehicle
 * ({ id, name, rate_type }); dateOf(n) → "YYYY-MM-DD" of day n; newId() → id.
 */
// A day whose title is just its destination ("Day 2: Gulmarg", from the
// Itinerary tab's "Add Day from Destination"): the cab's route is worked out
// from where the guests slept the night before and sleep that night —
//   first day → "Arrival in Srinagar", last day → "Departure from Srinagar",
//   same city → "Srinagar Sightseeing", out and back to the same hotel →
//   "Srinagar → Gulmarg → Srinagar" (Day Trip), a move → "Srinagar → Gulmarg".
const norm = (s) => String(s || '').toLowerCase().replace(/,.*$/, '').replace(/\b(?:city|town|district)\b/g, '').replace(/[^a-z]/g, '')
const same = (a, b) => !!a && !!b && norm(a) === norm(b)
export function plainDestinationDay(d) {
  const t = stripDay(d.title)
  return !t || same(t, d.location) || same(t, d.destination)
}
export function routeForDay(days, i, nightCity = () => '') {
  const d = days[i]
  const loc = d.location || d.destination || ''
  const last = days.length - 1
  const before = i > 0 ? nightCity(i - 1) || days[i - 1].location || '' : ''
  const tonight = i < last ? nightCity(i) || loc : ''
  if (i === 0) return { route: tonight && loc && !same(loc, tonight) ? `Arrival in ${loc} → ${tonight}` : `Arrival in ${tonight || loc}`, tripType: 'Transfer' }
  if (i === last && days.length > 1) {
    return { route: before && loc && !same(before, loc) ? `Departure: ${before} → ${loc}` : `Departure from ${before || loc}`, tripType: 'Transfer' }
  }
  if (same(loc, before) && (!tonight || same(tonight, loc))) return { route: `${loc} Sightseeing`, tripType: 'Sightseeing' }
  if (before && tonight && same(tonight, before) && !same(loc, before)) return { route: `${before} → ${loc} → ${before}`, tripType: 'Day Trip' }
  if (before && !same(before, loc)) return { route: `${before} → ${loc}`, tripType: 'Transfer' }
  return { route: `${loc} Sightseeing`, tripType: 'Sightseeing' }
}

/**
 * nightCity(i) (optional) → the city the guests sleep in on the night after
 * day i (from the hotels), used to route plain destination days.
 */
export function dayWiseCabs({ days, vehicle, dateOf, newId, quantity = 1, nightCity = null }) {
  const perTrip = vehicle?.rate_type === 'per_trip'
  const cities = [...new Set(days.map((d) => d.location).filter(Boolean))]
  return days.map((d, i) => {
    // A day plan (dayPlan.js) carries its own route ("Srinagar → Sonamarg → Srinagar");
    // a day that is just its destination gets one worked out from the nights.
    const derived = !d.route && plainDestinationDay(d) ? routeForDay(days, i, nightCity || (() => '')) : null
    const route = d.route || derived?.route || cabRouteOf(d.title)
    const priced = !perTrip || i === 0
    return {
      id: newId(),
      vehicleId: priced ? vehicle.id : null,
      tripType: d.tripType || derived?.tripType || (/day trip|excursion/i.test(route) ? 'Day Trip' : /Sightseeing|leisure/i.test(route) ? 'Sightseeing' : 'Transfer'),
      route,
      destination: d.location || '',
      date: dateOf(Number(d.day) || i + 1),
      vehicleType: vehicle.name,
      quantity: Math.max(1, Number(quantity) || 1),
      remarks: perTrip ? (priced ? `Full-trip rate${cities.length > 1 ? `: ${cities.join(' → ')}` : ''}` : INCLUDED_NOTE) : '',
      markupPercentage: '',
    }
  })
}

/** Re-point existing bookings at `vehicle`, keeping the per-trip pricing rule above. */
export function repriceCabs(cabs, vehicle) {
  const perTrip = vehicle?.rate_type === 'per_trip'
  const sorted = cabs.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const first = sorted[0]
  cabs.forEach((t) => {
    const priced = !perTrip || t === first
    t.vehicleId = priced ? vehicle.id : null
    t.vehicleType = vehicle.name
    if (perTrip) t.remarks = priced ? (t.remarks === INCLUDED_NOTE ? '' : t.remarks) || 'Full-trip rate' : INCLUDED_NOTE
    else if (t.remarks === INCLUDED_NOTE || /^Full-trip rate/.test(t.remarks || '')) t.remarks = ''
  })
}

/**
 * After day edits: a per-trip cab whose priced (day 1) row was deleted would
 * drop out of the total — promote its earliest remaining row to carry the price.
 */
export function keepPerTripPriced(cabs, vehicles) {
  const byName = new Map()
  cabs.filter(isIncludedCab).forEach((t) => byName.set(t.vehicleType, true))
  for (const name of byName.keys()) {
    if (cabs.some((t) => t.vehicleType === name && t.vehicleId)) continue
    const v = (vehicles || []).find((x) => x.name === name)
    const first = cabs
      .filter((t) => t.vehicleType === name)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0]
    if (v && first) {
      first.vehicleId = v.id
      first.remarks = 'Full-trip rate'
    }
  }
}
