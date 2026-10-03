// Ching smart fill: messy catalog cities, day-wise cabs and destinations,
// phone numbers, inclusions/exclusions, memory. Run with
//   node frontend/scripts/ching-smart-fill.test.mjs
import assert from 'node:assert/strict'
import { planLive, applyAliases } from '../src/utils/ching/liveFill.js'
import { extractPhone, formatPhone } from '../src/utils/ching/parseCommand.js'
import { parseInclusionClause, applyInclusion, deriveInclusions } from '../src/utils/ching/inclusions.js'
import { hotelPreference, pickHotel, recallClient } from '../src/utils/ching/buildTrip.js'
import { samePlace, hotelInCity } from '../src/utils/ching/places.js'
import { tripChecklist } from '../src/utils/tripChecklist.js'

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

// Catalog typed the way real agencies type it.
const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', state: 'Jammu and Kashmir', activities: ['Dal Lake Shikara'] },
    { id: 2, name: 'Gulmarg', state: 'Jammu and Kashmir', activities: ['Gondola Phase 1'] },
    { id: 3, name: 'Pahalgam Valley', state: 'Jammu and Kashmir', activities: ['Betaab Valley', 'Aru Valley'] },
    { id: 4, name: 'Kashmir', state: 'Jammu and Kashmir', activities: [] },
  ],
  hotels: [
    { id: 11, name: 'Hotel Grand Mumtaz', city: 'Srinagar City', category: '4', price_sections: [{ room_type: 'Deluxe', price: 5000 }] },
    { id: 12, name: 'The Vintage Gulmarg', city: 'gulmarg ', category: '4', price_sections: [{ room_type: 'Deluxe', price: 7000 }] },
    { id: 13, name: 'Heevan Resort', city: 'Pahalgam, Kashmir', category: '4', price_sections: [{ room_type: 'Deluxe', price: 6500 }] },
    { id: 14, name: 'Pine Spring', city: 'Pahalgam', category: '3', price_sections: [{ room_type: 'Deluxe', price: 3500 }] },
    { id: 15, name: 'Welcomhotel Pine N Peak', city: 'Pahalgam', category: '5', price_sections: [{ room_type: 'Deluxe', price: 11000 }] },
  ],
  vehicles: [
    { id: 21, name: 'Innova Crysta (full trip)', price: 18000, rate_type: 'per_trip', seating_capacity: 6 },
    { id: 22, name: 'Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4 },
  ],
  activities: [],
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-09-29'
const blank = {
  tripInfo: { tripTitle: '', clientName: '', clientPhone: '', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: '', duration: '' },
  itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [],
  profitMarginPercentage: 10, gstPercentage: 5, includeGST: true,
}
const plan = (text, base = blank, cat = catalog) => planLive(base, text, { catalog: cat, settings, today })

console.log('Ching smart-fill tests')

test('places: messy catalog cities still match', () => {
  assert.ok(samePlace('Pahalgam, Kashmir', 'pahalgam'))
  assert.ok(samePlace('Srinagar City', 'Srinagar'))
  assert.ok(samePlace('gulmarg ', 'Gulmarg'))
  assert.ok(!samePlace('Gulmarg', 'Srinagar'))
  assert.ok(hotelInCity(catalog.hotels[2], 'Pahalgam'))
})

test('the screenshot trip: hotels every night, a cab every day, day destinations set', () => {
  const r = plan('4 nights trip for Rahul Sharma 2 adults from 3 october 2 nights pahalgam 1 night gulmarg 1 night srinagar phone 98765 43210')
  const s = r.snapshot
  assert.equal(s.tripInfo.clientName, 'Rahul Sharma')
  assert.equal(s.tripInfo.clientPhone, '+919876543210')
  assert.deepEqual(s.accommodations.map((a) => [a.city.trim(), a.checkIn, a.checkOut]), [
    ['Pahalgam, Kashmir', '2026-10-03', '2026-10-05'].length ? [s.accommodations[0].city.trim(), '2026-10-03', '2026-10-05'] : null,
    [s.accommodations[1].city.trim(), '2026-10-05', '2026-10-06'],
    [s.accommodations[2].city.trim(), '2026-10-06', '2026-10-07'],
  ])
  assert.ok(samePlace(s.accommodations[0].city, 'Pahalgam'))
  assert.ok(samePlace(s.accommodations[2].city, 'Srinagar'))
  assert.equal(s.itinerary.length, 5)
  // Every day has a destination picked from the catalog.
  assert.deepEqual(s.itinerary.map((d) => d.destinationId), [3, 3, 2, 1, 1])
  // 2 guests → the per-day Dzire, one booking per day.
  assert.equal(s.transportation.length, 5)
  assert.ok(s.transportation.every((t) => t.vehicleId === 22))
  assert.deepEqual(s.transportation.map((t) => t.date), ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])
  assert.equal(s.transportation[2].route, 'Pahalgam → Gulmarg')
  assert.ok(s.inclusions.length >= 4 && s.exclusions.length >= 4)
  // Nothing left for the checklist but the agent-only bits.
  const pending = tripChecklist(s).map((i) => i.key).filter((k) => k !== 'price')
  assert.deepEqual(pending.filter((k) => !/^meal|clientEmail/.test(k)), [])
})

test('per-trip cab: one row per day, priced once', () => {
  const r = plan('5 day trip for Asha Rao 5 adults from 3 october 2 nights pahalgam 1 night gulmarg 1 night srinagar')
  const cabs = r.snapshot.transportation
  assert.equal(cabs.length, 5)
  assert.equal(cabs.filter((t) => t.vehicleId === 21).length, 1)
  assert.ok(cabs.slice(1).every((t) => !t.vehicleId && /Included/.test(t.remarks)))
  assert.deepEqual(tripChecklist(r.snapshot).filter((i) => i.key === 'cabVehicle'), [])
})

test('region trip plans its own route through catalog cities', () => {
  const r = plan('5 day kashmir trip for Rahul Sharma from 3 october')
  const cities = r.snapshot.accommodations.map((a) => a.city)
  assert.equal(cities.length, 3)
  assert.equal(r.snapshot.accommodations.reduce((n, a) => n + Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 864e5), 0), 4)
  assert.ok(r.snapshot.itinerary.every((d) => d.destinationId), 'every day has a destination')
})

test('budget cap: "under 6000" picks within budget', () => {
  assert.equal(hotelPreference('4 star under 6000 with breakfast').maxPrice, 6000)
  assert.equal(hotelPreference('below rs 5k').maxPrice, 5000)
  assert.equal(hotelPreference('under 5 nights').maxPrice, null)
  const h = pickHotel('Pahalgam', catalog.hotels, hotelPreference('under 6000'))
  assert.equal(h.name, 'Pine Spring')
  const h2 = pickHotel('Pahalgam', catalog.hotels, hotelPreference('under 7000'))
  assert.equal(h2.name, 'Heevan Resort')
})

test('phone numbers as people say them', () => {
  const cases = {
    'phone 98765 43210': '+919876543210',
    'his number is 98 76 54 32 10': '+919876543210',
    'mobile nine eight seven six five double four three two one': '+919876544321',
    'contact 98765, 43210 and 2 adults': '+919876543210',
    'whatsapp +44 7911 123456': '+447911123456',
    'call him on 98765-43210': '+919876543210',
  }
  for (const [said, want] of Object.entries(cases)) {
    const t = said.replace(/nine eight seven six five double four three two one/, '9 8 7 6 5 double 4 3 2 1')
    assert.equal(extractPhone(t).phone, want, said)
  }
  assert.equal(formatPhone('09876543210'), '+919876543210')
  assert.equal(extractPhone('3 nights from 10 11 2026').phone, '')
})

test('phone said on a trip that already has content is set (formatted)', () => {
  const filled = plan('4 nights trip for Rahul Sharma from 3 october 2 nights pahalgam 2 nights srinagar').snapshot
  const r = plan('client phone number is 98765 43210', filled)
  assert.equal(r.snapshot.tripInfo.clientPhone, '+919876543210')
})

test('inclusions: voice add / remove / move / standard', () => {
  assert.deepEqual(parseInclusionClause('add airport pickup to inclusions'), [{ type: 'INCLUSION', op: 'add', kind: 'inclusion', text: 'airport pickup' }])
  assert.equal(parseInclusionClause('flights are not included')[0].kind, 'exclusion')
  assert.equal(parseInclusionClause('remove lunch from exclusions')[0].op, 'remove')
  assert.equal(parseInclusionClause('add the standard inclusions')[0].op, 'standard')
  assert.equal(parseInclusionClause('remove the gondola'), null)
  const filled = plan('4 nights trip for Rahul Sharma from 3 october 2 nights pahalgam 2 nights srinagar breakfast and dinner').snapshot
  let r = plan('add candlelight dinner to inclusions', filled)
  assert.ok(r.snapshot.inclusions.some((i) => i.content === 'Candlelight dinner'), r.changes.join('|'))
  r = plan('remove travel insurance from exclusions', filled)
  assert.ok(!r.snapshot.exclusions.some((i) => /insurance/i.test(i.content)))
  r = plan('lunch is included', filled)
  assert.ok(r.snapshot.inclusions.some((i) => /lunch/i.test(i.content)))
  assert.ok(!r.snapshot.exclusions.some((i) => /^lunch$/i.test(i.content)), 'moved out of exclusions')
})

test('moving part of a line: "lunch is included" turns "Lunch and dinner" into "Dinner"', () => {
  const s = { inclusions: [], exclusions: [{ content: 'Lunch and dinner' }, { content: 'Travel insurance' }] }
  const r = applyInclusion(s, { type: 'INCLUSION', op: 'add', kind: 'inclusion', text: 'lunch', move: true })
  assert.ok(r.change, r.warning)
  assert.deepEqual(s.inclusions, [{ content: 'Lunch' }])
  assert.deepEqual(s.exclusions, [{ content: 'Dinner' }, { content: 'Travel insurance' }])
})

test('inclusions follow the meal plan', () => {
  const d = deriveInclusions({ accommodations: [{ city: 'Gulmarg', checkIn: '2026-10-03', checkOut: '2026-10-05', mealPlan: 'Only Room + Breakfast' }], transportation: [] })
  assert.ok(d.inclusions.some((i) => /breakfast/i.test(i.content)))
  assert.ok(d.exclusions.some((i) => /lunch and dinner/i.test(i.content)))
})

test('standard inclusions win over derived ones', () => {
  const cat = { ...catalog, standard: { inclusions: ['Welcome drink'], exclusions: ['GST'] } }
  const r = plan('4 nights trip for Rahul Sharma from 3 october 2 nights pahalgam 2 nights srinagar', blank, cat)
  assert.deepEqual(r.snapshot.inclusions, [{ content: 'Welcome drink' }])
  assert.deepEqual(r.snapshot.exclusions, [{ content: 'GST' }])
})

test('memory: usual hotel, cab, meal plan, returning client, aliases', () => {
  const memory = {
    hotels: { pahalgam: [15] },
    vehicles: [{ id: 22, minGuests: 1, maxGuests: 3, n: 9 }],
    mealPlan: 'Breakfast + Dinner',
    clients: [{ name: 'Rahul Sharma', phone: '+919811122233', email: 'rahul@example.com', trips: 3 }],
    aliases: { heaven: 'Heevan Resort' },
  }
  const cat = { ...catalog, memory }
  const r = plan('4 nights trip for rahul sharma from 3 october 2 nights pahalgam 2 nights srinagar', blank, cat)
  assert.equal(r.snapshot.accommodations[0].name, 'Welcomhotel Pine N Peak')
  assert.equal(r.snapshot.accommodations[0].mealPlan, 'Breakfast + Dinner')
  assert.equal(r.snapshot.tripInfo.clientPhone, '+919811122233')
  assert.equal(r.snapshot.tripInfo.clientEmail, 'rahul@example.com')
  assert.ok(r.changes.some((c) => /your usual/.test(c)))
  assert.equal(applyAliases('two nights in heaven', memory), 'two nights in Heevan Resort')
  assert.equal(recallClient(memory, 'rahul').name, 'Rahul Sharma')
  // An explicit choice beats memory.
  const r2 = plan('4 nights trip for rahul sharma from 3 october 2 nights pahalgam budget 2 nights srinagar', blank, cat)
  assert.equal(r2.snapshot.accommodations[0].name, 'Pine Spring')
})

test('no hotel in a city: the route is still planned and Ching says so', () => {
  const r = plan('4 nights trip for Rahul Sharma from 3 october 2 nights sonamarg 2 nights srinagar', blank, {
    ...catalog,
    destinations: [...catalog.destinations, { id: 5, name: 'Sonamarg', state: 'Jammu and Kashmir', activities: [] }],
  })
  assert.equal(r.snapshot.itinerary.length, 5)
  assert.equal(r.snapshot.itinerary[0].destinationId, 5)
  assert.ok(r.warnings.some((w) => /No hotel in Sonamarg/i.test(w)), r.warnings.join('|'))
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
