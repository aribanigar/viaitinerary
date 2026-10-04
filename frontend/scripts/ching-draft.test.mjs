// Confirm & Build: the Trip Draft and its validation (utils/ching/tripDraft.js).
// Run: node frontend/scripts/ching-draft.test.mjs
import assert from 'node:assert/strict'
import { buildTripDraft, draftSpeech, dateSpan, guestLine } from '../src/utils/ching/tripDraft.js'
import { planLive } from '../src/utils/ching/liveFill.js'

let pass = 0
let fail = 0
const test = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}

const stay = (city, name, checkIn, checkOut, extra = {}) => ({ city, name, hotelId: 1, checkIn, checkOut, rooms: '2', mealPlan: 'Breakfast + Dinner', ...extra })
const days = (n, city = 'Srinagar') => Array.from({ length: n }, (_, i) => ({ day: i + 1, location: city }))
const good = {
  tripInfo: { clientName: 'Rahul Sharma', clientPhone: '+919876543210', clientEmail: 'r@x.com', adults: 4, kids5to12: 2, kidsUpto5: 0, startDate: '2026-11-10', duration: '4', destination: 'Kashmir' },
  accommodations: [
    stay('Srinagar', 'Hotel A', '2026-11-10', '2026-11-12'),
    stay('Gulmarg', 'Hotel B', '2026-11-12', '2026-11-13'),
    stay('Pahalgam', 'Hotel C', '2026-11-13', '2026-11-14'),
  ],
  itinerary: days(5),
  transportation: [{ vehicleType: 'Innova Crysta' }, { vehicleType: 'Innova Crysta' }],
}
const level = (d, re) => d.checks.find((c) => re.test(c.text))?.level

console.log('Ching draft tests')

test('the card reads like the agent said it', () => {
  const d = buildTripDraft(good)
  assert.equal(d.ok, true)
  const row = (k) => d.rows.find((r) => r[0] === k)[1]
  assert.equal(row('Client'), 'Rahul Sharma')
  assert.equal(row('Guests'), '4 Adults + 2 Children')
  assert.equal(row('Dates'), '10–14 Nov 2026')
  assert.equal(row('Duration'), '4N / 5D')
  assert.equal(row('Vehicle'), 'Innova Crysta · 2 days')
  assert.deepEqual(d.stays.map((g) => `${g.city} ${g.nights}N ${g.hotel}`), ['Srinagar 2N Hotel A', 'Gulmarg 1N Hotel B', 'Pahalgam 1N Hotel C'])
  assert.ok(d.checks.every((c) => c.level === 'ok'), d.checks.filter((c) => c.level !== 'ok').map((c) => c.text).join('; '))
})

test('hotel nights short of the trip block the build — and Ching does not fill the gap', () => {
  const d = buildTripDraft({ ...good, accommodations: good.accommodations.slice(0, 2) })
  assert.equal(d.ok, false)
  assert.match(d.blocking[0].text, /Hotel nights = 3, the trip needs 4 — say where the other 1 night should be/)
  assert.match(draftSpeech(d), /Before I build it: Hotel nights = 3/)
})

test('too many hotel nights block too', () => {
  const extra = [...good.accommodations, stay('Srinagar', 'Hotel A', '2026-11-14', '2026-11-15')]
  assert.equal(level(buildTripDraft({ ...good, accommodations: extra }), /Hotel nights/), 'blocking')
})

test('a gap between hotel dates blocks', () => {
  const gap = [stay('Srinagar', 'Hotel A', '2026-11-10', '2026-11-12'), stay('Gulmarg', 'Hotel B', '2026-11-13', '2026-11-15')]
  const d = buildTripDraft({ ...good, accommodations: gap })
  assert.equal(level(d, /line up/), 'blocking')
})

test('itinerary days must be nights + 1', () => {
  assert.equal(level(buildTripDraft({ ...good, itinerary: days(4) }), /Itinerary has/), 'blocking')
})

test('missing client name or start date blocks', () => {
  assert.equal(buildTripDraft({ ...good, tripInfo: { ...good.tripInfo, clientName: '' } }).ok, false)
  assert.equal(buildTripDraft({ ...good, tripInfo: { ...good.tripInfo, startDate: '' } }).ok, false)
})

test('phone / email only matter for saving, not for building', () => {
  const d = buildTripDraft({ ...good, tripInfo: { ...good.tripInfo, clientPhone: '+91', clientEmail: '' } })
  assert.equal(d.ok, true)
  assert.equal(level(d, /phone and email/), 'save')
})

test('too few rooms is a warning, not a block', () => {
  const tight = good.accommodations.map((a) => ({ ...a, rooms: '1' }))
  const d = buildTripDraft({ ...good, accommodations: tight })
  assert.equal(d.ok, true)
  assert.equal(level(d, /room/), 'warn')
})

test('what Ching chose itself is marked, so it is confirmed knowingly', () => {
  const d = buildTripDraft(good, { suggestedCities: ['Pahalgam'], pickedHotels: ['Hotel B'] })
  assert.deepEqual(d.stays.map((g) => [g.suggested, g.picked]), [[false, false], [false, true], [true, false]])
  assert.match(d.checks.find((c) => /suggested/.test(c.text)).text, /Pahalgam \(1 night\)/)
})

test('dates and guests read naturally', () => {
  assert.equal(dateSpan('2026-11-29', 4), '29 Nov – 3 Dec 2026')
  assert.equal(dateSpan('2026-12-30', 4), '30 Dec 2026 – 3 Jan 2027')
  assert.equal(guestLine({ adults: 2, kids5to12: 1, kidsUpto5: 1 }), '2 Adults + 1 Child + 1 Infant')
})

test('end to end: a spoken trip becomes a draft that passes, planned cities marked', () => {
  const catalog = {
    destinations: ['Srinagar', 'Gulmarg', 'Pahalgam'].map((name, i) => ({ id: i + 1, name, state: 'Jammu and Kashmir' })),
    hotels: [
      { id: 11, name: 'The Lalit Grand Palace', city: 'Srinagar', price_sections: [{ room_type: 'Deluxe', price: 9000 }] },
      { id: 12, name: 'Khyber Himalayan Resort', city: 'Gulmarg', price_sections: [{ room_type: 'Deluxe', price: 15000 }] },
      { id: 13, name: 'Pine N Peak', city: 'Pahalgam', price_sections: [{ room_type: 'Deluxe', price: 8000 }] },
    ],
    vehicles: [],
    activities: [],
  }
  const blank = { tripInfo: { clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: '2026-10-04', duration: '2' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [] }
  const r = planLive(blank, 'rahul sharma 4 night kashmir trip 4 adults 2 children from 10 november, gulmarg 1 night', { catalog, settings: {}, today: '2026-10-04' })
  const d = buildTripDraft(r.snapshot, r.draftMeta)
  assert.equal(d.ok, true, d.blocking.map((c) => c.text).join('; '))
  assert.deepEqual(d.stays.map((g) => `${g.city} ${g.nights}${g.suggested ? '*' : ''}`), ['Srinagar 2*', 'Gulmarg 1', 'Pahalgam 1*'])
  assert.match(draftSpeech(d), /Say “confirm” to build it/)
})

console.log(`\n${pass} passed, ${fail} failed`)
