// Tests for real-time Ching (utils/ching/liveFill.js): run with
//   node frontend/scripts/ching-live.test.mjs
import assert from 'node:assert/strict'
import { planLive, isBlankTrip } from '../src/utils/ching/liveFill.js'

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

const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', activities: ['Dal Lake Shikara', 'Mughal Gardens'] },
    { id: 2, name: 'Gulmarg', activities: ['Gondola Phase 1'] },
    { id: 3, name: 'Pahalgam', activities: ['Betaab Valley'] },
  ],
  hotels: [
    { id: 11, name: 'The Lalit Grand Palace', city: 'Srinagar', category: '5', price_sections: [{ room_type: 'Deluxe', price: 9000 }] },
    { id: 12, name: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg', category: '5', price_sections: [{ room_type: 'Deluxe', price: 15000 }] },
    { id: 13, name: 'Welcomhotel Pine N Peak', city: 'Pahalgam', category: '4', price_sections: [{ room_type: 'Deluxe', price: 8000 }] },
  ],
  vehicles: [{ id: 21, name: 'Innova Crysta', price: 4000, rate_type: 'per_day' }],
  activities: [{ id: 31, name: 'Shikara Ride', destination_id: 1, selling_price: 800 }],
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-09-29'
const blank = {
  tripInfo: { tripId: 'TRP1', tripTitle: '', clientName: '', clientPhone: '', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2', template: 'ModernTemplate' },
  itinerary: [], accommodations: [], transportation: [], tripActivities: [],
  profitMarginPercentage: 10, gstPercentage: 5, includeGST: true,
}
const FULL = 'hello ching 5 day 4 night itinerary for Rahul Sharma 4 adults and 2 children starting 10 November 2026 two nights in lalit grand palace one night in khyber and one night in pine n peak with innova breakfast and dinner add shikara ride on day 2 and give me 20% margin then export the pdf'
const plan = (base, text) => planLive(base, text, { catalog, settings, today })

console.log('Ching live-fill tests')

test('blank trip detection', () => {
  assert.equal(isBlankTrip(blank), true)
  // Client details or hand-made days alone don't make a plan: a trip request still fills it.
  assert.equal(isBlankTrip({ ...blank, tripInfo: { ...blank.tripInfo, clientName: 'X' } }), true)
  assert.equal(isBlankTrip({ ...blank, itinerary: [{ day: 1 }] }), true)
  assert.equal(isBlankTrip({ ...blank, accommodations: [{ id: 1 }] }), false)
})

test('empty text changes nothing', () => {
  const r = plan(blank, '   ')
  assert.equal(r.snapshot, blank)
  assert.deepEqual(r.changes, [])
})

test('fills progressively while speaking', () => {
  const words = FULL.split(' ')
  const at = (n) => plan(blank, words.slice(0, n).join(' '))
  const early = at(8) // "... 5 day 4 night itinerary for"
  assert.equal(early.mode, 'fill')
  assert.equal(early.snapshot.itinerary.length, 5)
  assert.equal(early.snapshot.accommodations.length, 0)
  const mid = at(22) // dates heard
  assert.equal(mid.snapshot.tripInfo.clientName, 'Rahul Sharma')
  assert.equal(mid.snapshot.tripInfo.startDate, '2026-11-10')
  assert.equal(mid.snapshot.tripInfo.adults, 4)
  assert.equal(mid.snapshot.tripInfo.kids5to12, 2)
})

test('full request fills the whole form', () => {
  const r = plan(blank, FULL)
  const s = r.snapshot
  assert.equal(r.mode, 'fill')
  assert.equal(s.tripInfo.tripId, 'TRP1', 'keeps the trip id')
  assert.equal(s.tripInfo.template, 'ModernTemplate', 'keeps untouched fields')
  assert.equal(s.tripInfo.duration, '4')
  assert.match(s.tripInfo.tripTitle, /4N\/5D$/)
  assert.deepEqual(s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut, a.mealPlan, a.rooms]), [
    [11, '2026-11-10', '2026-11-12', 'Breakfast + Dinner', '2'],
    [12, '2026-11-12', '2026-11-13', 'Breakfast + Dinner', '2'],
    [13, '2026-11-13', '2026-11-14', 'Breakfast + Dinner', '2'],
  ])
  assert.deepEqual(s.itinerary.map((d) => d.title), [
    'Day 1: Arrival in Srinagar', 'Day 2: Srinagar Sightseeing', 'Day 3: Srinagar to Gulmarg',
    'Day 4: Gulmarg to Pahalgam', 'Day 5: Departure from Pahalgam',
  ])
  assert.deepEqual(s.itinerary[0].activities, ['Dal Lake Shikara', 'Mughal Gardens'])
  assert.equal(s.transportation.length, 5)
  assert.ok(s.transportation.every((t) => t.vehicleId === 21))
  assert.equal(s.tripActivities.length, 1)
  assert.equal(s.tripActivities[0].name, 'Shikara Ride')
  assert.equal(Number(s.tripActivities[0].dayNumber), 2)
  assert.equal(s.profitMarginPercentage, 20)
  assert.deepEqual(r.commands.map((c) => c.type), ['EXPORT_PDF'])
  assert.ok(r.changes.some((c) => /Client: Rahul Sharma/.test(c)))
  assert.ok(r.changes.some((c) => /Margin: 10% → 20%/.test(c)))
})

test('recomputes from the base: a revised guess replaces, never stacks', () => {
  const a = plan(blank, '3 night trip for Ravi from 5 december 2026 3 nights at khyber')
  const b = plan(blank, '3 night trip for Ravi from 5 december 2026 3 nights at lalit grand palace')
  assert.deepEqual(a.snapshot.accommodations.map((x) => x.hotelId), [12])
  assert.deepEqual(b.snapshot.accommodations.map((x) => x.hotelId), [11])
})

test('a typed title is kept; an auto title is replaced', () => {
  const typed = { ...blank, tripInfo: { ...blank.tripInfo, tripTitle: 'Honeymoon Special' } }
  assert.equal(plan(typed, '3 night trip for Ravi from 5 december 2026 3 nights at khyber').snapshot.tripInfo.tripTitle, 'Honeymoon Special')
  const auto = { ...blank, tripInfo: { ...blank.tripInfo, tripTitle: 'Gulmarg 2N/3D' } }
  assert.match(plan(auto, '3 night trip for Ravi from 5 december 2026 3 nights at khyber').snapshot.tripInfo.tripTitle, /3N\/4D$/)
})

test('unknown hotel warns instead of guessing', () => {
  const r = plan(blank, '2 night trip for Ravi from 5 december 2026 2 nights at hotel xyz palace')
  assert.equal(r.snapshot.accommodations.length, 0)
  assert.ok(r.warnings.some((w) => /xyz/i.test(w)))
})

test('a trip with content is edited, not refilled', () => {
  const filled = plan(blank, FULL).snapshot
  const r = plan(filled, 'make gulmarg 2 nights and remove pahalgam then email it to me')
  assert.equal(r.mode, 'edit')
  assert.equal(r.snapshot.tripInfo.clientName, 'Rahul Sharma')
  assert.deepEqual(r.snapshot.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut]), [
    [11, '2026-11-10', '2026-11-12'],
    [12, '2026-11-12', '2026-11-14'],
  ])
  assert.deepEqual(r.commands.map((c) => c.type), ['EMAIL_ME'])
})

test('partial edits mid-sentence are harmless', () => {
  const filled = plan(blank, FULL).snapshot
  const r = plan(filled, 'change gulmarg to')
  assert.equal(r.snapshot, filled)
  assert.deepEqual(r.changes, [])
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
