// Phase 4 — "make it cheaper" / "optimise this trip" and add-on suggestions.
// Pure: looks at the open trip and the agency's own catalog, never invents.
//
// cheaperPlan(snapshot, catalog, settings) → { suggestions, actions, saving }
//   - a hotel → the best-rated cheaper hotel in the same city (same star rating
//     first, one star down at most), at least ₹300/room/night cheaper;
//   - the cab → a cheaper vehicle that still seats the group (per-day vs per-trip
//     compared on the whole trip);
//   - activities are listed as optional savings, not removed.
//   `actions` are ordinary ching-edit actions (REPLACE_HOTEL / SET_VEHICLE), so
//   applying them goes through the same engine (and undo) as a spoken edit.
// addOnSuggestions(snapshot, catalog) → catalog activities in the trip's cities
//   that aren't on the trip yet, grouped by city with the first day there.
import { hotelInCity, samePlace } from './places.js'
import { getStays, nightsOf, sortDays } from './editTripUtil.js'
import { isIncludedCab } from './cabPlan.js'
import { tripActivityTotal } from '../activityRates.js'

const firstPrice = (h) => Number((h?.price_sections || [])[0]?.price) || 0
const stars = (v) => Number(String(v || '').match(/\d/)?.[0]) || 0
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const MIN_SAVING_PER_NIGHT = 300

/** What the client pays per rupee of cost (margin, then GST). */
function clientFactor(snapshot) {
  const m = Number(snapshot?.profitMarginPercentage) || 0
  const g = snapshot?.includeGST ? Number(snapshot?.gstPercentage) || 0 : 0
  return (1 + m / 100) * (1 + g / 100)
}

export function cheaperPlan(snapshot, catalog = {}) {
  const s = snapshot || {}
  const hotels = catalog.hotels || []
  const vehicles = catalog.vehicles || []
  const suggestions = []
  const actions = []

  getStays(s.accommodations || []).forEach((acc, index) => {
    const nights = nightsOf(acc) || 1
    const rooms = Math.max(1, Number(acc.rooms) || 1)
    const now = Number(acc.pricePerRoom) || 0
    if (!now) return
    const myStars = stars(acc.category)
    const pool = hotels.filter(
      (h) =>
        String(h.id) !== String(acc.hotelId) &&
        h.is_available !== false &&
        hotelInCity(h, acc.city) &&
        firstPrice(h) > 0 &&
        now - firstPrice(h) >= MIN_SAVING_PER_NIGHT &&
        (!myStars || stars(h.category) >= myStars - 1),
    )
    if (!pool.length) return
    // Same star rating first, then the dearest of the cheaper ones (smallest step down).
    pool.sort((a, b) => (stars(b.category) === myStars) - (stars(a.category) === myStars) || firstPrice(b) - firstPrice(a))
    const h = pool[0]
    const saving = (now - firstPrice(h)) * rooms * nights
    suggestions.push({
      kind: 'hotel',
      city: acc.city,
      from: acc.name,
      to: h.name,
      saving,
      note: stars(h.category) < myStars ? `${stars(h.category)}★ instead of ${myStars}★` : null,
    })
    actions.push({ type: 'REPLACE_HOTEL', stay: index, hotelId: h.id, hotelName: h.name, city: h.city || acc.city })
  })

  const cabs = s.transportation || []
  if (cabs.length) {
    const guests = (Number(s.tripInfo?.adults) || 0) + (Number(s.tripInfo?.kids5to12) || 0)
    const priced = cabs.filter((t) => t.vehicleId && !isIncludedCab(t))
    const current = priced[0] ? vehicles.find((v) => String(v.id) === String(priced[0].vehicleId)) : null
    if (current) {
      const days = cabs.length
      const costOf = (v) => (v.rate_type === 'per_trip' ? Number(v.price) || 0 : (Number(v.price) || 0) * days)
      const now = costOf(current)
      const better = vehicles
        .filter((v) => String(v.id) !== String(current.id) && v.is_available !== false && Number(v.price) > 0)
        .filter((v) => !guests || !Number(v.seating_capacity) || Number(v.seating_capacity) >= guests)
        .map((v) => ({ v, cost: costOf(v) }))
        .filter((x) => now - x.cost >= 500)
        .sort((a, b) => b.cost - a.cost)[0]
      if (better) {
        suggestions.push({ kind: 'cab', from: current.name, to: better.v.name, saving: now - better.cost })
        actions.push({ type: 'SET_VEHICLE', vehicleId: better.v.id, vehicleName: better.v.name })
      }
    }
  }

  const acts = (s.tripActivities || []).map((a) => ({
    name: a.name,
    cost: tripActivityTotal(a),
  }))
  const optional = acts.filter((a) => a.cost > 0).sort((a, b) => b.cost - a.cost)

  const factor = clientFactor(s)
  const saving = suggestions.reduce((n, x) => n + x.saving, 0)
  return {
    suggestions,
    actions,
    saving,
    clientSaving: Math.round(saving * factor),
    optional: optional.slice(0, 2).map((a) => ({ ...a, clientCost: Math.round(a.cost * factor) })),
    margin: Number(s.profitMarginPercentage) || 0,
  }
}

/** One sentence for Ching to say about a cheaper plan. */
export function cheaperReply(plan) {
  const parts = plan.suggestions.map((x) =>
    x.kind === 'hotel' ? `${x.city}: ${x.from} → ${x.to}${x.note ? ` (${x.note})` : ''}, saves ${money(x.saving)}` : `${x.from} → ${x.to}, saves ${money(x.saving)}`,
  )
  if (!parts.length) {
    const extra = plan.optional.length ? ` Dropping ${plan.optional[0].name} would save about ${money(plan.optional[0].clientCost)}.` : ''
    const margin = plan.margin ? ` Or I can lower your ${plan.margin}% margin — say “give me 10% margin”.` : ''
    return `This is already the leanest version I can build from your catalog.${extra}${margin}`
  }
  return `I can bring it down by about ${money(plan.clientSaving)} for the client: ${parts.join('; ')}. Shall I apply it? Say yes or no.`
}

/** Catalog activities for the trip's cities that aren't on it yet. */
export function addOnSuggestions(snapshot, catalog = {}) {
  const s = snapshot || {}
  const days = sortDays(s.itinerary || [])
  const have = new Set((s.tripActivities || []).map((a) => String(a.activityId || a.name).toLowerCase()))
  const destById = new Map((catalog.destinations || []).map((d) => [String(d.id), d.name]))
  const out = []
  const seen = new Set()
  days.forEach((d, i) => {
    const city = d.location
    if (!city || seen.has(city.toLowerCase())) return
    seen.add(city.toLowerCase())
    const acts = (catalog.activities || [])
      .filter((a) => samePlace(destById.get(String(a.destination_id)) || '', city))
      .filter((a) => !have.has(String(a.id)) && !have.has(String(a.name).toLowerCase()))
      .sort((a, b) => (Number(b.selling_price) || 0) - (Number(a.selling_price) || 0))
      .slice(0, 3)
    if (acts.length) out.push({ city, day: Number(d.day) || i + 1, activities: acts.map((a) => ({ id: a.id, name: a.name, price: Number(a.selling_price) || 0 })) })
  })
  return out
}

export function addOnReply(list) {
  if (!list.length) return 'Every activity in your catalog for these places is already on the trip — or there are none listed yet. Add some under Activities and I’ll suggest them.'
  const bits = list.slice(0, 3).map((g) => `in ${g.city} (day ${g.day}): ${g.activities.map((a) => `${a.name}${a.price ? ` ${money(a.price)}` : ''}`).join(', ')}`)
  const first = list[0]
  return `Nice add-ons ${bits.join('; ')}. Say “add ${first.activities[0].name} on day ${first.day}” and it's in.`
}
