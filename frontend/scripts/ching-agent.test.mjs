// The travel-agent moves (2026-10-14): where to go by meaning (whereTo.js),
// three hotels for a stay (stayOptions.js), and the shape of a missed request
// (insight.js).
//   node frontend/scripts/ching-agent.test.mjs
import assert from 'node:assert/strict'
import { suggestPlaces, whereReply, whereAsk, pickPlaces, inferPlaceTags, placeTags, toPlaceTag, ALL_PLACE_TAGS, sellablePlaces } from '../src/utils/ching/whereTo.js'
import { stayOptions, optionsLine, optionMeant, nightRate } from '../src/utils/ching/stayOptions.js'
import { planLive } from '../src/utils/ching/liveFill.js'
import { buildTripDraft } from '../src/utils/ching/tripDraft.js'
import { applyEditActions, buildEditContext } from '../src/utils/ching/editTrip.js'
import { understandAssistant } from '../src/utils/ching/assistant.js'
import { hotelPreference } from '../src/utils/ching/buildTrip.js'
import { shapeOf, missEvent, scrub, pctText } from '../src/utils/ching/insight.js'

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

const P = (bb, map) => [{ room_type: 'Deluxe', price: bb, meal_plan: 'breakfast_only' }, { room_type: 'Deluxe', price: map, meal_plan: 'breakfast_dinner' }]
const H = (id, name, city, category, bb) => ({ id, name, city, category, is_available: true, price_sections: P(bb, bb + 1200) })
const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', state: 'Jammu and Kashmir', activities: ['Dal Lake Shikara', 'Mughal Gardens'] },
    { id: 2, name: 'Gulmarg', state: 'Jammu and Kashmir', activities: ['Gondola Phase 1'] },
    { id: 3, name: 'Pahalgam', state: 'Jammu and Kashmir', activities: ['Betaab Valley', 'River Rafting'] },
    { id: 4, name: 'Leh', state: 'Ladakh', activities: ['Thiksey Monastery'] },
    { id: 5, name: 'Yusmarg', state: 'Jammu and Kashmir', activities: [] }, // no hotel there: never suggested
  ],
  hotels: [
    H(11, 'Hotel Grand Mumtaz', 'Srinagar', '4', 5200), H(12, 'The Lalit Grand Palace', 'Srinagar', '5', 14000), H(13, 'Hotel Royal Batoo', 'Srinagar', '3', 3200), H(14, 'Hotel City Star', 'Srinagar', '3', 2600),
    H(15, 'Hotel Highlands Park', 'Gulmarg', '4', 9000), H(17, 'Hotel Affarwat', 'Gulmarg', '3', 4500),
    H(18, 'Heevan Resort', 'Pahalgam', '4', 6000), H(19, 'Hotel Mount View', 'Pahalgam', '3', 3800),
    H(21, 'The Grand Dragon', 'Leh', '4', 8000),
    { ...H(22, 'Closed Inn', 'Gulmarg', '3', 1000), is_available: false },
  ],
  vehicles: [{ id: 31, name: 'Swift Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4, is_available: true }],
  activities: [{ id: 41, name: 'Gondola Phase 1', destination_id: 2, selling_price: 1200 }],
  memory: { hotelTags: { 19: ['riverside'] }, placeTags: {} },
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-10-14'
const blank = () => ({ tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2', template: 'ModernTemplate' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], otherCosts: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true })
const names = (r) => r.places.map((p) => p.name)

console.log('Ching travel-agent moves')

// ── where to go
test('place tags: a known town, its own activities, and the agency’s ticks', () => {
  assert.ok(['snow', 'gondola', 'skiing'].every((t) => inferPlaceTags(catalog.destinations[1]).includes(t)))
  assert.ok(inferPlaceTags({ name: 'Somewhere New', activities: ['Camel Safari in the dunes', 'Old Fort'] }).includes('desert'))
  assert.deepEqual(placeTags(catalog.destinations[1], { 2: ['quiet'] }), ['quiet']) // the agency's own list replaces what Ching knew
  assert.equal(toPlaceTag('pony ride'), 'pony-rides')
  assert.equal(toPlaceTag('riverside'), null) // a hotel tag, not a place tag
  assert.equal(new Set(ALL_PLACE_TAGS).size, ALL_PLACE_TAGS.length)
  assert.deepEqual(sellablePlaces(catalog).map((p) => p.name), ['Srinagar', 'Gulmarg', 'Pahalgam', 'Leh'])
})

test('one wish: the places for it, best first, each with why', () => {
  const r = suggestPlaces('where should they go for snow', catalog)
  assert.deepEqual(names(r), ['Gulmarg'])
  assert.match(whereReply(r), /^For snow I would suggest: 1\. Gulmarg \(snow\)\. Say “plan the first one”, or name it\.$/)
  const g = suggestPlaces('somewhere to ride the gondola', catalog).places[0]
  assert.deepEqual([g.name, g.activities], ['Gulmarg', ['Gondola Phase 1']]) // a real thing to do there, from the catalog
})

test('two people, two wishes: no one place, so the places that together do', () => {
  const r = suggestPlaces('i want shopping but my husband wants snow', catalog)
  assert.deepEqual(r.wishes, ['Snow', 'Shopping'])
  assert.deepEqual([...r.cover.places].sort(), ['Gulmarg', 'Srinagar'])
  assert.match(whereReply(r), /^No single place has all of that\. Together: /)
  assert.match(whereReply(r), /Say “plan both”, or “plan the first one”\.$/)
})

test('who is travelling rules places out, and is never a reason on its own', () => {
  const r = suggestPlaces('monasteries, we have a baby with us', catalog)
  assert.equal(r.places[0].name, 'Leh')
  assert.match(r.places[0].caution, /high altitude: hard going with a baby/)
  assert.deepEqual(suggestPlaces('a family trip', catalog).places, []) // "family" alone picks nowhere
  assert.match(whereReply(suggestPlaces('where should we go', catalog)), /^Tell me what they would enjoy/)
  assert.match(whereReply(suggestPlaces('somewhere with a beach', catalog)), /^None of your destinations is tagged for beach yet/)
  assert.deepEqual(names(suggestPlaces('a quiet place by the river', catalog, { region: 'Ladakh' })), [])
})

test('asking where, and picking from the answer', () => {
  assert.ok(whereAsk('Where should they go for snow and shopping?'))
  assert.ok(whereAsk("client is not sure where, wants something quiet"))
  assert.equal(whereAsk('plan a kashmir trip for 4 people'), null)
  assert.equal(understandAssistant('which place is best for trekking').type, 'where')
  assert.equal(understandAssistant('plan the first one').type, 'where-pick')
  assert.deepEqual(pickPlaces('the second one', ['Gulmarg', 'Srinagar']), ['Srinagar'])
  assert.deepEqual(pickPlaces('both', ['Gulmarg', 'Sonamarg', 'Srinagar'], ['Gulmarg', 'Srinagar']), ['Gulmarg', 'Srinagar'])
  assert.deepEqual(pickPlaces('lets do srinagar', ['Gulmarg', 'Srinagar']), ['Srinagar'])
  assert.equal(pickPlaces('4 adults', ['Gulmarg', 'Srinagar']), null)
})

// ── three hotels for a stay
test('recommended, one that costs less, one step up — each with the difference', () => {
  const o = stayOptions('Srinagar', catalog.hotels, { softStars: '3' }, catalog.memory, { current: 13 })
  assert.deepEqual(o.map((x) => [x.name, x.role]), [['Hotel Royal Batoo', 'recommended'], ['Hotel City Star', 'cheaper'], ['Hotel Grand Mumtaz', 'upgrade']])
  assert.deepEqual(o.map((x) => x.delta), ['', '₹600 less a night', '₹2,000 more a night'])
  assert.equal(o[0].why, '3 star · ₹3,200 a night')
  assert.match(optionsLine(o), /^1\. Hotel Royal Batoo \(3 star · ₹3,200 a night\); 2\. Hotel City Star, costs less \(3 star · ₹2,600 a night, ₹600 less a night\); 3\. Hotel Grand Mumtaz, a step up/)
  // Never two classes up, never an unavailable hotel.
  assert.ok(!o.some((x) => x.name === 'The Lalit Grand Palace'))
  assert.ok(!stayOptions('Gulmarg', catalog.hotels, {}, catalog.memory, { current: 17 }).some((x) => x.name === 'Closed Inn'))
  assert.equal(nightRate(catalog.hotels[0], {}), 5200)
})

test('a wish carries into the options; one hotel in town is no choice', () => {
  const o = stayOptions('Pahalgam', catalog.hotels, { ...hotelPreference('riverside'), softStars: '3' }, catalog.memory)
  assert.deepEqual([o[0].name, o[0].met, o[0].why], ['Hotel Mount View', ['By the river'], '3 star · ₹3,800 a night · by the river'])
  assert.deepEqual(stayOptions('Leh', catalog.hotels, {}, catalog.memory).map((x) => x.role), ['recommended'])
  assert.deepEqual(stayOptions('Nowhere', catalog.hotels, {}, catalog.memory), [])
})

test('which option was meant', () => {
  const o = stayOptions('Srinagar', catalog.hotels, { softStars: '3' }, catalog.memory, { current: 13 })
  assert.equal(optionMeant('use the cheaper one', o).name, 'Hotel City Star')
  assert.equal(optionMeant('upgrade it', o).name, 'Hotel Grand Mumtaz')
  assert.equal(optionMeant('the third', o).name, 'Hotel Grand Mumtaz')
  assert.equal(optionMeant('go with hotel city star', o).name, 'Hotel City Star')
  assert.equal(optionMeant('whatever', o), null)
})

test('a planned trip carries its options to the draft card', () => {
  const r = planLive(blank(), 'kashmir trip for 2 adults 4 nights from 10 november', { catalog, settings, today })
  const draft = buildTripDraft(r.snapshot, r.draftMeta)
  const sri = draft.stays.find((g) => g.city === 'Srinagar')
  assert.ok(sri.options.length >= 2)
  assert.equal(String(sri.options[0].id), String(sri.hotelId)) // the planned hotel is the recommended one
  assert.ok(sri.options.slice(1).every((o) => o.delta))
})

test('offering the client a choice: the main hotel "or" the others', () => {
  const snap = planLive(blank(), 'kashmir trip for 2 adults 4 nights from 10 november', { catalog, settings, today }).snapshot
  const stay = buildEditContext(snap).stays.find((x) => x.city === 'Srinagar')
  const others = [14, 13, 11].filter((id) => String(id) !== String(stay.hotelId)).slice(0, 2)
  const res = applyEditActions(snap, [{ type: 'SET_STAY_OPTIONS', stay: stay.index, hotelIds: [stay.hotelId, ...others] }], { catalog, settings })
  const acc = res.snapshot.accommodations.find((a) => a.city === 'Srinagar')
  assert.deepEqual(acc.alternateOptions.map((o) => o.hotel_id), others) // the main hotel is not its own option
  assert.ok(acc.alternateOptions.every((o) => o.name && o.room_type === 'Deluxe' && o.price > 0 && o.package === 0 && /Star$/.test(o.category)))
  assert.match(res.changes[0], /^Srinagar: the client can choose .+ or .+ or .+$/)
  const cleared = applyEditActions(res.snapshot, [{ type: 'SET_STAY_OPTIONS', stay: stay.index, hotelIds: [] }], { catalog, settings })
  assert.deepEqual(cleared.snapshot.accommodations.find((a) => a.city === 'Srinagar').alternateOptions, [])
})

test('asking for options by voice', () => {
  const u = (t) => understandAssistant(t, { inBuilder: true })
  assert.deepEqual(u('options for gulmarg'), { type: 'stay-options', mode: 'show', city: 'gulmarg' })
  assert.deepEqual(u('what else in srinagar'), { type: 'stay-options', mode: 'show', city: 'srinagar' })
  assert.deepEqual(u('use the cheaper one in gulmarg'), { type: 'stay-options', mode: 'pick', role: 'cheaper', city: 'gulmarg' })
  assert.deepEqual(u('upgrade pahalgam'), { type: 'stay-options', mode: 'pick', role: 'upgrade', city: 'pahalgam' })
  assert.deepEqual(u('offer all three to the client'), { type: 'stay-options', mode: 'offer', city: '' })
  assert.deepEqual(u('remove the options in gulmarg'), { type: 'stay-options', mode: 'clear', city: 'gulmarg' })
  // Not about a stay's hotels.
  assert.equal(u('make it cheaper').type, 'optimize')
  assert.equal(u('use the first one').type, 'hotel-pick')
  assert.notEqual(u('what are my options for payment')?.type, 'stay-options')
})

// ── what Ching missed
test('a miss is logged by its shape, with nothing personal in it', () => {
  assert.equal(shapeOf('make gulmarg 3 nites', catalog), shapeOf('Make Pahalgam 2 nites', catalog))
  assert.equal(shapeOf('book heevan resort for rahul sharma from 10th november', catalog), 'book {hotel} for {name} from {date}')
  assert.equal(scrub('ring 98765 43210, mail a.b@c.in'), 'ring <phone> , mail <email>')
  const e = missEvent('unknown', 'swap the dzire on day 3 call +91 9876543210', { catalog, page: '/trip-builder' })
  assert.deepEqual([e.type, e.kind, e.page], ['miss', 'unknown', '/trip-builder'])
  assert.ok(!/\d{7}/.test(JSON.stringify(e)))
  assert.deepEqual([pctText(91.3), pctText(null)], ['91%', '–'])
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
