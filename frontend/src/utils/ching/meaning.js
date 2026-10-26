// Search by meaning, with rules. A client rarely names a hotel — they say what
// they want: "something relaxing", "a honeymoon", "rooms with a river view",
// "it's for my parents". This is the tree that turns those words into what
// the agency's own catalog can be searched by:
//
//   wish (what was said)  →  concept (a branch of the tree)  →  tags (leaves)
//   "relaxing"            →  mood › calm                     →  quiet, riverside, lake-view…
//
// The leaves are HOTEL TAGS: a fixed vocabulary the agency ticks on each hotel
// (Accommodation → hotel details), with a few read off the hotel's own name
// ("… Houseboat", "River View Resort") so the tree works before any are ticked.
// Nothing here is a model and nothing leaves the browser: it is a word list.
//
// Pure. Shared by the planner (buildTrip.js pickHotel), the client-story
// reader (narrative.js), the hotel details panel and Ching's tag commands.

/** The tag vocabulary (the tree's leaves), grouped as the hotel panel shows it. */
export const TAG_GROUPS = [
  { id: 'view', label: 'View & setting', tags: ['riverside', 'lake-view', 'mountain-view', 'valley-view', 'garden', 'snow-view'] },
  { id: 'feel', label: 'Feel', tags: ['quiet', 'romantic', 'lively', 'heritage', 'boutique', 'luxury', 'budget'] },
  { id: 'who', label: 'Good for', tags: ['family', 'honeymoon', 'groups', 'seniors', 'solo', 'pets'] },
  { id: 'type', label: 'Type', tags: ['houseboat', 'resort', 'cottage', 'homestay', 'camp'] },
  { id: 'place', label: 'Where it is', tags: ['central', 'near-airport', 'near-gondola', 'near-market', 'near-lake', 'secluded'] },
  { id: 'has', label: 'It has', tags: ['spa', 'pool', 'heating', 'parking', 'restaurant', 'lift', 'wifi', 'bonfire'] },
]
export const ALL_TAGS = TAG_GROUPS.flatMap((g) => g.tags)
const TAG_SET = new Set(ALL_TAGS)
export const tagLabel = (t) => String(t || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** Free text → a tag of the vocabulary ("River side", "lake view" → "riverside", "lake-view"), or null. */
export function toTag(s) {
  const k = String(s || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!k) return null
  const dashed = k.replace(/ /g, '-')
  if (TAG_SET.has(dashed)) return dashed
  const joined = k.replace(/ /g, '')
  const hit = ALL_TAGS.find((t) => t.replace(/-/g, '') === joined)
  if (hit) return hit
  const alias = {
    'river side': 'riverside', 'river view': 'riverside', 'river facing': 'riverside', 'lake side': 'lake-view', lakeside: 'lake-view', 'lake facing': 'lake-view',
    'mountain facing': 'mountain-view', 'hill view': 'mountain-view', peaceful: 'quiet', calm: 'quiet', couples: 'honeymoon', couple: 'honeymoon', kids: 'family',
    families: 'family', group: 'groups', elderly: 'seniors', parents: 'seniors', 'pet friendly': 'pets', 'city centre': 'central', 'city center': 'central',
    centre: 'central', center: 'central', 'near the gondola': 'near-gondola', gondola: 'near-gondola', market: 'near-market', airport: 'near-airport',
    'swimming pool': 'pool', 'central heating': 'heating', heated: 'heating', 'wi fi': 'wifi', cheap: 'budget', premium: 'luxury', 'house boat': 'houseboat',
  }
  return alias[k] || null
}

// ── the tree ─────────────────────────────────────────────────────────────────
// Each node: words that say it (regex source, matched on whole words), the
// tags it means — `want` (a hotel should have at least one) and `nice`
// (breaks ties) — and sometimes towns of the kind (used only when the client
// named no town, and only towns the agency actually has hotels in).
const N = (id, parent, label, words, want = [], nice = [], places = []) => ({ id, parent, label, words, want, nice, places })
export const MEANING_TREE = [
  N('setting', null, 'Setting'),
  N('setting.river', 'setting', 'By the river', 'river ?side|river ?view|river facing|by the river|on the river|lidder|stream ?side', ['riverside'], ['quiet', 'valley-view'], ['pahalgam', 'sonamarg']),
  N('setting.lake', 'setting', 'On the lake', 'lake ?view|lake ?side|lake facing|on the lake|dal lake view|nigeen|nagin', ['lake-view', 'near-lake', 'houseboat'], [], ['srinagar']),
  N('setting.mountain', 'setting', 'Mountain views', 'mountain ?views?|mountain facing|hill ?view|peaks?|himalayan view', ['mountain-view', 'valley-view', 'snow-view']),
  N('setting.snow', 'setting', 'Snow', 'snow|snowfall|skiing|ski|white christmas', ['snow-view', 'near-gondola', 'heating'], ['mountain-view'], ['gulmarg', 'sonamarg']),
  N('setting.view', 'setting', 'A good view', 'good views?|nice views?|great views?|beautiful views?|best views?|scenic|with (?:a )?views?|room with a view|views?', ['riverside', 'lake-view', 'mountain-view', 'valley-view', 'snow-view', 'garden']),
  N('setting.garden', 'setting', 'Gardens', 'garden|lawns?|greenery|orchard', ['garden'], ['quiet']),

  N('mood', null, 'Mood'),
  N('mood.calm', 'mood', 'Relaxing', 'relax(?:ing|ed)?|peaceful|quiet|calm|serene|tranquil|unwind|laid ?back|away from (?:the )?(?:crowd|city|noise)|no crowd|sukoon|shanti', ['quiet', 'secluded', 'riverside', 'lake-view', 'garden', 'spa'], ['cottage', 'resort'], ['pahalgam']),
  N('mood.romantic', 'mood', 'Romantic', 'romantic|honeymoon|anniversary|newly ?wed|just married|couple(?:s)? (?:trip|getaway)', ['honeymoon', 'romantic'], ['lake-view', 'riverside', 'houseboat', 'boutique', 'quiet']),
  N('mood.lively', 'mood', 'Lively', 'lively|happening|nightlife|close to everything|in the middle of (?:town|things)', ['lively', 'central', 'near-market']),
  N('mood.adventure', 'mood', 'Adventure', 'adventure|adventurous|trek(?:king)?|rafting|skiing|ski|thrill', ['near-gondola', 'camp', 'mountain-view'], [], ['gulmarg', 'sonamarg', 'pahalgam']),
  N('mood.heritage', 'mood', 'Heritage', 'heritage|old ?world|traditional|historic|royal|palace', ['heritage', 'boutique'], ['houseboat']),

  N('party', null, 'Who is travelling'),
  N('party.family', 'party', 'Family', 'famil(?:y|ies)|kids?|children|child|with (?:my |our )?(?:son|daughter)', ['family'], ['central', 'restaurant', 'heating', 'parking']),
  N('party.seniors', 'party', 'Parents / seniors', '(?:my |our )?parents|elderly|senior citizens?|seniors|old age|grand ?(?:parents|mother|father)|wheelchair', ['seniors', 'lift'], ['central', 'heating', 'restaurant', 'near-market']),
  N('party.baby', 'party', 'With a baby', 'infant|baby|toddler|\\d+ ?months? old', ['family'], ['heating', 'central', 'restaurant']),
  N('party.group', 'party', 'A group', 'group|friends|colleagues|office|corporate|students|batch', ['groups'], ['parking', 'restaurant', 'bonfire']),
  N('party.solo', 'party', 'Solo', 'solo|alone|by myself|backpack(?:er|ing)?', ['solo', 'homestay'], ['budget', 'central']),
  N('party.pets', 'party', 'With a pet', 'pets?|dog|pet ?friendly', ['pets']),

  N('stay', null, 'Kind of stay'),
  N('stay.houseboat', 'stay', 'Houseboat', 'house ?boats?|shikara stay|stay on (?:the )?(?:boat|lake)', ['houseboat'], ['lake-view'], ['srinagar']),
  N('stay.resort', 'stay', 'Resort', 'resorts?', ['resort']),
  N('stay.cottage', 'stay', 'Cottage / homestay', 'cottages?|huts?|home ?stays?|local family', ['cottage', 'homestay']),
  N('stay.camp', 'stay', 'Camping', 'camp(?:s|ing)?|tents?|glamping', ['camp'], ['bonfire']),
  N('stay.boutique', 'stay', 'Boutique', 'boutique|small hotel|not a big hotel|charming', ['boutique'], ['heritage', 'quiet']),

  N('where', null, 'Where in town'),
  N('where.central', 'where', 'Central', 'central|city cent(?:re|er)|in (?:the )?town|walking distance|near (?:the )?market|main market|lal chowk', ['central', 'near-market']),
  N('where.gondola', 'where', 'Near the gondola', 'near (?:the )?gondola|close to (?:the )?gondola|ski ?lift', ['near-gondola'], [], ['gulmarg']),
  N('where.airport', 'where', 'Near the airport', 'near (?:the )?airport|close to (?:the )?airport|early (?:morning )?flight', ['near-airport'], [], ['srinagar']),
  N('where.secluded', 'where', 'Secluded', 'secluded|remote|off ?beat|hidden|isolated|in the (?:forest|woods)', ['secluded', 'quiet']),

  // Things to do ask nothing of a hotel: they choose the PLACE (whereTo.js).
  N('do', null, 'Things to do'),
  N('do.shopping', 'do', 'Shopping', 'shopping|shop|markets?|bazaars?|handicrafts?|shawls?|souvenirs?'),
  N('do.skiing', 'do', 'Skiing', 'ski(?:ing)?|snowboard(?:ing)?|sledg(?:e|ing)'),
  N('do.gondola', 'do', 'Gondola', 'gondola|cable ?car|ropeway'),
  N('do.trekking', 'do', 'Trekking', 'trek(?:s|king)?|hik(?:e|es|ing)|long walks?'),
  N('do.rafting', 'do', 'Rafting', 'rafting|river rafting|white ?water'),
  N('do.shikara', 'do', 'Shikara ride', 'shikara|boat ride|boating'),
  N('do.pilgrimage', 'do', 'Pilgrimage', 'pilgrim(?:age)?|yatra|darshan|temples?|shrines?|ziyarat|dargah|gurudwara'),
  N('do.golf', 'do', 'Golf', 'golf(?:ing)?'),
  N('do.fishing', 'do', 'Fishing', 'fishing|angling|trout'),
  N('do.monasteries', 'do', 'Monasteries', 'monaster(?:y|ies)|gompas?|buddhist'),
  N('do.wildlife', 'do', 'Wildlife', 'wildlife|safari|national park|birds?|bird ?watching'),
  N('do.meadows', 'do', 'Meadows', 'meadows?|valleys?|green(?:ery)? valley|pony rides?|horse rid(?:e|ing)'),
  N('do.desert', 'do', 'Desert', 'desert|sand dunes?|camel'),
  N('do.beach', 'do', 'Beach', 'beach(?:es)?|sea ?side|coast'),
  N('do.offbeat', 'do', 'Offbeat', 'off ?beat|unexplored|less (?:crowded|touristy)|hidden gems?|not touristy|untouched'),

  N('comfort', null, 'Comforts'),
  N('comfort.spa', 'comfort', 'Spa', 'spa|massage|wellness|sauna', ['spa'], ['luxury', 'resort']),
  N('comfort.pool', 'comfort', 'Pool', 'pool|swimming', ['pool']),
  N('comfort.heating', 'comfort', 'Warm rooms', 'heating|heated|warm rooms?|central heating|electric blankets?', ['heating']),
  N('comfort.bonfire', 'comfort', 'Bonfire', 'bonfire|camp ?fire', ['bonfire']),
  N('comfort.food', 'comfort', 'Good food on site', 'in ?house restaurant|good food|restaurant in the hotel', ['restaurant']),
]
const LEAVES = MEANING_TREE.filter((n) => n.words)
const NODE = new Map(MEANING_TREE.map((n) => [n.id, n]))
const NO = "(?:not?|nothing|never|without|don'?t (?:want|need|like)|do not (?:want|need|like)|avoid(?:ing)?|no need (?:for|of))"

/** The tree as nested branches (for showing it): [{ id, label, children: [{ id, label, want, nice }] }]. */
export function meaningBranches() {
  return MEANING_TREE.filter((n) => !n.parent).map((b) => ({
    id: b.id,
    label: b.label,
    children: LEAVES.filter((n) => n.parent === b.id).map(({ id, label, want, nice }) => ({ id, label, want, nice })),
  }))
}

/**
 * What a sentence wishes for → { nodes: [{ id, label, path, want, nice }],
 * want: [tag sets — one per wish], nice: [tags], places: [town keys] }.
 * "nothing fancy", "not a houseboat" are wishes against, and are left out.
 */
export function readWishes(text) {
  const t = ` ${String(text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `
  const nodes = []
  for (const n of LEAVES) {
    const re = new RegExp(`\\b(?:${n.words})\\b`, 'g')
    let m
    let hit = false
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 28), m.index)
      if (new RegExp(`\\b${NO}\\s+(?:\\w+\\s+){0,3}$`).test(before)) continue
      hit = true
      break
    }
    if (hit) nodes.push({ id: n.id, label: n.label, path: `${NODE.get(n.parent).label} › ${n.label}`, want: n.want, nice: n.nice, places: n.places })
  }
  // "a good view" adds nothing once a particular view was asked for.
  const exact = nodes.some((n) => /^setting\.(?:river|lake|mountain|snow)$/.test(n.id))
  const kept = exact ? nodes.filter((n) => n.id !== 'setting.view') : nodes
  return {
    nodes: kept,
    want: kept.map((n) => n.want).filter((w) => w.length),
    nice: [...new Set(kept.flatMap((n) => n.nice))],
    places: [...new Set(kept.flatMap((n) => n.places))],
  }
}

// What a hotel's own name tells ("Naaz Kashmir Houseboat", "River View Resort").
const NAME_TAGS = [
  [/\bhouse ?boats?\b|\bgroup of houseboats\b/, 'houseboat'],
  [/\bresorts?\b/, 'resort'],
  [/\bcottages?\b|\bhuts?\b/, 'cottage'],
  [/\bhome ?stays?\b|\bguest ?house\b/, 'homestay'],
  [/\bcamps?\b|\btents?\b|\bglamping\b/, 'camp'],
  [/\briver\b|\blidder\b|\bstream\b|\bsindh\b/, 'riverside'],
  [/\blake\b|\bdal\b|\bnigeen\b|\bnagin\b/, 'lake-view'],
  [/\bmountain\b|\bpeak\b|\bsummit\b|\bglacier\b|\bhimalaya\w*\b|\bpine\b|\balpine\b/, 'mountain-view'],
  [/\bvalley\b|\bmeadows?\b/, 'valley-view'],
  [/\bsnow\b/, 'snow-view'],
  [/\bgarden\b|\borchard\b/, 'garden'],
  [/\bheritage\b|\bpalace\b|\bhaveli\b|\broyal\b/, 'heritage'],
  [/\bspa\b|\bwellness\b/, 'spa'],
  [/\bboutique\b/, 'boutique'],
]
export function inferHotelTags(hotel) {
  const name = ` ${String(hotel?.name || '').toLowerCase().replace(/[^a-z ]+/g, ' ')} `
  const out = NAME_TAGS.filter(([re]) => re.test(name)).map(([, tag]) => tag)
  const stars = Number(/^[1-7]/.exec(String(hotel?.category || ''))?.[0] || 0)
  if (stars >= 5) out.push('luxury')
  if (stars && stars <= 2) out.push('budget')
  return [...new Set(out)]
}

/** A hotel's tags: the ones the agency ticked (tagMap: { hotelId: [tags] }) plus what its name says. */
export function hotelTags(hotel, tagMap = null) {
  const ticked = (tagMap && (tagMap[hotel?.id] || tagMap[String(hotel?.id)])) || hotel?.tags || []
  return [...new Set([...ticked.map(toTag).filter(Boolean), ...inferHotelTags(hotel)])]
}

/**
 * How well a hotel answers the wishes: { score, met: [labels of wishes met],
 * tags: [the tags that did it] }. One point per wish met, a fraction per
 * tie-breaking tag.
 */
export function matchHotel(hotel, wishes, tagMap = null) {
  const tags = hotelTags(hotel, tagMap)
  const met = []
  const by = []
  for (const n of wishes?.nodes || []) {
    const hit = n.want.find((w) => tags.includes(w))
    if (hit) {
      met.push(n.label)
      by.push(hit)
    }
  }
  const nice = (wishes?.nice || []).filter((w) => tags.includes(w)).length
  return { score: met.length + Math.min(0.9, nice * 0.2), met, tags: [...new Set(by)] }
}

/** Wishes that ask something of a hotel at all (some only describe the party). */
export const hasHotelWishes = (wishes) => (wishes?.nodes || []).some((n) => n.want.length > 0)
