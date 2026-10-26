// Search by meaning (utils/ching/meaning.js), the capability tree
// (capabilities.js) and the kept conversation (conversation.js):
//   node frontend/scripts/ching-meaning.test.mjs
import assert from 'node:assert/strict'
import { readWishes, hotelTags, inferHotelTags, matchHotel, toTag, ALL_TAGS, MEANING_TREE, meaningBranches } from '../src/utils/ching/meaning.js'
import { helpAsk, helpReply, branchFor, CAPABILITY_TREE } from '../src/utils/ching/capabilities.js'
import { mergeConversations, groupThreads, threadOfLocation } from '../src/utils/ching/conversation.js'
import { understandAssistant } from '../src/utils/ching/assistant.js'
import { planLive } from '../src/utils/ching/liveFill.js'
import { pickHotel, hotelPreference } from '../src/utils/ching/buildTrip.js'

let pass = 0
let fail = 0
function test(name, fn) {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}
const ids = (t) => readWishes(t).nodes.map((n) => n.id)

const P = (bb) => [{ room_type: 'Deluxe', price: bb, meal_plan: 'breakfast_only' }]
const H = (id, name, city, category, price) => ({ id, name, city, category, is_available: true, price_sections: P(price) })
const hotels = [
  H(1, 'Hotel Royal Batoo', 'Srinagar', '3', 3200), H(2, 'Naaz Kashmir Houseboat', 'Srinagar', '3', 3500), H(3, 'Hotel Grand Mumtaz', 'Srinagar', '4', 5200),
  H(4, 'Hotel Affarwat', 'Gulmarg', '3', 4500), H(5, 'Hotel Highlands Park', 'Gulmarg', '4', 9000),
  H(6, 'Hotel Mount View', 'Pahalgam', '3', 3800), H(7, 'Hotel Hilltop', 'Pahalgam', '3', 4000), H(8, 'Heevan Resort', 'Pahalgam', '4', 6000), H(9, 'Lidder Palace', 'Pahalgam', '5', 16000),
]
const catalog = {
  destinations: ['Srinagar', 'Gulmarg', 'Pahalgam'].map((name, i) => ({ id: i + 1, name, state: 'Jammu and Kashmir', activities: [] })),
  hotels,
  vehicles: [{ id: 22, name: 'Swift Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4, is_available: true }],
  activities: [],
  // What the agency ticked (Accommodation → hotel → "What it's like").
  memory: { hotelTags: { 7: ['riverside', 'quiet'], 8: ['riverside', 'family', 'spa'], 4: ['near-gondola'], 3: ['central', 'family', 'lift'] } },
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-10-13'
const blank = () => ({ tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2', template: 'ModernTemplate' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], otherCosts: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true })
const plan = (text) => planLive(blank(), text, { catalog, settings, today })

console.log('Ching meaning / capability / conversation tests')

test('the tree is sound: every leaf points at real tags, every tag can be reached', () => {
  const leaves = MEANING_TREE.filter((n) => n.words)
  for (const n of leaves) for (const t of [...n.want, ...n.nice]) assert.ok(ALL_TAGS.includes(t), `${n.id} → ${t}`)
  for (const n of leaves) assert.ok(MEANING_TREE.some((b) => b.id === n.parent && !b.parent), `${n.id} hangs off a branch`)
  assert.equal(meaningBranches().reduce((n, b) => n + b.children.length, 0), leaves.length)
  assert.equal(new Set(ALL_TAGS).size, ALL_TAGS.length)
})

test('what was said → the branch it means', () => {
  assert.deepEqual(ids('i want to take a relaxing vacation'), ['mood.calm'])
  assert.deepEqual(ids('rooms with a river view please'), ['setting.river'])
  assert.deepEqual(ids('good views like the riverside or something'), ['setting.river']) // the exact view replaces "a good view"
  assert.deepEqual(ids('some place with a nice view'), ['setting.view'])
  assert.deepEqual(ids('honeymoon on a houseboat'), ['mood.romantic', 'stay.houseboat'])
  assert.deepEqual(ids("it's just my parents and my baby"), ['party.seniors', 'party.baby'])
  assert.deepEqual(ids('near the gondola'), ['where.gondola', 'do.gondola'])
  assert.deepEqual(ids('open the ledger'), [])
  assert.equal(readWishes('relaxing').nodes[0].path, 'Mood › Relaxing')
})

test('wishes against are not wishes', () => {
  assert.deepEqual(ids('not a houseboat, a proper hotel'), [])
  assert.deepEqual(ids("we don't want a resort"), [])
  assert.deepEqual(ids('nothing by the river, somewhere central'), ['where.central'])
})

test("a hotel's tags: what the agency ticked, plus what its name says", () => {
  assert.deepEqual(inferHotelTags(hotels[1]), ['houseboat'])
  assert.deepEqual(inferHotelTags(hotels[8]), ['riverside', 'heritage', 'luxury'])
  assert.deepEqual(hotelTags(hotels[6], catalog.memory.hotelTags), ['riverside', 'quiet'])
  assert.deepEqual(hotelTags(hotels[7], catalog.memory.hotelTags), ['riverside', 'family', 'spa', 'resort'])
  assert.equal(toTag('River side'), 'riverside')
  assert.equal(toTag('lake view'), 'lake-view')
  assert.equal(toTag('pet friendly'), 'pets')
  assert.equal(toTag('purple'), null)
  assert.deepEqual(matchHotel(hotels[6], readWishes('quiet place by the river'), catalog.memory.hotelTags).met, ['By the river', 'Relaxing'])
})

test('the wish picks the hotel — inside the class of the trip', () => {
  const pick = (city, said, extra = {}) => pickHotel(city, hotels, { ...hotelPreference(said), ...extra }, catalog.memory)?.name
  assert.equal(pick('Pahalgam', '3 star'), 'Hotel Mount View') // no wish: the middle of the class
  assert.equal(pick('Pahalgam', 'riverside 3 star'), 'Hotel Hilltop')
  assert.equal(pick('Pahalgam', 'somewhere with a spa', { softStars: '3' }), 'Heevan Resort') // one star up for a wish
  assert.notEqual(pick('Pahalgam', 'riverside', { softStars: '3' }), 'Lidder Palace') // never a 5-star on a 3-star trip
  assert.equal(pick('Srinagar', 'stay on a houseboat'), 'Naaz Kashmir Houseboat') // read from the name, nothing ticked
  assert.equal(pick('Gulmarg', 'near the gondola'), 'Hotel Affarwat')
})

test('a planned trip follows the wishes and says so', () => {
  const r = plan('relaxing kashmir trip by the river for 2 adults 5 nights from 10 november')
  const s = r.snapshot
  assert.equal(s.tripInfo.clientName, '') // "relaxing" is what the trip is like, not who it is for
  const pah = s.accommodations.find((a) => a.city === 'Pahalgam')
  assert.equal(pah.name, 'Hotel Hilltop')
  assert.ok(r.changes.some((c) => /^Pahalgam: Hotel Hilltop · \d nights? \(picked for you: by the river, relaxing\)$/.test(c)), r.changes.join(' | '))
  // …and where nothing is tagged for it, the agent is told once, not left guessing.
  const note = r.warnings.find((w) => /^Asked for “by the river”/.test(w))
  assert.ok(note && /Srinagar/.test(note) && /Gulmarg/.test(note) && !/Pahalgam/.test(note), r.warnings.join(' | '))
})

test('with few nights, the towns of the kind wished for are the ones kept', () => {
  const calm = plan('a relaxing kashmir trip for 2 adults 3 nights from 10 november').snapshot.accommodations.map((a) => a.city)
  assert.ok(calm.includes('Pahalgam'), calm.join(','))
  const snow = plan('kashmir trip to see snow for 2 adults 3 nights from 10 november').snapshot.accommodations.map((a) => a.city)
  assert.ok(snow.includes('Gulmarg'), snow.join(','))
})

test('Ching tags hotels and finds them by tag, without stealing the rate search', () => {
  assert.deepEqual(understandAssistant('tag heevan resort as riverside and quiet'), { type: 'tag', hotel: 'heevan resort', add: ['riverside', 'quiet'], remove: [], placeAdd: ['quiet'], placeRemove: [] })
  assert.deepEqual(understandAssistant('remove the riverside tag from heevan resort'), { type: 'tag', hotel: 'heevan resort', add: [], remove: ['riverside'], placeAdd: [], placeRemove: [] })
  // A destination's own tags ("snow", "skiing") are not hotel tags.
  assert.deepEqual(understandAssistant('tag gulmarg as snow and skiing'), { type: 'tag', hotel: 'gulmarg', add: [], remove: [], placeAdd: ['snow', 'skiing'], placeRemove: [] })
  const q = understandAssistant('which hotels are riverside in pahalgam')
  assert.deepEqual([q.type, q.city, q.said], ['tagged', 'pahalgam', ['by the river']])
  assert.equal(understandAssistant('show me quiet hotels in gulmarg').type, 'tagged')
  assert.notEqual(understandAssistant('find a 4 star in srinagar under 6000 with breakfast', { inBuilder: true })?.type, 'tagged')
  assert.notEqual(understandAssistant("mark rahul's trip as confirmed")?.type, 'tag')
  assert.equal(understandAssistant('clear our conversation').type, 'clear-conversation')
})

test('help answers from the capability tree, branch by branch', () => {
  assert.deepEqual(helpAsk('help'), { topic: '' })
  assert.deepEqual(helpAsk('what can you do with payments?'), { topic: 'payments' })
  assert.equal(helpAsk('help me plan a kashmir trip for 4 people from 10 november'), null) // a request, not a question
  assert.equal(branchFor('payments').id, 'money')
  assert.equal(branchFor('hotels').id, 'find')
  assert.equal(branchFor('destinations').id, 'where')
  assert.equal(branchFor('upgrade').id, 'options')
  assert.equal(branchFor('voice note').id, 'client')
  assert.match(helpReply(''), /^I can plan a trip, suggest where a client should go, read a client’s voice note or message, find hotels/)
  assert.match(helpReply('payments'), /Rahul paid 20000 by UPI/)
  for (const b of CAPABILITY_TREE) assert.ok(b.examples.length && b.covers && b.can, b.id)
  assert.equal(understandAssistant('help with hotels').type, 'smalltalk')
})

test('the kept conversation: two copies merge, lines file under their trip', () => {
  const L = (role, text, at, thread) => ({ role, text, at, thread })
  const local = { lines: [L('you', 'plan a kashmir trip', 1000, 'draft:a'), L('ching', 'From which date?', 1500, 'draft:a')], threads: { 'draft:a': { title: 'Kashmir 4N/5D', at: 1 } }, pending: { text: 'kashmir trip', at: 1500 } }
  const remote = { lines: [L('you', 'plan a kashmir trip', 1400, 'draft:a'), L('you', 'open the ledger', 500, 'general'), L('ching', 'Opening the ledger.', 600, 'general')], threads: { general: { title: 'General', at: 1 } }, pending: { text: 'older', at: 900 } }
  const m = mergeConversations(local, remote)
  assert.deepEqual(m.lines.map((l) => l.text), ['open the ledger', 'Opening the ledger.', 'plan a kashmir trip', 'From which date?']) // the same line said once
  assert.equal(m.pending.text, 'kashmir trip') // the newer request wins
  const t = groupThreads(m.lines, m.threads)
  assert.deepEqual(t.map((x) => [x.id, x.title, x.lines.length]), [['draft:a', 'Kashmir 4N/5D', 2], ['general', 'General', 2]])
  assert.equal(threadOfLocation({ pathname: '/trip-builder', search: '?d=abc' }), 'draft:abc')
  assert.equal(threadOfLocation({ pathname: '/assistant', search: '?trip=TRP9' }), 'trip:TRP9')
  assert.equal(threadOfLocation({ pathname: '/trip-builder/TRP7', search: '' }), 'trip:TRP7')
  assert.equal(threadOfLocation({ pathname: '/dashboard', search: '?d=abc' }), 'general')
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
