/* global process */
// Plain-Node tests for the Ching trip-edit engine.
// Run: node frontend/scripts/ching-edit.test.mjs
import assert from 'node:assert/strict'
import { priceBreakdown } from '../src/utils/ching/pricing.js'
import { buildEditContext, applyEditActions } from '../src/utils/ching/editTrip.js'

// ── Catalog (/api/builder/init shapes) ────────────────────────────────────
const catalog = {
  hotels: [
    { id: 1, name: 'The Lalit Grand Palace', city: 'Srinagar', category: '5', price_sections: [{ room_type: 'Deluxe', price: 12000, cnb: 2000, extra_adult: 3000 }] },
    { id: 2, name: 'Hotel Heevan', city: 'Srinagar', category: '4', price_sections: [{ room_type: 'Deluxe', price: 6500, cnb: 1200 }] },
    {
      id: 3,
      name: 'Khyber Himalayan Resort & Spa',
      city: 'Gulmarg',
      category: '5',
      price_sections: [
        { room_type: 'Deluxe', price: 15000, cnb: 2500, valid_from: '2026-11-01', valid_to: '2026-11-30' },
        { room_type: 'Deluxe', price: 22000, cnb: 3500, valid_from: '2026-12-01', valid_to: '2027-02-28' },
        { room_type: 'Deluxe', price: 14000, cnb: 2000 },
      ],
    },
    { id: 4, name: 'Welcomhotel Pine N Peak', city: 'Pahalgam', category: '5', price_sections: [{ room_type: 'Deluxe', price: 9000, cnb: 1500 }] },
    {
      id: 5,
      name: 'Hotel Highland Park',
      city: 'Gulmarg',
      category: '4',
      price_sections: [
        { room_type: 'Super Deluxe', price: 7000, cnb: 1000, valid_from: '2026-11-01', valid_to: '2026-11-30' },
        { room_type: 'Super Deluxe', price: 9500, cnb: 1400, valid_from: '2026-12-01', valid_to: '2027-03-31' },
      ],
    },
    { id: 6, name: 'Sonamarg Glacier Resort', city: 'Sonamarg', category: '3', image_path: '/img/sgr.jpg', price_sections: [{ room_type: 'Standard', price: 5000, cnb: 800 }] },
    { id: 7, name: 'Grand Mumtaz Resorts', city: 'Pahalgam', category: '4', is_available: false, price_sections: [{ room_type: 'Deluxe', price: 7000 }] },
  ],
  destinations: [
    { id: 11, name: 'Kashmir', activities: [] },
    { id: 12, name: 'Srinagar', activities: [{ name: 'Dal Lake Shikara Ride', cost: 0 }, { name: 'Mughal Gardens', cost: 0 }] },
    { id: 13, name: 'Gulmarg', activities: [{ name: 'Gondola Ride', cost: 1800 }, 'Golf Course'] },
    { id: 14, name: 'Pahalgam', activities: ['Betaab Valley', 'Aru Valley'] },
    { id: 15, name: 'Sonamarg', activities: ['Thajiwas Glacier'] },
  ],
  vehicles: [
    { id: 21, name: 'Innova Crysta', price: 4500, rate_type: 'per_day' },
    { id: 22, name: 'Sedan (Dzire)', price: 3000, rate_type: 'per_day' },
    { id: 23, name: 'Kashmir Package Cab', price: 25000, rate_type: 'per_trip' },
  ],
  activities: [
    { id: 31, name: 'Gondola Ride Phase 1', destination_id: 13, selling_price: 1800 },
    { id: 32, name: 'Shikara Ride', destination_id: 12, selling_price: 800 },
    { id: 33, name: 'Pony Ride', destination_id: 14, selling_price: 1200 },
  ],
}
const settings = { gst_percentage: 5, profit_percentage: 10, include_gst: true }

const SRI = ['Dal Lake Shikara Ride', 'Mughal Gardens']
const GUL = ['Gondola Ride (₹1,800)', 'Golf Course']
const PAH = ['Betaab Valley', 'Aru Valley']

const day = (n, rest, location, activities, destinationId) => ({
  id: 100 + n,
  day: n,
  title: `Day ${n}: ${rest}`,
  location,
  destinationId,
  description: activities.join('\n'),
  activities,
  photo: null,
})
const acc = (id, hotelId, name, city, checkIn, checkOut, price, cnb, extra = {}) => ({
  id,
  hotelId,
  name,
  city,
  category: '5 Star',
  roomType: 'Deluxe',
  rooms: '1',
  cnbCount: '0',
  extraBeds5To12Count: '0',
  extraBedsAbove12Count: '0',
  extraAdultCount: '0',
  mealPlan: 'Only Room + Breakfast',
  pricePerRoom: price,
  bedPrices: [{ category: 'cnb', price: cnb }],
  photo: null,
  checkIn,
  checkOut,
  cancelledAt: null,
  alternateOptions: [],
  markupPercentage: '',
  ...extra,
})
const cab = (id, date, tripType, route, destination) => ({
  id,
  vehicleId: 21,
  tripType,
  route,
  destination,
  date,
  vehicleType: 'Innova Crysta',
  quantity: 1,
  remarks: '',
  markupPercentage: '',
})

// 4N/5D Kashmir: Srinagar 2N (10–12 Nov), Gulmarg 1N (12–13), Pahalgam 1N (13–14).
function kashmir() {
  return {
    tripInfo: {
      tripId: 'TRP123456',
      tripTitle: 'Kashmir 4N/5D',
      destination: 'Kashmir',
      clientName: 'Rahul Sharma',
      clientPhone: '+91 98765 43210',
      clientEmail: '',
      adults: 2,
      kids5to12: 0,
      kidsUpto5: 0,
      startDate: '2026-11-10',
      duration: '4',
      cost: '0',
    },
    itinerary: [
      day(1, 'Arrival in Srinagar', 'Srinagar', SRI, 12),
      day(2, 'Srinagar Sightseeing', 'Srinagar', SRI, 12),
      day(3, 'Srinagar to Gulmarg', 'Gulmarg', GUL, 13),
      day(4, 'Gulmarg to Pahalgam via Tangmarg Apple Orchards', 'Pahalgam', ['Apple orchards', 'Betaab Valley'], 14),
      day(5, 'Departure from Pahalgam', 'Pahalgam', [], 14),
    ],
    accommodations: [
      acc(201, 1, 'The Lalit Grand Palace', 'Srinagar', '2026-11-10', '2026-11-12', 12000, 2000),
      acc(202, 3, 'Khyber Himalayan Resort & Spa', 'Gulmarg', '2026-11-12', '2026-11-13', 15000, 2500),
      acc(203, 4, 'Welcomhotel Pine N Peak', 'Pahalgam', '2026-11-13', '2026-11-14', 9000, 1500),
      // An old cancelled booking — not a stay, only its dates follow shifts.
      acc(209, 7, 'Grand Mumtaz Resorts', 'Pahalgam', '2026-11-13', '2026-11-14', 7000, 0, { cancelledAt: '2026-09-01' }),
    ],
    transportation: [
      cab(301, '2026-11-10', 'Transfer', 'Arrival in Srinagar', 'Srinagar'),
      cab(302, '2026-11-11', 'Sightseeing', 'Srinagar Sightseeing', 'Srinagar'),
      cab(303, '2026-11-12', 'Transfer', 'Srinagar → Gulmarg', 'Gulmarg'),
      cab(304, '2026-11-13', 'Transfer', 'Gulmarg → Pahalgam', 'Pahalgam'),
      cab(305, '2026-11-14', 'Transfer', 'Departure from Pahalgam', 'Pahalgam'),
    ],
    tripActivities: [
      { id: 401, activityId: 31, name: 'Gondola Ride', location: 'Gulmarg', dayNumber: 3, ticketCount: '2', pricePerTicket: 1800, markupPercentage: '', notes: '' },
    ],
    profitMarginPercentage: 10,
    gstPercentage: 5,
    includeGST: true,
  }
}

const run = (actions, snap = kashmir()) => applyEditActions(snap, actions, { catalog, settings })
const titles = (s) => s.itinerary.map((d) => d.title)
const dates = (s) => s.accommodations.map((a) => `${a.city}:${a.checkIn}>${a.checkOut}`)
const cabAt = (s, date) => s.transportation.filter((t) => t.date === date)
const findAcc = (s, id) => s.accommodations.find((a) => a.id === id)

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL ${name}\n       ${err.message.split('\n').join('\n       ')}`)
  }
}

// ── buildEditContext ──────────────────────────────────────────────────────
console.log('buildEditContext')
test('summarises the trip', () => {
  const c = buildEditContext(kashmir())
  assert.equal(c.tripId, 'TRP123456')
  assert.equal(c.clientName, 'Rahul Sharma')
  assert.equal(c.startDate, '2026-11-10')
  assert.equal(c.nights, 4)
  assert.deepEqual([c.adults, c.children, c.infants], [2, 0, 0])
  assert.deepEqual([c.marginPercent, c.gstPercent, c.includeGst], [10, 5, true])
})
test('stays exclude cancelled bookings, sorted by check-in', () => {
  const c = buildEditContext(kashmir())
  assert.deepEqual(
    c.stays.map((s) => [s.index, s.city, s.nights, s.hotelId]),
    [
      [0, 'Srinagar', 2, 1],
      [1, 'Gulmarg', 1, 3],
      [2, 'Pahalgam', 1, 4],
    ],
  )
  assert.equal(c.stays[0].hotelName, 'The Lalit Grand Palace')
  assert.equal(c.stays[0].mealPlan, 'Only Room + Breakfast')
})
test('days, activities and vehicle', () => {
  const c = buildEditContext(kashmir())
  assert.equal(c.days.length, 5)
  assert.deepEqual(c.days[2], { day: 3, title: 'Day 3: Srinagar to Gulmarg', location: 'Gulmarg', activities: GUL })
  assert.deepEqual(c.activities, [{ index: 0, name: 'Gondola Ride', dayNumber: 3, location: 'Gulmarg' }])
  assert.deepEqual(c.vehicle, { id: 21, name: 'Innova Crysta' })
})
test('accepts DD-MM-YYYY dates and description-only days', () => {
  const snap = kashmir()
  snap.accommodations[1].checkIn = '12-11-2026'
  snap.accommodations[1].checkOut = '2026-11-13T00:00:00.000Z'
  delete snap.itinerary[0].activities
  const c = buildEditContext(snap)
  assert.equal(c.stays[1].checkIn, '2026-11-12')
  assert.equal(c.stays[1].nights, 1)
  assert.deepEqual(c.days[0].activities, SRI)
})

// ── Stay nights ───────────────────────────────────────────────────────────
console.log('SET_STAY_NIGHTS / timeline')
test('Gulmarg 1 → 2 nights inserts a sightseeing day and shifts everything after', () => {
  const input = kashmir()
  const frozen = JSON.parse(JSON.stringify(input))
  const { snapshot: s, changes, warnings } = run([{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }], input)
  assert.deepEqual(input, frozen, 'input must not be mutated')
  assert.deepEqual(dates(s), [
    'Srinagar:2026-11-10>2026-11-12',
    'Gulmarg:2026-11-12>2026-11-14',
    'Pahalgam:2026-11-14>2026-11-15',
    'Pahalgam:2026-11-14>2026-11-15',
  ])
  assert.deepEqual(titles(s), [
    'Day 1: Arrival in Srinagar',
    'Day 2: Srinagar Sightseeing',
    'Day 3: Srinagar to Gulmarg',
    'Day 4: Gulmarg Sightseeing',
    'Day 5: Gulmarg to Pahalgam via Tangmarg Apple Orchards',
    'Day 6: Departure from Pahalgam',
  ])
  assert.deepEqual(s.itinerary.map((d) => d.day), [1, 2, 3, 4, 5, 6])
  const inserted = s.itinerary[3]
  assert.deepEqual(inserted.activities, GUL)
  assert.equal(inserted.description, GUL.join('\n'))
  assert.equal(inserted.location, 'Gulmarg')
  assert.equal(inserted.destinationId, 13)
  assert.ok(inserted.id > 1e9)
  assert.equal(s.tripInfo.duration, '5')
  assert.equal(s.tripInfo.tripTitle, 'Kashmir 5N/6D')
  assert.deepEqual(changes, [
    'Gulmarg: 1 → 2 nights (12–14 Nov)',
    'Cabs: 1 sightseeing booking added (13 Nov)',
    'Trip: 4 → 5 nights, now 10–15 Nov 2026',
  ])
  assert.deepEqual(warnings, [])
})
test('Gulmarg extension: cabs shift and a matching sightseeing cab is added', () => {
  const { snapshot: s } = run([{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }])
  assert.equal(s.transportation.length, 6)
  const added = cabAt(s, '2026-11-13')
  assert.equal(added.length, 1)
  assert.equal(added[0].tripType, 'Sightseeing')
  assert.equal(added[0].route, 'Gulmarg Sightseeing')
  assert.equal(added[0].vehicleId, 21)
  assert.equal(added[0].vehicleType, 'Innova Crysta')
  assert.equal(cabAt(s, '2026-11-14')[0].route, 'Gulmarg → Pahalgam')
  assert.equal(cabAt(s, '2026-11-15')[0].route, 'Departure from Pahalgam')
  assert.equal(s.tripActivities[0].dayNumber, 3, 'Gondola stays on the Gulmarg arrival day')
})
test('Gulmarg +1 and Srinagar −1 in one batch keeps 4 nights', () => {
  const { snapshot: s, changes } = run([
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SET_STAY_NIGHTS', stay: 0, nights: 1 },
  ])
  assert.deepEqual(dates(s).slice(0, 3), [
    'Srinagar:2026-11-10>2026-11-11',
    'Gulmarg:2026-11-11>2026-11-13',
    'Pahalgam:2026-11-13>2026-11-14',
  ])
  assert.deepEqual(titles(s), [
    'Day 1: Arrival in Srinagar',
    'Day 2: Srinagar to Gulmarg',
    'Day 3: Gulmarg Sightseeing',
    'Day 4: Gulmarg to Pahalgam via Tangmarg Apple Orchards',
    'Day 5: Departure from Pahalgam',
  ])
  assert.equal(s.tripInfo.duration, '4')
  assert.ok(!changes.some((c) => c.startsWith('Trip:')), 'no Trip line when total is unchanged')
  assert.ok(changes.includes('Srinagar: 2 → 1 night (10–11 Nov)'))
  assert.ok(changes.includes('Cabs: 1 booking removed with the dropped days'))
  assert.equal(cabAt(s, '2026-11-11')[0].route, 'Srinagar → Gulmarg')
  assert.equal(s.transportation.some((t) => t.route === 'Srinagar Sightseeing'), false)
  assert.equal(s.tripActivities[0].dayNumber, 2, 'Gondola follows the Gulmarg arrival day')
})
test('same nights is a no-op', () => {
  const { snapshot: s, changes, warnings } = run([{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 1 }])
  assert.deepEqual(changes, [])
  assert.deepEqual(warnings, [])
  assert.deepEqual(s, kashmir())
})
test('nights 0 removes the stay; activity on a removed day loses its day', () => {
  const { snapshot: s, changes, warnings } = run([{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 0 }])
  assert.deepEqual(dates(s), [
    'Srinagar:2026-11-10>2026-11-12',
    'Pahalgam:2026-11-12>2026-11-13',
    'Pahalgam:2026-11-12>2026-11-13',
  ])
  assert.deepEqual(titles(s), [
    'Day 1: Arrival in Srinagar',
    'Day 2: Srinagar Sightseeing',
    'Day 3: Gulmarg to Pahalgam via Tangmarg Apple Orchards',
    'Day 4: Departure from Pahalgam',
  ])
  assert.equal(s.tripActivities[0].dayNumber, '')
  assert.ok(warnings.some((w) => w.includes('Gondola Ride') && w.includes('day 3')))
  assert.ok(changes.includes('Removed Gulmarg stay (Khyber Himalayan Resort & Spa, 1 night)'))
  assert.ok(changes.includes('Trip: 4 → 3 nights, now 10–13 Nov 2026'))
  assert.equal(s.transportation.length, 4)
})
test('removing the last stay re-titles the departure day', () => {
  const { snapshot: s, warnings } = run([{ type: 'REMOVE_STAY', stay: 2 }])
  assert.deepEqual(titles(s), [
    'Day 1: Arrival in Srinagar',
    'Day 2: Srinagar Sightseeing',
    'Day 3: Srinagar to Gulmarg',
    'Day 4: Departure from Gulmarg',
  ])
  assert.equal(s.itinerary[3].location, 'Gulmarg')
  assert.equal(s.itinerary[3].destinationId, 13)
  assert.ok(warnings.some((w) => w.includes('custom plan')), 'deleting a custom day warns')
  const dep = cabAt(s, '2026-11-13')
  assert.equal(dep.length, 1)
  assert.equal(dep[0].route, 'Departure from Gulmarg')
  assert.equal(dep[0].destination, 'Gulmarg')
})
test('removing the first stay makes the next city the arrival', () => {
  const { snapshot: s } = run([{ type: 'REMOVE_STAY', stay: 0 }])
  assert.equal(s.tripInfo.startDate, '2026-11-10')
  assert.deepEqual(dates(s)[0], 'Gulmarg:2026-11-10>2026-11-11')
  assert.equal(titles(s)[0], 'Day 1: Arrival in Gulmarg')
  assert.equal(cabAt(s, '2026-11-10')[0].route, 'Arrival in Gulmarg')
  assert.equal(s.tripActivities[0].dayNumber, 1)
})
test('a trip cannot drop below 1 night', () => {
  const one = run([
    { type: 'REMOVE_STAY', stay: 1 },
    { type: 'REMOVE_STAY', stay: 2 },
  ]).snapshot
  const { snapshot: s, warnings, changes } = run([{ type: 'SET_STAY_NIGHTS', stay: 0, nights: 1 }], one)
  assert.equal(s.tripInfo.duration, '1')
  const r = run([{ type: 'REMOVE_STAY', stay: 0 }], s)
  assert.ok(r.warnings.some((w) => w.includes('at least 1 night')))
  assert.equal(r.changes.length, 0)
  assert.deepEqual(warnings, [])
  assert.ok(changes.length > 0)
})
test('unknown stay index warns and skips', () => {
  const { changes, warnings } = run([{ type: 'SET_STAY_NIGHTS', stay: 7, nights: 2 }])
  assert.deepEqual(changes, [])
  assert.equal(warnings.length, 1)
})

// ── Trip nights ───────────────────────────────────────────────────────────
console.log('SET_TRIP_NIGHTS')
test('grows the last stay', () => {
  const { snapshot: s, changes } = run([{ type: 'SET_TRIP_NIGHTS', nights: 6 }])
  assert.equal(findAcc(s, 203).checkOut, '2026-11-16')
  assert.equal(titles(s)[4], 'Day 5: Pahalgam Sightseeing')
  assert.equal(titles(s)[6], 'Day 7: Departure from Pahalgam')
  assert.deepEqual(s.itinerary[4].activities, PAH)
  assert.equal(changes[changes.length - 1], 'Trip: 4 → 6 nights, now 10–16 Nov 2026')
})
test('skips a stay changed explicitly in the same batch', () => {
  const { snapshot: s } = run([
    { type: 'SET_STAY_NIGHTS', stay: 2, nights: 2 },
    { type: 'SET_TRIP_NIGHTS', nights: 6 },
  ])
  assert.equal(nightsBetween(findAcc(s, 202)), 2, 'Gulmarg took the extra night')
  assert.equal(nightsBetween(findAcc(s, 203)), 2)
  assert.equal(s.tripInfo.duration, '6')
})
test('shrinking keeps every stay at ≥ 1 night', () => {
  const { snapshot: s } = run([{ type: 'SET_TRIP_NIGHTS', nights: 3 }])
  assert.equal(nightsBetween(findAcc(s, 201)), 1)
  assert.equal(s.tripInfo.duration, '3')
  const r = run([{ type: 'SET_TRIP_NIGHTS', nights: 2 }])
  assert.equal(r.snapshot.tripInfo.duration, '4')
  assert.ok(r.warnings[0].includes('dropping a hotel'))
  const z = run([{ type: 'SET_TRIP_NIGHTS', nights: 0 }])
  assert.ok(z.warnings[0].includes('at least 1 night'))
})
test('without hotels, the day plan grows before the departure day', () => {
  const snap = kashmir()
  snap.accommodations = []
  const { snapshot: s, changes } = run([{ type: 'SET_TRIP_NIGHTS', nights: 5 }], snap)
  assert.deepEqual(titles(s), [
    'Day 1: Arrival in Srinagar',
    'Day 2: Srinagar Sightseeing',
    'Day 3: Srinagar to Gulmarg',
    'Day 4: Gulmarg to Pahalgam via Tangmarg Apple Orchards',
    'Day 5: Pahalgam Sightseeing',
    'Day 6: Departure from Pahalgam',
  ])
  assert.equal(cabAt(s, '2026-11-14')[0].route, 'Pahalgam Sightseeing')
  assert.equal(cabAt(s, '2026-11-15')[0].route, 'Departure from Pahalgam')
  assert.equal(changes[changes.length - 1], 'Trip: 4 → 5 nights, now 10–15 Nov 2026')
})
function nightsBetween(a) {
  return Math.round((Date.parse(a.checkOut) - Date.parse(a.checkIn)) / 86400000)
}

// ── Add / replace hotels ──────────────────────────────────────────────────
console.log('ADD_STAY / REPLACE_HOTEL')
test('adds Sonamarg at the end, priced from the rate sheet', () => {
  const { snapshot: s, changes } = run([{ type: 'ADD_STAY', hotelId: 6, hotelName: 'Sonamarg Glacier Resort', city: 'Sonamarg', nights: 1, after: null }])
  const added = s.accommodations.find((a) => a.hotelId === 6)
  assert.equal(added.checkIn, '2026-11-14')
  assert.equal(added.checkOut, '2026-11-15')
  assert.equal(added.pricePerRoom, 5000)
  assert.deepEqual(added.bedPrices, [{ category: 'cnb', price: 800 }])
  assert.equal(added.roomType, 'Standard')
  assert.equal(added.category, '3 Star')
  assert.equal(added.rooms, '1')
  assert.equal(added.mealPlan, 'Only Room + Breakfast')
  assert.equal(added.photo, '/img/sgr.jpg')
  assert.deepEqual(titles(s).slice(4), ['Day 5: Pahalgam to Sonamarg', 'Day 6: Departure from Sonamarg'])
  assert.equal(cabAt(s, '2026-11-14')[0].route, 'Pahalgam → Sonamarg')
  assert.equal(cabAt(s, '2026-11-14')[0].tripType, 'Transfer')
  assert.equal(cabAt(s, '2026-11-15')[0].route, 'Departure from Sonamarg')
  assert.ok(changes[0].startsWith('Added Sonamarg stay: Sonamarg Glacier Resort, 1 night (14–15 Nov'))
})
test('adds a stay in the middle and re-titles the transfer after it', () => {
  const { snapshot: s } = run([{ type: 'ADD_STAY', hotelId: 6, hotelName: '', city: 'Sonamarg', nights: 1, after: 0 }])
  assert.deepEqual(dates(s).slice(0, 3), [
    'Srinagar:2026-11-10>2026-11-12',
    'Sonamarg:2026-11-12>2026-11-13',
    'Gulmarg:2026-11-13>2026-11-14',
  ])
  assert.deepEqual(titles(s).slice(2, 4), ['Day 3: Srinagar to Sonamarg', 'Day 4: Sonamarg to Gulmarg'])
  assert.deepEqual(s.itinerary[3].activities, GUL, 'the Gulmarg arrival day keeps its plan')
  assert.equal(s.tripActivities[0].dayNumber, 4)
  assert.equal(cabAt(s, '2026-11-13')[0].route, 'Sonamarg → Gulmarg')
})
test('unknown hotel is added unpriced with a warning', () => {
  const { snapshot: s, warnings } = run([{ type: 'ADD_STAY', hotelId: null, hotelName: 'Houseboat Kings', city: 'Srinagar', nights: 1, after: null }])
  const added = s.accommodations.find((a) => a.name === 'Houseboat Kings')
  assert.equal(added.pricePerRoom, 0)
  assert.equal(added.hotelId, null)
  assert.ok(warnings.some((w) => w.includes('price not set')))
})
test('replace hotel keeps dates / rooms / meal plan, swaps rates', () => {
  const { snapshot: s, changes } = run([{ type: 'REPLACE_HOTEL', stay: 0, hotelId: 2, hotelName: 'Hotel Heevan', city: 'Srinagar' }])
  const a = findAcc(s, 201)
  assert.equal(a.name, 'Hotel Heevan')
  assert.equal(a.hotelId, 2)
  assert.equal(a.pricePerRoom, 6500)
  assert.equal(a.category, '4 Star')
  assert.deepEqual([a.checkIn, a.checkOut, a.rooms, a.mealPlan], ['2026-11-10', '2026-11-12', '1', 'Only Room + Breakfast'])
  assert.deepEqual(changes, ['Srinagar hotel: The Lalit Grand Palace → Hotel Heevan (₹6,500/room/night)'])
})
test('replace hotel picks the seasonal rate by check-in', () => {
  const { snapshot: s } = run([{ type: 'REPLACE_HOTEL', stay: 1, hotelId: 5, hotelName: 'Hotel Highland Park', city: 'Gulmarg' }])
  const a = findAcc(s, 202)
  assert.equal(a.roomType, 'Super Deluxe')
  assert.equal(a.pricePerRoom, 7000)
})
test('replace with a hotel in another city re-titles auto days and warns', () => {
  const { snapshot: s, warnings } = run([{ type: 'REPLACE_HOTEL', stay: 2, hotelId: 6, hotelName: '', city: 'Sonamarg' }])
  assert.equal(titles(s)[4], 'Day 5: Departure from Sonamarg')
  assert.equal(titles(s)[3], 'Day 4: Gulmarg to Pahalgam via Tangmarg Apple Orchards', 'custom title kept')
  assert.ok(warnings.some((w) => w.includes('Sonamarg')))
})

// ── Dates, guests, rooms, meals ───────────────────────────────────────────
console.log('SET_START_DATE / SET_GUESTS / SET_ROOMS / SET_MEAL_PLAN')
test('shifting the start date moves every date and reprices seasonal hotels', () => {
  const { snapshot: s, changes, warnings } = run([{ type: 'SET_START_DATE', date: '2026-12-01' }])
  assert.equal(s.tripInfo.startDate, '2026-12-01')
  assert.deepEqual(dates(s).slice(0, 3), [
    'Srinagar:2026-12-01>2026-12-03',
    'Gulmarg:2026-12-03>2026-12-04',
    'Pahalgam:2026-12-04>2026-12-05',
  ])
  assert.deepEqual(s.transportation.map((t) => t.date), ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'])
  assert.deepEqual(titles(s), titles(kashmir()))
  assert.equal(findAcc(s, 202).pricePerRoom, 22000)
  assert.equal(findAcc(s, 201).pricePerRoom, 12000)
  assert.ok(warnings.some((w) => w.includes('₹22,000')))
  assert.equal(changes[0], 'Start date: 10 Nov 2026 → 1 Dec 2026 (now 1–5 Dec 2026)')
})
test('hand-edited hotel prices are not repriced', () => {
  const snap = kashmir()
  snap.accommodations[1].pricePerRoom = 13000
  const { snapshot: s } = run([{ type: 'SET_START_DATE', date: '01-12-2026' }], snap)
  assert.equal(findAcc(s, 202).pricePerRoom, 13000)
  assert.equal(s.tripInfo.startDate, '2026-12-01')
})
test('guests: rooms follow adults, cnb follows children, tickets follow head-count', () => {
  const { snapshot: s, changes } = run([{ type: 'SET_GUESTS', adults: 3, children: 1, infants: null }])
  assert.deepEqual([s.tripInfo.adults, s.tripInfo.kids5to12, s.tripInfo.kidsUpto5], [3, 1, 0])
  assert.deepEqual(s.accommodations.slice(0, 3).map((a) => [a.rooms, a.cnbCount]), [['2', '1'], ['2', '1'], ['2', '1']])
  assert.equal(findAcc(s, 209).rooms, '1', 'cancelled booking untouched')
  assert.equal(s.tripActivities[0].ticketCount, '4')
  assert.equal(changes[0], 'Guests: 2 adults → 3 adults, 1 child')
})
test('SET_ROOMS in the same batch wins over the adults rule', () => {
  const { snapshot: s } = run([
    { type: 'SET_GUESTS', adults: 5, children: null, infants: null },
    { type: 'SET_ROOMS', stay: 'all', rooms: 3 },
  ])
  assert.deepEqual(s.accommodations.slice(0, 3).map((a) => a.rooms), ['3', '3', '3'])
})
test('rooms and meal plan per stay / all', () => {
  const { snapshot: s, changes, warnings } = run([
    { type: 'SET_ROOMS', stay: 1, rooms: 2 },
    { type: 'SET_MEAL_PLAN', stay: 'all', mealPlan: 'breakfast + dinner' },
    { type: 'SET_MEAL_PLAN', stay: 0, mealPlan: 'Half board' },
  ])
  assert.equal(findAcc(s, 202).rooms, '2')
  assert.deepEqual(s.accommodations.slice(0, 3).map((a) => a.mealPlan), Array(3).fill('Breakfast + Dinner'))
  assert.deepEqual(changes, ['Gulmarg rooms: 1 → 2', 'Meal plan: Breakfast + Dinner in every hotel'])
  assert.equal(warnings.length, 1)
})

// ── Cabs ──────────────────────────────────────────────────────────────────
console.log('SET_VEHICLE / REMOVE_VEHICLE')
test('retargets every cab booking', () => {
  const { snapshot: s, changes } = run([{ type: 'SET_VEHICLE', vehicleId: 22, vehicleName: 'Sedan' }])
  assert.ok(s.transportation.every((t) => t.vehicleId === 22 && t.vehicleType === 'Sedan (Dzire)'))
  assert.deepEqual(changes, ['Vehicle: Innova Crysta → Sedan (Dzire) (5 bookings)'])
})
test('no cabs yet → per-day bookings like buildTrip', () => {
  const { snapshot: s, changes } = run([{ type: 'REMOVE_VEHICLE' }, { type: 'SET_VEHICLE', vehicleId: 21, vehicleName: 'Innova' }])
  assert.equal(s.transportation.length, 5)
  assert.deepEqual(s.transportation.map((t) => [t.date, t.tripType, t.route]), [
    ['2026-11-10', 'Transfer', 'Arrival in Srinagar'],
    ['2026-11-11', 'Sightseeing', 'Srinagar Sightseeing'],
    ['2026-11-12', 'Transfer', 'Srinagar → Gulmarg'],
    ['2026-11-13', 'Transfer', 'Gulmarg → Pahalgam via Tangmarg Apple Orchards'],
    ['2026-11-14', 'Transfer', 'Departure from Pahalgam'],
  ])
  assert.equal(changes[0], 'Cabs: all 5 bookings removed')
})
test('per-trip vehicle → a booking every day, priced once; still priced after removing a stay', () => {
  const r = run([{ type: 'REMOVE_VEHICLE' }, { type: 'SET_VEHICLE', vehicleId: 23, vehicleName: null }])
  const cabs = r.snapshot.transportation
  assert.equal(cabs.length, r.snapshot.itinerary.length)
  assert.equal(cabs.filter((t) => t.vehicleId).length, 1)
  assert.equal(cabs[0].vehicleId, 23)
  assert.ok(cabs.slice(1).every((t) => t.remarks === 'Included in the full-trip cab rate'))
  const r2 = run([{ type: 'REMOVE_STAY', stay: 0 }], r.snapshot)
  assert.equal(r2.snapshot.transportation.filter((t) => t.vehicleId).length, 1)
  assert.equal(r2.snapshot.transportation.length, r2.snapshot.itinerary.length)
})

// ── Pricing / client ──────────────────────────────────────────────────────
console.log('SET_MARGIN / SET_GST / SET_CLIENT')
test('margin', () => {
  const r = run([{ type: 'SET_MARGIN', percent: 20 }])
  assert.equal(r.snapshot.profitMarginPercentage, 20)
  assert.deepEqual(r.changes, ['Margin: 10% → 20%'])
  assert.deepEqual(run([{ type: 'SET_MARGIN', percent: 10 }]).changes, [])
})
test('GST off / on', () => {
  const r = run([{ type: 'SET_GST', include: false, percent: null }])
  assert.equal(r.snapshot.includeGST, false)
  assert.deepEqual(r.changes, ['GST: removed (was 5%)'])
  const r2 = run([{ type: 'SET_GST', include: true, percent: 18 }], r.snapshot)
  assert.deepEqual([r2.snapshot.includeGST, r2.snapshot.gstPercentage], [true, 18])
  assert.deepEqual(r2.changes, ['GST: added at 18%'])
})
test('client details', () => {
  const r = run([{ type: 'SET_CLIENT', clientName: 'Anjali Mehta', clientPhone: null, clientEmail: 'anjali@example.com' }])
  assert.equal(r.snapshot.tripInfo.clientName, 'Anjali Mehta')
  assert.equal(r.snapshot.tripInfo.clientPhone, '+91 98765 43210')
  assert.deepEqual(r.changes, ['Client name: Rahul Sharma → Anjali Mehta', 'Client email: anjali@example.com'])
})

// ── Activities & day plan ─────────────────────────────────────────────────
console.log('activities / day plan')
test('ADD_ACTIVITY from the catalog lands on the first day in its city', () => {
  const r = run([{ type: 'ADD_ACTIVITY', day: null, activityId: 32, name: 'shikara', location: null, pricePerTicket: null, persons: null }])
  const a = r.snapshot.tripActivities[1]
  assert.deepEqual([a.name, a.location, a.dayNumber, a.ticketCount, a.pricePerTicket, a.activityId], ['Shikara Ride', 'Srinagar', 1, '2', 800, 32])
  assert.ok(a.id > 1e9)
  assert.deepEqual(r.changes, ['Added Shikara Ride on day 1 (2 × ₹800)'])
})
test('ADD_ACTIVITY on a given day; custom one without a price warns', () => {
  const r = run([
    { type: 'ADD_ACTIVITY', day: 4, activityId: 33, name: 'Pony Ride', location: null, pricePerTicket: null, persons: 3 },
    { type: 'ADD_ACTIVITY', day: 2, activityId: null, name: 'Houseboat dinner', location: null, pricePerTicket: null, persons: null },
  ])
  const [, pony, dinner] = r.snapshot.tripActivities
  assert.deepEqual([pony.dayNumber, pony.ticketCount, pony.pricePerTicket], [4, '3', 1200])
  assert.deepEqual([dinner.dayNumber, dinner.location, dinner.pricePerTicket], [2, 'Srinagar', ''])
  assert.ok(r.warnings.some((w) => w.includes('Houseboat dinner') && w.includes('price not set')))
})
test('ADD_ACTIVITY: adults + children, rate option and the season of that day', () => {
  const gondola = {
    id: 31, name: 'Gondola Ride Phase 1', destination_id: 13, selling_price: 1800, child_price: 1000, cost: 1500,
    price_sections: [
      { option: 'Phase 2', price: 1900, child_price: 1300, cost: 1500, child_cost: 1000 },
      { option: 'Phase 2', price: 2300, child_price: 1500, cost: 1800, child_cost: 1200, valid_from: '2026-11-12', valid_to: '2026-11-12' },
    ],
  }
  const cat2 = { ...catalog, activities: [gondola, ...catalog.activities.slice(1)] }
  const go = (a) => applyEditActions(kashmir(), [{ type: 'ADD_ACTIVITY', activityId: 31, name: 'Gondola Ride Phase 1', location: null, ...a }], { catalog: cat2, settings })
  // Day 3 = 12 Nov: the seasonal Phase 2 row.
  let r = go({ day: 3, persons: 2, children: 1, option: 'phase 2' })
  let a = r.snapshot.tripActivities.at(-1)
  assert.deepEqual([a.ticketCount, a.childCount, a.pricePerTicket, a.childPrice, a.rateOption, a.costPerTicket], ['2', '1', 2300, 1500, 'Phase 2', 1800])
  assert.match(r.changes.join(' '), /2 × ₹2,300 \+ 1 × ₹1,500/)
  // Day 4 = 13 Nov: the undated Phase 2 row.
  a = go({ day: 4, persons: 2, children: 1, option: 'Phase 2' }).snapshot.tripActivities.at(-1)
  assert.deepEqual([a.pricePerTicket, a.childPrice], [1900, 1300])
  // No option said: the base rate; no children said, trip has none → none.
  a = go({ day: 2, persons: null }).snapshot.tripActivities.at(-1)
  assert.deepEqual([a.pricePerTicket, a.childCount, a.rateOption], [1800, '0', ''])
})
test('SET_TARGET_TOTAL / SET_MARGIN_AMOUNT use the builder\'s own prices', () => {
  // A stand-in for the builder's calculators: ₹30,000 of cost, no item markups.
  const priceOf = (s) => priceBreakdown({ items: [{ cost: 30000 }], marginPct: s.profitMarginPercentage, gstPct: s.gstPercentage, includeGST: s.includeGST !== false })
  const go = (a) => applyEditActions(kashmir(), [a], { catalog, settings: { ...settings, priceOf } })
  let r = go({ type: 'SET_TARGET_TOTAL', amount: 45000 })
  const s = r.snapshot
  assert.equal(Math.round(priceOf(s).total), 45000)
  assert.match(r.changes[0], /total ₹45,000/)
  r = go({ type: 'SET_MARGIN_AMOUNT', amount: 6000 })
  assert.equal(r.snapshot.profitMarginPercentage, 20)
  // Below cost: refused with the floor named, nothing changed.
  r = go({ type: 'SET_TARGET_TOTAL', amount: 20000 })
  assert.deepEqual(r.changes, [])
  assert.match(r.warnings[0], /below cost/)
})
test('REMOVE_ACTIVITY by context index', () => {
  const r = run([{ type: 'REMOVE_ACTIVITY', index: 0 }])
  assert.equal(r.snapshot.tripActivities.length, 0)
  assert.deepEqual(r.changes, ['Removed Gondola Ride from day 3'])
  assert.equal(run([{ type: 'REMOVE_ACTIVITY', index: 5 }]).warnings.length, 1)
})
test('SET_DAY_LEISURE', () => {
  const r = run([{ type: 'SET_DAY_LEISURE', day: 2 }])
  const d = r.snapshot.itinerary[1]
  assert.equal(d.title, 'Day 2: Leisure Day in Srinagar')
  assert.deepEqual(d.activities, ['Day at leisure'])
  assert.equal(d.description, 'Day at leisure')
  assert.deepEqual(r.changes, ['Day 2 is now a leisure day'])
  assert.ok(r.warnings.some((w) => w.includes('sightseeing cab')))
})
test('CLEAR_DAY_SIGHTSEEING keeps the title', () => {
  const r = run([{ type: 'CLEAR_DAY_SIGHTSEEING', day: 4 }])
  const d = r.snapshot.itinerary[3]
  assert.deepEqual([d.activities, d.description], [[], ''])
  assert.equal(d.title, 'Day 4: Gulmarg to Pahalgam via Tangmarg Apple Orchards')
  assert.deepEqual(r.changes, ['Day 4: sightseeing removed'])
  assert.deepEqual(run([{ type: 'CLEAR_DAY_SIGHTSEEING', day: 5 }]).changes, [])
})
test('MOVE_DAY_PLAN moves lines and activities, warns on city mismatch', () => {
  const r = run([{ type: 'MOVE_DAY_PLAN', fromDay: 3, toDay: 4 }])
  const [d3, d4] = [r.snapshot.itinerary[2], r.snapshot.itinerary[3]]
  assert.deepEqual(d4.activities, ['Apple orchards', 'Betaab Valley', ...GUL])
  assert.equal(d3.title, 'Day 3: Leisure Day in Gulmarg')
  assert.equal(r.snapshot.tripActivities[0].dayNumber, 4)
  assert.ok(r.warnings.some((w) => w.includes('Gulmarg') && w.includes('Pahalgam')))
})
test('ADD_DAY_ITEM appends a line (and replaces the leisure placeholder)', () => {
  const r = run([
    { type: 'SET_DAY_LEISURE', day: 2 },
    { type: 'ADD_DAY_ITEM', day: 2, text: 'Pari Mahal' },
    { type: 'ADD_DAY_ITEM', day: 1, text: 'mughal gardens' },
  ])
  assert.deepEqual(r.snapshot.itinerary[1].activities, ['Pari Mahal'])
  assert.equal(r.snapshot.itinerary[1].description, 'Pari Mahal')
  assert.ok(r.changes.includes('Day 2: added "Pari Mahal"'))
  assert.ok(r.warnings.some((w) => w.includes('already on day 1')))
})

// ── Batch semantics ───────────────────────────────────────────────────────
console.log('batch semantics')
test('day numbers in a batch refer to the plan before the batch', () => {
  const r = run([
    { type: 'SET_STAY_NIGHTS', stay: 0, nights: 3 },
    { type: 'ADD_DAY_ITEM', day: 3, text: 'Tulip Garden' },
  ])
  const d = r.snapshot.itinerary[3]
  assert.equal(d.title, 'Day 4: Srinagar to Gulmarg')
  assert.equal(d.activities[d.activities.length - 1], 'Tulip Garden')
  assert.ok(r.changes.includes('Day 4: added "Tulip Garden"'))
})
test('commands are ignored, unknown actions warn', () => {
  const r = run([{ type: 'EXPORT_PDF' }, { type: 'EMAIL_ME' }, { type: 'UNDO' }, { type: 'FLY_TO_MOON' }])
  assert.deepEqual(r.changes, [])
  assert.equal(r.warnings.length, 1)
  assert.deepEqual(r.snapshot, kashmir())
})
test('new ids are unique and > 1e9', () => {
  const { snapshot: s } = run([
    { type: 'SET_STAY_NIGHTS', stay: 0, nights: 4 },
    { type: 'ADD_STAY', hotelId: 6, hotelName: '', city: 'Sonamarg', nights: 2, after: null },
  ])
  const ids = [...s.itinerary, ...s.transportation, ...s.accommodations].map((x) => x.id).filter((id) => id > 1e9)
  assert.equal(ids.length, new Set(ids).size)
  assert.equal(ids.length, 2 + 2 + 2 + 2 + 1)
  assert.equal(s.tripInfo.duration, '8')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
