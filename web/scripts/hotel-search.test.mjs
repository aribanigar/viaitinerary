// Hotel search engine (lib/hotelSearch.js) — pure, no database:
//   node web/scripts/hotel-search.test.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
const { searchHotels, rateFor, availabilityFor, sectionFor, bookedByHotel } = await import('../lib/hotelSearch.js')

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

const sec = (room_type, price, extra = {}) => ({ room_type, price, ...extra })
const hotels = [
  { id: 1, name: 'Hotel Grand Mumtaz', city: 'Srinagar', category: '4', totalRooms: 10, priceSections: [
    sec('Deluxe', 5200, { meal_plan: 'breakfast_only' }), sec('Deluxe', 4500, { meal_plan: 'room_only' }), sec('Deluxe', 6400, { meal_plan: 'breakfast_dinner' }),
  ] },
  { id: 2, name: 'Rah Bagh Resort', city: 'Srinagar City', category: '4', priceSections: [
    sec('Superior', 5900, { meal_plan: 'breakfast_only' }),
    sec('Superior', 7900, { meal_plan: 'breakfast_only', valid_from: '2026-12-20', valid_to: '2027-01-05' }),
  ] },
  { id: 3, name: 'The Lalit Grand Palace', city: 'Srinagar', category: '5', priceSections: [sec('Deluxe', 9500, { meal_plan: 'breakfast_only' })] },
  { id: 4, name: 'Budget Inn', city: 'Srinagar', category: '3', priceSections: [sec('Standard', 2200)] },
  { id: 5, name: 'Heevan Resort', city: 'Pahalgam', category: '4', priceSections: [sec('Deluxe', 6000, { meal_plan: 'breakfast_only' })] },
  { id: 6, name: 'Shut Hotel', city: 'Srinagar', category: '4', isAvailable: false, priceSections: [sec('Deluxe', 3000, { meal_plan: 'breakfast_only' })] },
]
const nov = { checkIn: '2026-11-10', checkOut: '2026-11-12' }

console.log('Hotel search tests')

test('"4-star in Srinagar under ₹6,000 with breakfast" — only real matches, best first', () => {
  const r = searchHotels(hotels, { city: 'Srinagar', minStars: 4, maxStars: 4, maxRate: 6000, mealPlan: 'breakfast_only' }, nov)
  assert.deepEqual(r.results.map((x) => [x.name, x.rate, x.mealPlan]), [
    ['Hotel Grand Mumtaz', 5200, 'breakfast_only'],
    ['Rah Bagh Resort', 5900, 'breakfast_only'],
  ])
  assert.equal(r.results[0].total, 10400) // 2 nights × 1 room
})

test('the switched-off hotel never shows, however cheap', () => {
  const r = searchHotels(hotels, { city: 'Srinagar', mealPlan: 'breakfast_only', sort: 'cheapest' }, nov)
  assert.ok(!r.results.some((x) => x.id === 6))
  assert.equal(r.excluded.availability, 1)
})

test('"cheapest" sorts by price; "best" by stars, then price', () => {
  const cheap = searchHotels(hotels, { city: 'Srinagar', sort: 'cheapest' }, nov)
  assert.equal(cheap.results[0].name, 'Budget Inn')
  const best = searchHotels(hotels, { city: 'Srinagar', sort: 'best' }, nov)
  assert.equal(best.results[0].name, 'The Lalit Grand Palace')
})

test('each night is priced from its own season', () => {
  const r = rateFor(hotels[1], { checkIn: '2026-12-19', nights: 3, mealPlan: 'breakfast_only' })
  assert.deepEqual(r.perNight, [5900, 7900, 7900])
  assert.equal(r.total, 21700)
})

test('a meal plan the hotel has no rate for excludes it (no guessing)', () => {
  const r = searchHotels(hotels, { city: 'Srinagar', mealPlan: 'all_meals' }, nov)
  // Budget Inn's untagged rate stays usable but flagged; Grand Mumtaz has no all-meals row.
  assert.ok(!r.results.some((x) => x.name === 'Hotel Grand Mumtaz'))
  const inn = r.results.find((x) => x.name === 'Budget Inn')
  assert.equal(inn.mealPlanOnSheet, false)
})

test('stop-sale blocks; blackout only warns', () => {
  const stop = availabilityFor(hotels[0], { ...nov, blackouts: [{ type: 'stop_sale', startDate: '2026-11-11', endDate: '2026-11-11' }] })
  assert.equal(stop.status, 'stop_sale')
  const black = availabilityFor(hotels[0], { ...nov, blackouts: [{ type: 'blackout', startDate: '2026-11-10', endDate: '2026-11-10' }] })
  assert.equal(black.status, 'blackout')
  const otherRoom = availabilityFor(hotels[0], { ...nov, roomType: 'Deluxe', blackouts: [{ type: 'stop_sale', roomType: 'Suite', startDate: '2026-11-10', endDate: '2026-11-12' }] })
  assert.equal(otherRoom.status, 'available')
})

test('rooms already booked count against the room count', () => {
  const booked = bookedByHotel([
    { hotelId: 1, checkIn: '2026-11-09', checkOut: '2026-11-12', rooms: '6' },
    { hotelId: 1, checkIn: '2026-11-11', checkOut: '2026-11-13', rooms: '3' },
    { hotelId: 1, checkIn: '2026-11-10', checkOut: '2026-11-12', rooms: '5', cancelledAt: new Date() },
  ])
  assert.deepEqual(booked[1], { '2026-11-09': 6, '2026-11-10': 6, '2026-11-11': 9, '2026-11-12': 3 })
  assert.equal(availabilityFor(hotels[0], { ...nov, rooms: 2, bookedByDate: booked[1] }).status, 'full')
  assert.equal(availabilityFor(hotels[0], { ...nov, rooms: 1, bookedByDate: booked[1] }).freeRooms, 1)
})

test('"Hotel ABC if available, otherwise …" — the preferred hotel and why it can\'t be used', () => {
  const ok = searchHotels(hotels, { city: 'Srinagar', prefer: 'grand mumtaz', maxRate: 7000 }, nov)
  assert.equal(ok.preferred.usable, true)
  const blocked = searchHotels(hotels, { city: 'Srinagar', prefer: 'grand mumtaz', maxRate: 7000 }, {
    ...nov,
    blackoutsByHotel: { 1: [{ type: 'stop_sale', startDate: '2026-11-10', endDate: '2026-11-10', note: 'renovation' }] },
  })
  assert.equal(blocked.preferred.usable, false)
  assert.match(blocked.preferred.why, /^Stop sale on 10 Nov 2026 \(renovation\)$/)
  assert.equal(blocked.results[0].name, 'Rah Bagh Resort') // the fallback
  const missing = searchHotels(hotels, { city: 'Srinagar', prefer: 'taj vivanta' }, nov)
  assert.equal(missing.preferred.why, 'Not in your hotel list')
})

test('nothing under budget — the nearest miss is reported, not silently swapped in', () => {
  const r = searchHotels(hotels, { city: 'Srinagar', minStars: 5, maxRate: 6000 }, nov)
  assert.equal(r.results.length, 0)
  assert.equal(r.near.name, 'The Lalit Grand Palace')
  assert.equal(r.near.rate, 9500)
})

test('city names match loosely ("Srinagar City" = "Srinagar")', () => {
  const r = searchHotels(hotels, { city: 'srinagar' }, nov)
  assert.ok(r.results.some((x) => x.name === 'Rah Bagh Resort'))
  assert.ok(!r.results.some((x) => x.city === 'Pahalgam'))
})

test('no rate covering the dates → not offered', () => {
  const seasonal = { id: 9, name: 'Winter Only', city: 'Srinagar', category: '4', priceSections: [sec('Deluxe', 3000, { valid_from: '2026-12-01', valid_to: '2027-02-28' })] }
  assert.equal(sectionFor(seasonal, { date: '2026-11-10' }), null)
  const r = searchHotels([seasonal], { city: 'Srinagar' }, nov)
  assert.equal(r.results.length, 0)
  assert.equal(r.excluded.noRate, 1)
})

test('without dates: rates still shown, availability marked unchecked', () => {
  const r = searchHotels(hotels, { city: 'Srinagar', minStars: 4, maxStars: 4, mealPlan: 'breakfast_only' }, { nights: 2, today: '2026-11-01' })
  assert.equal(r.results[0].availability.status, 'unchecked')
  assert.equal(r.results[0].dated, false)
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
