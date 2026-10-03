// Loose place matching for Ching: catalog city / destination names are typed
// by hand ("Pahalgam", "pahalgam ", "Pahalgam, Kashmir", "Gulmarg Valley",
// "Srinagar City"), so exact string equality misses real matches — which is
// why a spoken "2 nights Pahalgam" once found no hotel and left Logistics empty.
import { levRatio } from './fuzzy.js'

const NOISE = new Set(['city', 'town', 'district', 'valley', 'the', 'kashmir', 'jk', 'j', 'k', 'india', 'and', 'of'])

/** "Pahalgam, Kashmir" → "pahalgam"; keeps the identifying words only. */
export function placeKey(s) {
  const words = String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const sig = words.filter((w) => !NOISE.has(w))
  return (sig.length ? sig : words).join(' ')
}

/** Same place, allowing case/spacing/suffix differences and a small typo. */
export function samePlace(a, b) {
  const x = placeKey(a)
  const y = placeKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length >= 4 && (long.startsWith(`${short} `) || long.endsWith(` ${short}`) || long.includes(` ${short} `))) return true
  if (short.length >= 5 && levRatio(x.replace(/ /g, ''), y.replace(/ /g, '')) >= 0.84) return true
  return false
}

/** Whether a catalog hotel is in `city` (its city field first, then address / state / name). */
export function hotelInCity(h, city) {
  if (!h || !city) return false
  if (samePlace(h.city, city)) return true
  if (String(h.city || '').trim()) return false // it has a city, and it's another one
  const key = placeKey(city)
  if (key.length < 4) return false
  return [h.address, h.name].some((v) => ` ${placeKey(v)} `.includes(` ${key} `))
}

/** The catalog destination for a city: exact name, its city field, then a loose match. */
export function findDestinationFor(destinations, city) {
  if (!city) return null
  const list = destinations || []
  const exact = (v) => String(v || '').trim().toLowerCase() === String(city).trim().toLowerCase()
  return (
    list.find((d) => exact(d.name)) ||
    list.find((d) => exact(d.city)) ||
    list.find((d) => samePlace(d.name, city)) ||
    list.find((d) => samePlace(d.city, city)) ||
    null
  )
}
