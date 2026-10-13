// "Where should they go?" — places by meaning, with rules. A client who hasn't
// chosen a destination says what they want from it ("snow", "shopping, but my
// husband wants the mountains", "somewhere quiet with the kids"). The same
// meaning tree that picks hotels (meaning.js) picks the PLACE here:
//
//   wish  →  concept  →  place tags  →  the agency's own destinations, ranked
//
// Place tags are a fixed vocabulary ticked per destination (Destinations →
// edit), with a starting set for well-known towns and what a destination's own
// activity list says, so it works before anything is ticked. Only places the
// agency can sell (it has a hotel there) are ever suggested, each with why.
// Pure: no model, no network.
import { readWishes } from './meaning.js'
import { placeKey, samePlace } from './places.js'

export const PLACE_TAG_GROUPS = [
  { id: 'nature', label: 'Nature', tags: ['snow', 'lake', 'river', 'meadows', 'mountains', 'glacier', 'forest', 'gardens', 'desert', 'beach'] },
  { id: 'do', label: 'Things to do', tags: ['skiing', 'gondola', 'trekking', 'rafting', 'shikara', 'houseboats', 'shopping', 'golf', 'fishing', 'camping', 'pony-rides', 'wildlife', 'monasteries'] },
  { id: 'feel', label: 'Feel', tags: ['quiet', 'lively', 'romantic', 'family', 'adventure', 'offbeat', 'heritage', 'pilgrimage'] },
  { id: 'practical', label: 'Practical', tags: ['airport', 'easy-walking', 'high-altitude'] },
]
export const ALL_PLACE_TAGS = PLACE_TAG_GROUPS.flatMap((g) => g.tags)
const PLACE_SET = new Set(ALL_PLACE_TAGS)

/** Free text → a place tag ("pony ride" → "pony-rides"), or null. */
export function toPlaceTag(s) {
  const k = String(s || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!k) return null
  const dashed = k.replace(/ /g, '-')
  if (PLACE_SET.has(dashed)) return dashed
  const alias = {
    ski: 'skiing', trek: 'trekking', treks: 'trekking', hiking: 'trekking', lakes: 'lake', rivers: 'river', garden: 'gardens', mountain: 'mountains',
    'pony ride': 'pony-rides', 'pony rides': 'pony-rides', ponies: 'pony-rides', houseboat: 'houseboats', 'shikara ride': 'shikara', monastery: 'monasteries',
    'cable car': 'gondola', markets: 'shopping', market: 'shopping', temples: 'pilgrimage', temple: 'pilgrimage', peaceful: 'quiet', honeymoon: 'romantic',
    kids: 'family', 'off beat': 'offbeat', 'high altitude': 'high-altitude', 'easy walking': 'easy-walking', flat: 'easy-walking', safari: 'wildlife', camp: 'camping',
  }
  return alias[k] || null
}

// What each wish (a node of the meaning tree) asks of a place.
const WISH_PLACE = {
  'setting.river': ['river'], 'setting.lake': ['lake'], 'setting.mountain': ['mountains', 'glacier'], 'setting.snow': ['snow', 'glacier', 'skiing'],
  'setting.view': ['mountains', 'lake', 'meadows', 'river'], 'setting.garden': ['gardens', 'meadows'],
  'mood.calm': ['quiet', 'meadows', 'river', 'forest'], 'mood.romantic': ['romantic'], 'mood.lively': ['lively', 'shopping'],
  'mood.adventure': ['adventure', 'trekking', 'rafting', 'skiing', 'camping'], 'mood.heritage': ['heritage', 'monasteries'],
  'party.family': ['family'], 'party.seniors': ['easy-walking', 'gardens', 'airport'], 'party.baby': ['easy-walking', 'family'],
  'party.group': ['lively', 'adventure'], 'party.solo': ['offbeat', 'trekking'],
  'stay.houseboat': ['houseboats'], 'stay.camp': ['camping'], 'where.gondola': ['gondola'], 'where.airport': ['airport'], 'where.secluded': ['offbeat', 'quiet'],
  'do.shopping': ['shopping'], 'do.skiing': ['skiing'], 'do.gondola': ['gondola'], 'do.trekking': ['trekking'], 'do.rafting': ['rafting'],
  'do.shikara': ['shikara'], 'do.pilgrimage': ['pilgrimage'], 'do.golf': ['golf'], 'do.fishing': ['fishing'], 'do.monasteries': ['monasteries'],
  'do.wildlife': ['wildlife'], 'do.meadows': ['meadows', 'pony-rides'], 'do.desert': ['desert'], 'do.beach': ['beach'], 'do.offbeat': ['offbeat'],
}
// Who is travelling is a preference, not a reason to go somewhere: it breaks
// ties and rules places out, but a place is never suggested for it alone.
const SOFT = /^party\./
// Not for the frail or the very young.
const HARD_GOING = { 'party.seniors': ['high-altitude'], 'party.baby': ['high-altitude'] }

// A starting set for towns everyone knows (the agency's own ticks replace it).
const KNOWN = {
  srinagar: ['lake', 'gardens', 'shikara', 'houseboats', 'shopping', 'heritage', 'lively', 'family', 'romantic', 'airport', 'easy-walking'],
  gulmarg: ['snow', 'meadows', 'mountains', 'skiing', 'gondola', 'golf', 'pony-rides', 'adventure', 'romantic', 'family'],
  tangmarg: ['snow', 'meadows', 'forest', 'quiet'],
  pahalgam: ['river', 'meadows', 'forest', 'mountains', 'trekking', 'rafting', 'fishing', 'pony-rides', 'golf', 'quiet', 'romantic', 'family'],
  sonamarg: ['glacier', 'snow', 'river', 'meadows', 'mountains', 'trekking', 'pony-rides', 'fishing', 'camping', 'adventure'],
  doodhpathri: ['meadows', 'river', 'forest', 'quiet', 'offbeat', 'pony-rides'],
  yusmarg: ['meadows', 'forest', 'lake', 'quiet', 'offbeat', 'pony-rides'],
  gurez: ['river', 'mountains', 'offbeat', 'quiet', 'camping', 'adventure', 'trekking'],
  kokernag: ['gardens', 'forest', 'quiet', 'offbeat', 'fishing'],
  jammu: ['pilgrimage', 'heritage', 'shopping', 'lively', 'airport', 'easy-walking'],
  katra: ['pilgrimage', 'family', 'trekking'],
  patnitop: ['forest', 'meadows', 'snow', 'family', 'quiet'],
  leh: ['mountains', 'desert', 'monasteries', 'heritage', 'shopping', 'adventure', 'airport', 'high-altitude'],
  kargil: ['mountains', 'heritage', 'offbeat', 'high-altitude'],
  drass: ['mountains', 'snow', 'offbeat', 'high-altitude'],
  nubra: ['desert', 'monasteries', 'river', 'offbeat', 'adventure', 'camping', 'high-altitude'],
  pangong: ['lake', 'mountains', 'camping', 'offbeat', 'high-altitude'],
  manali: ['snow', 'mountains', 'river', 'forest', 'adventure', 'skiing', 'rafting', 'trekking', 'romantic', 'lively', 'shopping', 'family'],
  shimla: ['heritage', 'shopping', 'mountains', 'forest', 'family', 'lively', 'snow', 'easy-walking'],
  dharamshala: ['monasteries', 'mountains', 'trekking', 'quiet', 'heritage', 'forest'],
  dalhousie: ['forest', 'mountains', 'quiet', 'heritage', 'family'],
  amritsar: ['pilgrimage', 'heritage', 'shopping', 'lively', 'airport', 'easy-walking'],
}
// What a destination's own activity list says.
const ACTIVITY_TAGS = [
  [/\bgondola\b|\bcable ?car\b|\bropeway\b/, 'gondola'], [/\bski/, 'skiing'], [/\bsnow/, 'snow'], [/\bshikara\b/, 'shikara'], [/\bhouse ?boat/, 'houseboats'],
  [/\btrek|\bhik(?:e|ing)\b/, 'trekking'], [/\braft/, 'rafting'], [/\bgardens?\b|\bbagh\b/, 'gardens'], [/\blake\b/, 'lake'], [/\briver\b/, 'river'],
  [/\bglacier\b/, 'glacier'], [/\bmeadows?\b|\bvalley\b/, 'meadows'], [/\bshopping\b|\bmarket\b|\bbazaar\b/, 'shopping'], [/\bgolf\b/, 'golf'],
  [/\bpony\b|\bhorse\b/, 'pony-rides'], [/\bcamp/, 'camping'], [/\bfishing\b|\btrout\b|\bangling\b/, 'fishing'], [/\bmonaster|\bgompa\b/, 'monasteries'],
  [/\btemple\b|\bshrine\b|\bdargah\b|\bmosque\b|\bgurudwara\b|\bdarshan\b/, 'pilgrimage'], [/\bfort\b|\bpalace\b|\bmuseum\b|\bold city\b/, 'heritage'],
  [/\bsafari\b|\bwildlife\b|\bnational park\b/, 'wildlife'], [/\bdesert\b|\bdunes?\b|\bcamel\b/, 'desert'], [/\bbeach\b/, 'beach'],
]
const actName = (a) => (typeof a === 'string' ? a : a?.name || a?.title || '')

/** Tags read off a destination before anyone ticks anything: the known set + its own activities. */
export function inferPlaceTags(dest) {
  const key = placeKey(typeof dest === 'string' ? dest : dest?.name)
  const acts = ` ${(dest?.activities || []).map(actName).join(' | ').toLowerCase()} `
  return [...new Set([...(KNOWN[key] || []), ...ACTIVITY_TAGS.filter(([re]) => re.test(acts)).map(([, t]) => t)])]
}

/** A destination's tags: the agency's own ticks when it has any, else what can be read off it. */
export function placeTags(dest, tagMap = null) {
  const ticked = (tagMap && (tagMap[dest?.id] || tagMap[String(dest?.id)])) || []
  const clean = ticked.map((t) => (PLACE_SET.has(t) ? t : toPlaceTag(t))).filter(Boolean)
  return clean.length ? [...new Set(clean)] : inferPlaceTags(dest)
}

/** The places the agency can sell: its destinations and hotel towns that have an available hotel. */
export function sellablePlaces(catalog) {
  const hotels = (catalog?.hotels || []).filter((h) => h && h.is_available !== false && h.city)
  const out = []
  const add = (name, dest) => {
    const n = String(name || '').split(',')[0].trim()
    if (!n || out.some((p) => samePlace(p.name, n))) return
    const count = hotels.filter((h) => samePlace(String(h.city).split(',')[0], n)).length
    if (count) out.push({ name: dest?.name || n, id: dest?.id ?? null, dest: dest || { name: n, activities: [] }, hotels: count, state: dest?.state || '' })
  }
  for (const d of catalog?.destinations || []) add(d?.name, d)
  for (const h of hotels) add(h.city, null)
  return out
}

const lower = (s) => String(s || '').toLowerCase()
const and = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/**
 * Rank the agency's places for what was wished.
 * → { wishes: [labels asked of a place], places: [{ name, id, score, met: [labels], tags, activities, hotels }], cover: [names] | null }
 * `cover`: when no one place answers everything, the fewest places that together do (at most 3).
 */
export function suggestPlaces(textOrWishes, catalog, { tagMap = null, region = '', max = 3 } = {}) {
  const wishes = typeof textOrWishes === 'string' ? readWishes(textOrWishes) : textOrWishes
  const nodes = (wishes?.nodes || []).filter((n) => WISH_PLACE[n.id])
  const hard = nodes.filter((n) => !SOFT.test(n.id))
  const inRegion = (p) => !region || lower(p.state).includes(lower(region)) || lower(p.name) === lower(region)
  const all = sellablePlaces(catalog).filter(inRegion)
  const scored = all.map((p) => {
    const tags = placeTags(p.dest, tagMap)
    let score = 0
    const met = []
    const by = []
    let caution = ''
    for (const n of nodes) {
      const hits = WISH_PLACE[n.id].filter((t) => tags.includes(t))
      const bad = (HARD_GOING[n.id] || []).some((t) => tags.includes(t))
      if (bad) {
        score -= 1.5
        caution = `high altitude: hard going ${n.id === 'party.baby' ? 'with a baby' : 'for older travellers'}`
      }
      if (!hits.length) continue
      if (SOFT.test(n.id)) score += 0.3
      else {
        score += 1 + Math.min(0.4, (hits.length - 1) * 0.2)
        met.push(n.label)
      }
      by.push(...hits)
    }
    // What can actually be done there, from the agency's own lists (a reason the agent can say).
    const words = [...new Set(by)].map((t) => t.replace(/-.*/, '').replace(/s$/, ''))
    const acts = [
      ...(p.dest?.activities || []).map(actName),
      ...(catalog?.activities || []).filter((a) => p.id != null && String(a.destination_id) === String(p.id)).map((a) => a.name),
    ].filter((a) => a && words.some((w) => w.length >= 4 && lower(a).includes(w)))
    return { name: p.name, id: p.id, score: Math.round(score * 100) / 100, met, tags: [...new Set(by)], activities: [...new Set(acts)].slice(0, 2), hotels: p.hotels, caution }
  })
  // A place that has what was asked but is hard on this party is still said, last, with the warning.
  const places = scored.filter((p) => p.met.length > 0 && (p.score > 0 || p.caution)).sort((a, b) => b.score - a.score || b.hotels - a.hotels || a.name.localeCompare(b.name))
  const asked = hard.map((n) => n.label)
  // No one place has it all: the fewest that together do.
  let cover = null
  if (asked.length > 1 && places.length && places[0].met.length < asked.length) {
    const left = new Set(asked)
    const picked = []
    while (left.size && picked.length < 3) {
      const best = places.filter((p) => !picked.includes(p)).map((p) => ({ p, n: p.met.filter((m) => left.has(m)).length })).sort((a, b) => b.n - a.n || b.p.score - a.p.score)[0]
      if (!best || !best.n) break
      picked.push(best.p)
      best.p.met.forEach((m) => left.delete(m))
    }
    if (picked.length > 1) cover = { places: picked.map((p) => p.name), missing: [...left] }
  }
  return { wishes: asked, places: places.slice(0, max), cover, known: all.length }
}

const why = (p) => {
  const bits = [lower(and(p.met))]
  if (p.activities.length) bits.push(p.activities.join(', '))
  return `${bits.join(': ')}${p.caution ? `; ${p.caution}` : ''}`
}

/** What Ching says. */
export function whereReply(r) {
  if (!r.known) return "I don't have any destinations with hotels in your catalog yet."
  if (!r.wishes.length) return 'Tell me what they would enjoy, and I will suggest where: snow, lakes, shopping, somewhere quiet, trekking, a pilgrimage…'
  if (!r.places.length) return `None of your destinations is tagged for ${lower(and(r.wishes))} yet. Tick tags on them in Destinations, or tell me: “tag Gulmarg as snow”.`
  const list = r.places.map((p, i) => `${i + 1}. ${p.name} (${why(p)})`).join('; ')
  if (r.cover) {
    const parts = r.cover.places.map((name) => `${name} for ${lower(and(r.places.find((p) => p.name === name)?.met || []) || 'the rest')}`)
    const gap = r.cover.missing.length ? ` Nothing I have covers ${lower(and(r.cover.missing))}.` : ''
    return `No single place has all of that. Together: ${and(parts)}.${gap} Or one of: ${list}. Say “plan both”, or “plan the first one”.`
  }
  return `For ${lower(and(r.wishes))} I would suggest: ${list}. Say “plan the first one”, or name it.`
}

const ASK =
  /\bwhere (?:should|can|could|do|shall|would) (?:i|we|they|he|she|you) (?:go|send|take|suggest|recommend)\b|\bwhere to (?:go|send)\b|\b(?:suggest|recommend) (?:me |us |them )?(?:a |some |the best )?(?:place|places|destination|destinations|town|towns)\b|\bwhich (?:place|destination|town|city)s? (?:is|are|would be) (?:good|best|better|nice)\b|\b(?:best|good|nice) (?:place|places|destination|destinations) (?:for|to)\b|\b(?:not sure|don'?t know|undecided|haven'?t decided|can'?t decide) where\b|\bwhere (?:is|are) (?:good|best|nice) (?:for|to)\b/

/** "where should they go for snow and shopping" → { wishes, region-free text } or null. */
export function whereAsk(text) {
  const t = lower(text).replace(/[‘’]/g, "'").replace(/[?!.,]+/g, ' ').replace(/\s+/g, ' ').trim()
  return ASK.test(t) ? { text: t, wishes: readWishes(t) } : null
}

/** "the first one", "plan gulmarg", "both", "all three" → the names picked from a list of suggestions, or null. */
export function pickPlaces(text, names, cover = null) {
  const t = lower(text).replace(/[?!.,]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!names?.length) return null
  if (/\b(?:both|all (?:of them|three|3|two|2)|all|together|the combo|combine)\b/.test(t)) return cover?.length ? cover : names.slice(0, Math.min(names.length, /two|2|both/.test(t) ? 2 : 3))
  const ord = { first: 0, '1st': 0, one: 0, 1: 0, second: 1, '2nd': 1, two: 1, 2: 1, third: 2, '3rd': 2, three: 2, 3: 2, last: names.length - 1 }
  const m = /\b(?:the |option |number |no )?(first|1st|second|2nd|third|3rd|last)\b(?: one| option| place)?|^(?:option |number )?([123])$/.exec(t)
  if (m) {
    const i = ord[m[1] || m[2]]
    return names[i] ? [names[i]] : null
  }
  const said = names.filter((n) => new RegExp(`\\b${placeKey(n)}\\b`).test(placeKey(t)))
  return said.length ? said : null
}
