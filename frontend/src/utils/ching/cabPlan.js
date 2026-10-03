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
export function dayWiseCabs({ days, vehicle, dateOf, newId }) {
  const perTrip = vehicle?.rate_type === 'per_trip'
  const cities = [...new Set(days.map((d) => d.location).filter(Boolean))]
  return days.map((d, i) => {
    // A day plan (dayPlan.js) carries its own route ("Srinagar → Sonamarg → Srinagar").
    const route = d.route || cabRouteOf(d.title)
    const priced = !perTrip || i === 0
    return {
      id: newId(),
      vehicleId: priced ? vehicle.id : null,
      tripType: d.tripType || (/Sightseeing|day trip|leisure/i.test(route) ? 'Sightseeing' : 'Transfer'),
      route,
      destination: d.location || '',
      date: dateOf(Number(d.day) || i + 1),
      vehicleType: vehicle.name,
      quantity: 1,
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
