// Ching's guided trip (utils/ching/guide.js): Trip Info asked field by field,
// the Itinerary day by day, Logistics through the Add Accommodation / Add
// Transport forms — and nothing filled that the agent didn't say.
//   node frontend/scripts/ching-guide.test.mjs
import assert from 'node:assert/strict'
import { startGuide, guideStep, startLogistics, guidePreview, repairTripInfo, isCorrection, correctTripInfo } from '../src/utils/ching/guide.js'
import { fixDurationText, readNights } from '../src/utils/ching/duration.js'
import { applyEditActions } from '../src/utils/ching/editTrip.js'

const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', activities: ['Shikara ride on Dal Lake'] }, { id: 2, name: 'Gulmarg', activities: ['Gondola'] },
    { id: 3, name: 'Pahalgam', activities: [] }, { id: 4, name: 'Sonamarg', activities: [] },
  ],
  hotels: [
    { id: 11, name: 'Hotel Grand Mumtaz', city: 'Srinagar', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 5200, meal_plan: 'breakfast_only' }, { room_type: 'Deluxe', price: 6400, meal_plan: 'breakfast_dinner' }, { room_type: 'Super Deluxe', price: 7000 }] },
    { id: 12, name: 'The Lalit Grand Palace', city: 'Srinagar City', category: '5', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 9000 }] },
    { id: 13, name: 'Hotel Highlands Park', city: 'Gulmarg', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 7000 }] },
    { id: 15, name: 'Heevan Resort', city: 'Pahalgam', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 6000 }] },
  ],
  vehicles: [
    { id: 21, name: 'Toyota Innova Crysta', price: 4000, rate_type: 'per_day', seating_capacity: 6, is_available: true },
    { id: 22, name: 'Swift Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4, is_available: true },
    { id: 60, name: 'Sunset Shikara', price: 1500, seating_capacity: 4, vehicle_type: 'Shikara', is_available: true },
  ],
  standard: { inclusions: ['Accommodation on twin sharing', 'Daily breakfast'], exclusions: ['Airfare'] },
}
const settings = { gst_percentage: 5, profit_percentage: 10 }
// The builder's blank form (its own defaults: 2 adults, today, 2 nights).
const blank = () => ({ tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: '2026-10-12', duration: '2', template: 'ModernTemplate' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], otherCosts: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true })

// A stand-in Trip Builder: runs the guide's ops the way the bridge does.
function builder(snap) {
  const b = { snap, forms: {}, tabs: [] }
  b.ctx = () => ({ snapshot: b.snap, catalog, today: '2026-10-12', plan: (a) => applyEditActions(b.snap, a, { catalog, settings }) })
  b.run = (ops) => {
    for (const o of ops) {
      if (o.op === 'tab') b.tabs.push(o.tab)
      else if (o.op === 'patch') b.snap = { ...b.snap, tripInfo: { ...b.snap.tripInfo, ...(o.tripInfo || {}) }, ...(o.includeGST != null ? { includeGST: o.includeGST } : {}), ...(o.inclusions ? { inclusions: o.inclusions } : {}), ...(o.exclusions ? { exclusions: o.exclusions } : {}) }
      else if (o.op === 'day') b.snap = { ...b.snap, itinerary: [...b.snap.itinerary.filter((d) => d.day !== o.day), { id: o.day, day: o.day, title: o.title, destination: o.name, destinationId: o.destinationId, location: o.location }].sort((x, y) => x.day - y.day) }
      else if (o.op === 'apply') b.snap = applyEditActions(b.snap, o.actions, { catalog, settings }).snapshot
      else if (o.op === 'hotelForm') b.forms.hotel = o.form
      else if (o.op === 'cabForm') b.forms.cab = o.form
      else if (o.op === 'closeForms') b.forms = {}
    }
  }
  return b
}
function converse(b, lines) {
  const g = startGuide(lines[0], b.ctx())
  b.run(g.ops)
  const said = [g.say]
  for (const line of lines.slice(1)) {
    const r = guideStep(g.state, line, b.ctx())
    assert.ok(r.handled, `"${line}" was not understood (asked: ${said[said.length - 1]})`)
    b.run(r.ops)
    said.push(r.say)
  }
  return { state: g.state, said }
}

let pass = 0
let fail = 0
const test = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (e) {
    fail++
    console.log(`  FAIL ${name}\n       ${e.message}`)
  }
}
console.log('Ching guided trip tests')

test('a whole trip, step by step, through every tab', () => {
  const b = builder(blank())
  const { said } = converse(b, [
    'create a trip', 'Shah', '9876543210', 'shah at gmail dot com', '4', '3 kids', '18 february 2027', '5 nights',
    'srinagar and gulmarg', 'yes', 'classic', 'yes', 'no', 'standard', 'airfare and lunch',
    'srinagar', 'srinagar', 'srinagar to gulmarg', 'day trip to sonamarg', 'gulmarg to pahalgam', 'departure',
    'add hotel', 'grand mumtaz', 'deluxe', '2 rooms', 'breakfast and dinner', 'no bed', 'save',
    'yes', 'highlands park 2 rooms breakfast and dinner', 'save', 'yes', 'heevan resort 2 rooms with breakfast', 'save',
    'add transport', 'innova', 'all days', '2', 'save', 'done',
  ])
  const s = b.snap
  const ti = s.tripInfo
  assert.match(said[0], /client's name/)
  assert.deepEqual([ti.clientName, ti.clientPhone, ti.clientEmail, ti.adults, ti.kids5to12, ti.startDate, ti.duration], ['Shah', '+919876543210', 'shah@gmail.com', 4, 3, '2027-02-18', '5'])
  assert.deepEqual([ti.destination, ti.tripTitle, ti.template, s.includeGST, ti.useFlight], ['Srinagar - Gulmarg', 'Srinagar - Gulmarg 5N/6D', 'ClassicTemplate', true, false])
  assert.deepEqual(s.inclusions, ['Accommodation on twin sharing', 'Daily breakfast'])
  assert.deepEqual(s.exclusions, ['Airfare', 'Lunch'])
  assert.deepEqual(s.itinerary.map((d) => [d.day, d.destinationId, d.location, d.title]), [
    [1, 1, 'Srinagar', 'Day 1: Arrival in Srinagar'], [2, 1, 'Srinagar', 'Day 2: Srinagar Sightseeing'], [3, 2, 'Gulmarg', 'Day 3: Srinagar to Gulmarg'],
    [4, 4, 'Gulmarg', 'Day 4: Day trip to Sonamarg'], [5, 3, 'Pahalgam', 'Day 5: Gulmarg to Pahalgam'], [6, 3, 'Pahalgam', 'Day 6: Departure from Pahalgam'],
  ])
  assert.deepEqual(s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut, a.roomType, String(a.rooms), a.mealPlan, Number(a.pricePerRoom), String(a.cnbCount)]), [
    [11, '2027-02-18', '2027-02-20', 'Deluxe', '2', 'Breakfast + Dinner', 6400, '3'],
    [13, '2027-02-20', '2027-02-22', 'Deluxe', '2', 'Breakfast + Dinner', 7000, '3'],
    [15, '2027-02-22', '2027-02-23', 'Deluxe', '2', 'Only Room + Breakfast', 6000, '3'],
  ])
  assert.equal(s.transportation.length, 6)
  assert.ok(s.transportation.every((t) => t.vehicleId === 21 && t.quantity === 2))
  assert.equal(s.transportation[3].route, 'Gulmarg → Sonamarg → Gulmarg')
  assert.equal(s.transportation[3].tripType, 'Day Trip')
  assert.deepEqual([...new Set(b.tabs)], ['Trip Info', 'Itinerary', 'Logistics', 'Pricing'])
})

test('nothing assumed: "create a trip" alone fills nothing, even over the form defaults', () => {
  const b = builder(blank())
  const g = startGuide('create a trip', b.ctx())
  b.run(g.ops)
  assert.equal(g.ops.filter((o) => o.op === 'patch').length, 0)
  assert.match(g.say, /client's name/)
  // and the form's default "2 adults" is still asked
  const st = g.state
  for (const a of ['Rahul', 'skip', 'skip']) b.run(guideStep(st, a, b.ctx()).ops)
  assert.equal(st.ask, 'adults')
})

test('details said up front are taken; only the rest is asked', () => {
  const b = builder(blank())
  const g = startGuide('create a trip for Shah 4 adults and 3 kids from 18 february 2027 for 5 nights srinagar 3 nights gulmarg 2 nights', b.ctx())
  b.run(g.ops)
  const ti = b.snap.tripInfo
  assert.deepEqual([ti.clientName, ti.adults, ti.kids5to12, ti.startDate, ti.duration], ['Shah', 4, 3, '2027-02-18', '5'])
  assert.match(g.say, /phone/)
  // destination offered from the stays said, and the days laid out from them
  for (const a of ['skip', 'skip']) b.run(guideStep(g.state, a, b.ctx()).ops)
  const r = guideStep(g.state, 'yes', b.ctx())
  b.run(r.ops)
  assert.equal(b.snap.tripInfo.destination, 'Srinagar - Gulmarg')
  for (const a of ['yes', 'modern', 'yes', 'no', 'none', 'none']) b.run(guideStep(g.state, a, b.ctx()).ops)
  assert.deepEqual(b.snap.itinerary.map((d) => d.location), ['Srinagar', 'Srinagar', 'Srinagar', 'Gulmarg', 'Gulmarg', 'Gulmarg'])
  assert.equal(g.state.step, 'logistics')
  assert.equal(b.snap.accommodations.length, 0) // no hotel picked for the agent
  assert.equal(b.snap.transportation.length, 0) // no cab picked either
})

test('hotel: wrong city refused, options listed, room type / rooms / meal asked', () => {
  const b = builder({ ...blank(), tripInfo: { ...blank().tripInfo, clientName: 'Rahul', startDate: '2026-11-10', duration: '2', adults: 2 }, itinerary: [1, 2, 3].map((d) => ({ id: d, day: d, title: `Day ${d}: Srinagar`, destination: 'Srinagar', destinationId: 1, location: 'Srinagar' })) })
  const g = startLogistics('add hotel', b.ctx())
  b.run(g.ops)
  assert.match(g.say, /Which hotel in Srinagar.*Grand Mumtaz/)
  assert.equal(b.forms.hotel.city, 'Srinagar')
  let r = guideStep(g.state, 'highlands park', b.ctx())
  assert.match(r.say, /Highlands Park is in Gulmarg, not Srinagar/)
  r = guideStep(g.state, 'grand mumtaz', b.ctx())
  b.run(r.ops)
  assert.match(r.say, /Deluxe or Super Deluxe/)
  assert.equal(b.forms.hotel.name, 'Hotel Grand Mumtaz')
  r = guideStep(g.state, 'super deluxe 1 room room only', b.ctx())
  b.run(r.ops)
  assert.match(r.say, /Say "save"/)
  r = guideStep(g.state, 'save', b.ctx())
  b.run(r.ops)
  assert.deepEqual(b.snap.accommodations.map((a) => [a.hotelId, a.roomType, String(a.rooms), a.mealPlan]), [[11, 'Super Deluxe', '1', 'Only Room']])
})

test('cab: only road cabs offered, days asked, quantity asked when the group needs two', () => {
  const b = builder({ ...blank(), tripInfo: { ...blank().tripInfo, clientName: 'Rahul', startDate: '2026-11-10', duration: '2', adults: 7 }, itinerary: [1, 2, 3].map((d) => ({ id: d, day: d, title: `Day ${d}: Srinagar`, destination: 'Srinagar', destinationId: 1, location: 'Srinagar' })) })
  const g = startLogistics('add a car', b.ctx())
  assert.match(g.say, /Which vehicle\?/)
  assert.doesNotMatch(g.say, /Shikara/)
  let r = guideStep(g.state, 'innova for day 1 and 3', b.ctx())
  assert.match(r.say, /how many vehicles/)
  r = guideStep(g.state, '2', b.ctx())
  b.run(r.ops)
  r = guideStep(g.state, 'save', b.ctx())
  b.run(r.ops)
  assert.deepEqual(b.snap.transportation.map((t) => [t.date, t.vehicleId, t.quantity]), [['2026-11-10', 21, 2], ['2026-11-12', 21, 2]])
})

test('stop → discard throws the unsaved trip away; back re-asks the last field', () => {
  const b = builder(blank())
  const g = startGuide('create a trip', b.ctx())
  let r = guideStep(g.state, 'Rahul', b.ctx())
  r = guideStep(g.state, 'go back', b.ctx())
  assert.match(r.say, /client's name/)
  r = guideStep(g.state, 'stop', b.ctx())
  assert.match(r.say, /save.*discard/)
  r = guideStep(g.state, 'discard', b.ctx())
  assert.deepEqual(r.ops.map((o) => o.op), ['discard'])
  assert.ok(r.done)
})

test('an answer the guide cannot use is passed on (Ching handles it, then asks again)', () => {
  const b = builder(blank())
  const g = startGuide('create a trip', b.ctx())
  guideStep(g.state, 'Rahul', b.ctx())
  const r = guideStep(g.state, "what's the weather like", b.ctx())
  assert.equal(r.handled, false)
})


test('a misheard "4N 5D" title ("495") is written as 4N/5D', () => {
  const b = builder(blank())
  converse(b, ['create a trip', 'Bilal', 'skip', 'skip', '2', 'no kids', '18 february 2027', '4 nights', 'kashmir', 'Kashmir 495'])
  assert.equal(b.snap.tripInfo.tripTitle, 'Kashmir 4N/5D')
  for (const [said, want] of [['Kashmir 4 9 5', 'Kashmir 4N/5D'], ['Kashmir four N five D', 'Kashmir 4N/5D'], ['Kashmir 4 nights 5 days', 'Kashmir 4N/5D'], ['Kashmir Honeymoon 2027', 'Kashmir Honeymoon 2027']]) {
    assert.equal(fixDurationText(said.replace('four N five D', '4 n 5 d'), 4), want)
  }
  assert.equal(readNights('495'), 4)
  assert.equal(readNights('4N 5D'), 4)
})

test('"correct it" mends the last field written; "correct the title to …" sets it', () => {
  const b = builder(blank())
  const { state } = converse(b, ['create a trip', 'Bilal', 'skip', 'skip', '2', 'no kids', '18 february 2027', '4 nights', 'kashmir'])
  // Simulate a title written badly before this fix existed.
  state.v.tripTitle = 'Kashmir 495'
  state.answered_.tripTitle = true
  state.lastKey = 'tripTitle'
  b.snap.tripInfo.tripTitle = 'Kashmir 495'
  let r = guideStep(state, 'correct it', b.ctx())
  assert.ok(r.handled)
  b.run(r.ops)
  assert.equal(b.snap.tripInfo.tripTitle, 'Kashmir 4N/5D')
  assert.match(r.say, /Fixed — the title is now "Kashmir 4N\/5D"/)
  r = guideStep(state, 'correct the title to Kashmir Honeymoon Special', b.ctx())
  b.run(r.ops)
  assert.equal(b.snap.tripInfo.tripTitle, 'Kashmir Honeymoon Special')
  r = guideStep(state, "that's wrong, the name should be Mr Bilal Ahmad", b.ctx())
  b.run(r.ops)
  assert.equal(b.snap.tripInfo.clientName, 'Mr Bilal Ahmad')
  // Nothing to mend by itself → Ching asks, and the next answer goes to that field.
  r = guideStep(state, 'fix the destination', b.ctx())
  assert.match(r.say, /what should the destination be/i)
  r = guideStep(state, 'srinagar and gulmarg', b.ctx())
  b.run(r.ops)
  assert.equal(b.snap.tripInfo.destination, 'Srinagar - Gulmarg')
  assert.match(r.say, /Fixed/)
  // "correct" alone is still a yes, never a correction.
  assert.equal(isCorrection('correct'), false)
  assert.equal(isCorrection('theek hai'), false)
  assert.equal(isCorrection('galat hai'), true)
})

test('a correction of the itinerary asks that day again', () => {
  const b = builder(blank())
  const { state } = converse(b, ['create a trip', 'Bilal', 'skip', 'skip', '2', 'no kids', '18 february 2027', '2 nights', 'kashmir', 'yes', 'modern', 'yes', 'no', 'none', 'none', 'srinagar', 'gulmarg'])
  let r = guideStep(state, 'wrong', b.ctx())
  assert.match(r.say, /day 2/i)
  r = guideStep(state, 'pahalgam', b.ctx())
  b.run(r.ops)
  assert.equal(b.snap.itinerary.find((d) => d.day === 2).location, 'Pahalgam')
})

test('the field is written while the agent is still speaking', () => {
  const b = builder(blank())
  const g = startGuide('create a trip', b.ctx())
  // Asked for the client's name: each partial transcript fills it.
  assert.equal(guidePreview(g.state, 'Mr', b.ctx()), null)
  assert.equal(guidePreview(g.state, 'Mr Bil', b.ctx()).tripInfo.clientName, 'Mr Bil')
  assert.equal(guidePreview(g.state, 'client name Mr Bilal', b.ctx()).tripInfo.clientName, 'Mr Bilal')
  // A field named out of turn.
  assert.equal(guidePreview(g.state, 'phone 98765 43210', b.ctx()).tripInfo.clientPhone, '+919876543210')
  // Nothing from the guide's own words.
  assert.equal(guidePreview(g.state, 'skip', b.ctx()), null)
  // No guide yet: only a labelled field.
  assert.equal(guidePreview(null, 'client name Mr Bilal', b.ctx()).tripInfo.clientName, 'Mr Bilal')
  assert.equal(guidePreview(null, 'create a trip for', b.ctx()), null)
  // The guide started with "client name Mr Bilal" keeps the name as said.
  const g2 = startGuide('client name Mr Bilal', b.ctx())
  assert.equal(g2.state.v.clientName, 'Mr Bilal')
  assert.match(g2.say, /Bilal's phone/)
})

test('"correct it" on an open trip mends a misheard title', () => {
  const r = repairTripInfo({ tripTitle: 'Kashmir 495', duration: '4', clientName: 'Bilal' })
  assert.equal(r.patch.tripInfo.tripTitle, 'Kashmir 4N/5D')
  assert.equal(repairTripInfo({ tripTitle: 'Kashmir Delight', duration: '4', clientName: 'Bilal' }), null)
  const ctx = { snapshot: { tripInfo: { tripTitle: 'Kashmir 495', duration: '4', clientName: 'Bilal' } }, catalog, today: '2026-10-12' }
  assert.equal(correctTripInfo('correct it', ctx).patch.tripInfo.tripTitle, 'Kashmir 4N/5D')
  assert.equal(correctTripInfo('correct the client name to Mr Bilal Shah', ctx).patch.tripInfo.clientName, 'Mr Bilal Shah')
  assert.equal(correctTripInfo('fix the hotel on day 3', ctx), null) // a hotel change belongs to the trip editor
  assert.equal(correctTripInfo('make it 3 nights', ctx), null)
  assert.equal(guidePreview(null, 'client name', ctx), null)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
