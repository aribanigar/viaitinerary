// Three hotels for a stay, not one. A good agent doesn't hand the client a
// single hotel: they say "this is the one I'd book, here is one that costs
// less, and here is the step up" — and why. For any town on a trip:
//   recommended — the hotel Ching would pick (or the one already on the trip)
//   cheaper     — the best one that costs clearly less
//   upgrade     — the smallest sensible step up
// each from the agency's own hotels, each meeting what was wished for where it
// can (meaning.js), each with the price difference a night. Pure.
import { pickHotel } from './buildTrip.js'
import { matchHotel as meets, hasHotelWishes } from './meaning.js'
import { hotelInCity } from './places.js'
import { hotelRoomTypes, findRoomTypeSection, toRoomTypeSlug } from '../hotelRates.js'

const starOf = (h) => Number(/^[1-7]/.exec(String(h?.category || ''))?.[0] || 0)
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const MIN_GAP = 300 // a difference smaller than this isn't worth offering

/** A hotel's room rate for a night: the room type asked (or its first), on that date. */
export function nightRate(hotel, { roomType = '', date = '' } = {}) {
  const types = hotelRoomTypes(hotel)
  const type = types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(roomType)) || types[0] || ''
  const section = type ? findRoomTypeSection(hotel, type, date) : null
  return Number(section?.price) || Number((hotel?.price_sections || [])[0]?.price) || 0
}

/**
 * → [{ id, name, city, stars, price, role: 'recommended' | 'cheaper' | 'upgrade' | 'alternative',
 *      label, met: [wish labels], why, delta }] — at most `max`, recommended first.
 * pref = hotelPreference(…) (+ softStars); `current` = the hotel id already on the stay.
 */
export function stayOptions(city, hotels, pref = {}, memory = null, { current = null, roomType = '', date = '', max = 3 } = {}) {
  const pool = (hotels || []).filter((h) => hotelInCity(h, city) && h.is_available !== false)
  if (!pool.length) return []
  const rate = (h) => nightRate(h, { roomType, date })
  const wishes = pref.wishes
  const wished = hasHotelWishes(wishes)
  const score = (h) => (wished ? meets(h, wishes, memory?.hotelTags || null) : { score: 0, met: [] })
  const rec = pool.find((h) => current != null && String(h.id) === String(current)) || pickHotel(city, pool, pref, memory) || pool[0]
  const recRate = rate(rec)
  const recStars = starOf(rec)
  const rest = pool.filter((h) => h !== rec && rate(h) > 0)
  // Among candidates: the ones answering the most wishes first, then by `order`.
  const best = (list, order) => list.slice().sort((a, b) => Math.floor(score(b).score) - Math.floor(score(a).score) || order(a, b))[0] || null

  const cheaper = best(
    rest.filter((h) => rate(h) <= recRate - MIN_GAP && starOf(h) >= recStars - 1),
    (a, b) => starOf(b) - starOf(a) || rate(b) - rate(a), // the best of the cheaper ones, not the roughest
  )
  const upgrade = best(
    rest.filter((h) => h !== cheaper && rate(h) >= recRate + MIN_GAP && starOf(h) >= recStars && starOf(h) <= recStars + 1),
    (a, b) => starOf(b) - starOf(a) || rate(a) - rate(b), // a real step up in class, at the smallest step in price
  )
  const picked = [rec, cheaper, upgrade].filter(Boolean)
  const roles = new Map([[rec, 'recommended'], [cheaper, 'cheaper'], [upgrade, 'upgrade']])
  // Fewer than three: the nearest in price make up the number.
  for (const h of rest.filter((x) => !picked.includes(x)).sort((a, b) => Math.abs(rate(a) - recRate) - Math.abs(rate(b) - recRate))) {
    if (picked.length >= max) break
    picked.push(h)
    roles.set(h, 'alternative')
  }
  const LABEL = { recommended: 'Recommended', cheaper: 'Costs less', upgrade: 'Step up', alternative: 'Also' }
  return picked.slice(0, max).map((h) => {
    const price = rate(h)
    const diff = price - recRate
    const met = score(h).met
    const role = roles.get(h)
    const delta = role === 'recommended' || !price || !recRate || Math.abs(diff) < 1 ? '' : `${rupees(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} a night`
    const why = [starOf(h) ? `${starOf(h)} star` : '', price ? `${rupees(price)} a night` : 'no rate', ...(met.length ? [met.join(', ').toLowerCase()] : [])].filter(Boolean).join(' · ')
    return { id: h.id, name: h.name, city: String(h.city || city).split(',')[0].trim(), stars: starOf(h), price, role, label: LABEL[role], met, why, delta }
  })
}

/** One line Ching can say: "1. Hotel A (3 star · ₹3,800 a night); 2. Hotel B, costs less (…, ₹600 less a night); …". */
export function optionsLine(options) {
  return options
    .map((o, i) => `${i + 1}. ${o.name}${o.role === 'cheaper' ? ', costs less' : o.role === 'upgrade' ? ', a step up' : ''} (${o.why}${o.delta ? `, ${o.delta}` : ''})`)
    .join('; ')
}

/** "the cheaper one", "upgrade", "the second", "the first one" → the option meant, or null. */
export function optionMeant(text, options) {
  const t = String(text || '').toLowerCase()
  if (!options?.length) return null
  if (/\b(?:cheaper|cheapest|budget|value|costs? less|lower|save)\b/.test(t)) return options.find((o) => o.role === 'cheaper') || null
  if (/\b(?:upgrade|better|nicer|step up|premium|higher|best)\b/.test(t)) return options.find((o) => o.role === 'upgrade') || null
  const ord = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, last: options.length - 1 }
  const m = /\b(first|1st|second|2nd|third|3rd|last)\b|\b(?:option|number) ([123])\b/.exec(t)
  if (m) return options[m[1] ? ord[m[1]] : Number(m[2]) - 1] || null
  return options.find((o) => t.includes(o.name.toLowerCase())) || null
}
