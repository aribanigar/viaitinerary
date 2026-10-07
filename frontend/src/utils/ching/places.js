// Ching — where things are: city coordinates, the road network between them,
// which catalog destination a hotel's city belongs to, and which hotel to
// suggest when only a city was said.
// Pure JS: no React, no DOM, no imports outside utils/ching.

import { normKey, levRatio } from './fuzzy.js'

// Popular stops, so routes work even when the agency's hotels have no map pin.
// [lat, lng, region]. Coordinates are town centres (approximate).
export const GAZETTEER = {
  srinagar: [34.0837, 74.7973, 'Kashmir'],
  gulmarg: [34.0484, 74.3805, 'Kashmir'],
  tangmarg: [34.0613, 74.4249, 'Kashmir'],
  pahalgam: [34.0161, 75.315, 'Kashmir'],
  sonamarg: [34.3031, 75.2929, 'Kashmir'],
  doodhpathri: [33.8667, 74.5833, 'Kashmir'],
  yusmarg: [33.8333, 74.6667, 'Kashmir'],
  gurez: [34.6386, 74.8665, 'Kashmir'],
  kokernag: [33.5843, 75.3076, 'Kashmir'],
  jammu: [32.7266, 74.857, 'Jammu'],
  katra: [32.9916, 74.9318, 'Jammu'],
  patnitop: [33.0866, 75.33, 'Jammu'],
  leh: [34.1526, 77.5771, 'Ladakh'],
  kargil: [34.5539, 76.1349, 'Ladakh'],
  drass: [34.4306, 75.7563, 'Ladakh'],
  nubra: [34.55, 77.56, 'Ladakh'],
  pangong: [33.9333, 78.4667, 'Ladakh'],
  manali: [32.2432, 77.1892, 'Himachal'],
  shimla: [31.1048, 77.1734, 'Himachal'],
  dharamshala: [32.219, 76.3234, 'Himachal'],
  dalhousie: [32.5387, 75.971, 'Himachal'],
  amritsar: [31.634, 74.8723, 'Punjab'],
}
// Towns with an airport (or the railhead) — where trips start and end.
export const GATEWAYS = ['srinagar', 'jammu', 'leh', 'amritsar', 'dharamshala', 'shimla']
const ALIASES = { 'sri nagar': 'srinagar', 'gul marg': 'gulmarg', 'sona marg': 'sonamarg', 'pehalgam': 'pahalgam', 'mcleodganj': 'dharamshala', 'vaishno devi': 'katra', 'nubra valley': 'nubra', 'pangong lake': 'pangong', 'pangong tso': 'pangong' }

// Roads between them, km (approximate driving distance). Mountain towns are
// spokes: Gulmarg → Pahalgam really goes through Srinagar, so there is no edge.
export const ROADS = [
  ['srinagar', 'gulmarg', 50], ['srinagar', 'tangmarg', 40], ['tangmarg', 'gulmarg', 12],
  ['srinagar', 'pahalgam', 95], ['srinagar', 'sonamarg', 80], ['srinagar', 'doodhpathri', 42],
  ['srinagar', 'yusmarg', 47], ['srinagar', 'gurez', 125], ['srinagar', 'kokernag', 80],
  ['kokernag', 'pahalgam', 60], ['srinagar', 'jammu', 265], ['srinagar', 'patnitop', 190],
  ['jammu', 'patnitop', 110], ['jammu', 'katra', 50], ['pahalgam', 'jammu', 255],
  ['sonamarg', 'drass', 60], ['drass', 'kargil', 60], ['kargil', 'leh', 220], ['leh', 'nubra', 120],
  ['leh', 'pangong', 160], ['nubra', 'pangong', 160], ['jammu', 'amritsar', 210],
  ['jammu', 'dalhousie', 190], ['dalhousie', 'dharamshala', 120], ['amritsar', 'dharamshala', 200],
  ['dharamshala', 'manali', 230], ['manali', 'shimla', 250], ['manali', 'leh', 470],
]

/** Normalised gazetteer key for a city name ('' when unknown). */
export function gazetteerKey(city) {
  const k = normKey(city)
  if (!k) return ''
  if (GAZETTEER[k]) return k
  if (ALIASES[k]) return ALIASES[k]
  const first = k.split(' ')[0]
  if (GAZETTEER[first]) return first
  for (const key of Object.keys(GAZETTEER)) if (k.length >= 5 && levRatio(k, key) >= 0.85) return key
  return ''
}

const toRad = (d) => (d * Math.PI) / 180
/** Great-circle distance in km. */
export function haversine([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** [lat, lng] of a city: the average of the agency's pinned hotels there, else the gazetteer. */
export function cityPoint(city, hotels = []) {
  const k = normKey(city)
  const pins = hotels
    .filter((h) => normKey(h?.city) === k && Number.isFinite(Number(h.latitude)) && Number.isFinite(Number(h.longitude)))
    .filter((h) => Number(h.latitude) || Number(h.longitude))
  if (pins.length) {
    return [pins.reduce((a, h) => a + Number(h.latitude), 0) / pins.length, pins.reduce((a, h) => a + Number(h.longitude), 0) / pins.length]
  }
  const g = GAZETTEER[gazetteerKey(city)]
  return g ? [g[0], g[1]] : null
}

const same = (a, b) => !!a && !!b && (normKey(a) === normKey(b) || (normKey(a).length >= 5 && levRatio(normKey(a), normKey(b)) >= 0.85))

/**
 * The catalog destination a city belongs to — a short graph walk:
 * a destination named after the city, else one whose `city` field is it,
 * else a near spelling ("Srinagar City", "Pahalgam Valley").
 */
export function destinationForCity(city, destinations = []) {
  if (!city) return null
  const list = destinations.filter((d) => d && d.name)
  return (
    list.find((d) => same(d.name, city)) ||
    list.find((d) => same(d.city, city)) ||
    list.find((d) => normKey(d.name).split(' ')[0] === normKey(city).split(' ')[0] && normKey(city).length >= 4) ||
    null
  )
}

/**
 * The trip's destination for a set of stay cities. One city → its destination.
 * Several → the region that holds them all: a catalog destination named after
 * their shared state/region ("Kashmir" for Srinagar + Gulmarg + Pahalgam),
 * else the first city's destination.
 */
export function tripDestination(cities, destinations = []) {
  const distinct = cities.filter(Boolean).filter((c, i, a) => a.findIndex((x) => same(x, c)) === i)
  if (!distinct.length) return null
  const own = distinct.map((c) => destinationForCity(c, destinations))
  if (distinct.length === 1) return own[0] ? { id: own[0].id, name: own[0].name } : { id: null, name: distinct[0] }

  // Region names, most specific first: the gazetteer's ("Kashmir"), then the
  // catalog's state field ("Jammu & Kashmir").
  const regions = []
  distinct.forEach((c) => {
    const g = GAZETTEER[gazetteerKey(c)]
    if (g && !regions.includes(normKey(g[2]))) regions.push(normKey(g[2]))
  })
  const exactOnly = regions.length
  own.forEach((o) => o?.state && !regions.includes(normKey(o.state)) && regions.push(normKey(o.state)))
  const candidates = destinations.filter((d) => d?.name && !own.some((o) => o && o.id === d.id) && !gazetteerKey(d.name))
  let region = null
  // A trip across two regions (Kashmir + Ladakh) has no single region destination.
  for (const [i, r] of (exactOnly > 1 ? [] : regions).entries()) {
    region = candidates.find((d) => normKey(d.name) === r || (i >= exactOnly && r.includes(normKey(d.name))))
    if (region) break
  }
  if (region) return { id: region.id, name: region.name }
  const regionNames = [...new Set(distinct.map((c) => GAZETTEER[gazetteerKey(c)]?.[2]).filter(Boolean))]
  if (regionNames.length === 1 && distinct.every((c) => gazetteerKey(c))) return { id: null, name: regionNames[0] }
  return own[0] ? { id: own[0].id, name: own[0].name } : { id: null, name: distinct[0] }
}

const priceFor = (hotel, date) => {
  const sections = hotel?.price_sections || []
  const inSeason = (s) => (!s.valid_from || date >= String(s.valid_from).slice(0, 10)) && (!s.valid_to || date <= String(s.valid_to).slice(0, 10))
  const s = (date && sections.find((x) => (x.valid_from || x.valid_to) && inSeason(x))) || sections.find((x) => !x.valid_from && !x.valid_to) || sections[0]
  return Number(s?.price) || 0
}

/**
 * The agency's hotels in a city, best suggestion first. A stable multi-key
 * sort (Array#sort is TimSort): available → closest star category to the
 * rest of the trip → has a rate for the date → cheapest → name.
 */
export function rankHotelsForCity(city, hotels = [], { category = null, date = '' } = {}) {
  const want = Number(String(category ?? '').replace(/\D/g, '')) || null
  return hotels
    .filter((h) => h && h.name && same(h.city, city))
    .map((h) => ({ h, price: priceFor(h, date), stars: Number(String(h.category ?? '').replace(/\D/g, '')) || null }))
    .sort(
      (a, b) =>
        (a.h.is_available === false) - (b.h.is_available === false) ||
        (want ? Math.abs((a.stars ?? 0) - want) - Math.abs((b.stars ?? 0) - want) : 0) ||
        (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1) ||
        a.price - b.price ||
        String(a.h.name).localeCompare(String(b.h.name)),
    )
    .map((x) => x.h)
}
