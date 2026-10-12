// Plain-Node tests for dragging a day to another place in the Trip Builder
// (MOVE_DAY in editTrip.js): hotels, cabs and activities move with their day.
// Run: node frontend/scripts/move-day.test.mjs
import assert from 'node:assert/strict'
import { applyEditActions } from '../src/utils/ching/editTrip.js'

const catalog = { hotels: [], destinations: [], vehicles: [], activities: [] }
const day = (n, rest, location) => ({ id: 100 + n, day: n, title: `Day ${n}: ${rest}`, location, description: '', activities: [] })
const stay = (id, name, city, checkIn, checkOut, extra = {}) => ({ id, hotelId: id, name, city, roomType: 'Deluxe', rooms: '1', mealPlan: 'MAP', pricePerRoom: '5000', checkIn, checkOut, ...extra })
const cab = (id, date, route) => ({ id, vehicleId: 21, vehicleType: 'Innova', tripType: 'Transfer', date, route, quantity: 1 })

// 4N/5D: Srinagar, Gulmarg, Pahalgam, Pahalgam, departure.
const base = () => ({
  tripInfo: { startDate: '2026-11-10', duration: '4' },
  itinerary: [
    day(1, 'Arrival in Srinagar', 'Srinagar'),
    day(2, 'Gulmarg', 'Gulmarg'),
    day(3, 'Pahalgam', 'Pahalgam'),
    day(4, 'Aru Valley', 'Pahalgam'),
    day(5, 'Departure', 'Srinagar'),
  ],
  accommodations: [
    stay(1, 'Lalit', 'Srinagar', '2026-11-10', '2026-11-11'),
    stay(2, 'Khyber', 'Gulmarg', '2026-11-11', '2026-11-12'),
    stay(3, 'Pine N Peak', 'Pahalgam', '2026-11-12', '2026-11-14'),
  ],
  transportation: [
    cab(1, '2026-11-10', 'Airport pickup'),
    cab(2, '2026-11-11', 'To Gulmarg'),
    cab(3, '2026-11-12', 'To Pahalgam'),
    cab(4, '2026-11-13', 'Aru'),
    cab(5, '2026-11-14', 'Drop'),
  ],
  tripActivities: [{ id: 1, name: 'Gondola', dayNumber: 2 }],
})
const move = (from, to, snap = base()) => applyEditActions(snap, [{ type: 'MOVE_DAY', from, to }], { catalog }).snapshot
const hotels = (s) => s.accommodations.map((a) => `${a.name} ${a.checkIn}→${a.checkOut}`).sort()
const cabOn = (s, route) => s.transportation.find((t) => t.route === route).date

let passed = 0
const test = (name, fn) => { fn(); passed += 1; console.log('✓', name) }

test('day 3 dragged to day 2: its hotel and cab come with it', () => {
  const s = move(3, 2)
  assert.deepEqual(s.itinerary.map((d) => d.location), ['Srinagar', 'Pahalgam', 'Gulmarg', 'Pahalgam', 'Srinagar'])
  assert.deepEqual(s.itinerary.map((d) => d.day), [1, 2, 3, 4, 5])
  assert.equal(s.itinerary[1].title, 'Day 2: Pahalgam')
  // Pahalgam's 2 nights are now apart (night 2 and night 4) → two bookings.
  assert.deepEqual(hotels(s), [
    'Khyber 2026-11-12→2026-11-13',
    'Lalit 2026-11-10→2026-11-11',
    'Pine N Peak 2026-11-11→2026-11-12',
    'Pine N Peak 2026-11-13→2026-11-14',
  ])
  assert.equal(cabOn(s, 'To Pahalgam'), '2026-11-11')
  assert.equal(cabOn(s, 'To Gulmarg'), '2026-11-12')
  assert.equal(cabOn(s, 'Aru'), '2026-11-13')
  assert.equal(s.tripActivities[0].dayNumber, 3)
  assert.equal(new Set(s.accommodations.map((a) => a.id)).size, 4)
})

test('moving it back joins the split stay into one booking again', () => {
  const s = move(2, 3, move(3, 2))
  assert.deepEqual(hotels(s), hotels(base()))
  assert.deepEqual(s.transportation.map((t) => t.date), base().transportation.map((t) => t.date))
})

test('second-last day to first: everything else shifts by one, nothing lost', () => {
  const s = move(4, 1)
  assert.deepEqual(s.itinerary.map((d) => d.title), ['Day 1: Aru Valley', 'Day 2: Pahalgam to Srinagar', 'Day 3: Gulmarg', 'Day 4: Pahalgam', 'Day 5: Departure'])
  assert.deepEqual(hotels(s), [
    'Khyber 2026-11-12→2026-11-13',
    'Lalit 2026-11-11→2026-11-12',
    'Pine N Peak 2026-11-10→2026-11-11',
    'Pine N Peak 2026-11-13→2026-11-14',
  ])
  assert.equal(cabOn(s, 'Aru'), '2026-11-10')
  assert.equal(cabOn(s, 'Airport pickup'), '2026-11-11')
  assert.equal(cabOn(s, 'Drop'), '2026-11-14')
  // Every night still has exactly one hotel.
  const nights = s.accommodations.flatMap((a) => {
    const out = []
    for (let d = new Date(a.checkIn); d < new Date(a.checkOut); d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10))
    return out
  })
  assert.deepEqual(nights.sort(), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
})

test('hotel packages: every option of a night moves with the day', () => {
  const snap = base()
  snap.accommodations.push(stay(9, 'Heevan', 'Srinagar', '2026-11-10', '2026-11-11', { package: 1 }))
  const s = move(1, 2, snap)
  const heevan = s.accommodations.find((a) => a.name === 'Heevan')
  const lalit = s.accommodations.find((a) => a.name === 'Lalit')
  assert.equal(heevan.checkIn, '2026-11-11')
  assert.equal(lalit.checkIn, '2026-11-11')
})

test('no-op and out-of-range moves leave the trip alone', () => {
  assert.deepEqual(hotels(move(2, 2)), hotels(base()))
  const r = applyEditActions(base(), [{ type: 'MOVE_DAY', from: 9, to: 1 }], { catalog })
  assert.equal(r.changes.length, 0)
  assert.ok(r.warnings.length)
})

console.log(`\n${passed} passed`)
