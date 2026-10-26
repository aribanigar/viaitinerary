// "Export Budget + Premium" (utils/tierExport.js): the same trip with only the
// hotels changed.   node frontend/scripts/tier-export.test.mjs
import assert from 'node:assert/strict'
import { defaultTierPicks, tierAccommodations, swapStayHotel, tierFileName, tierTitle, isoDate, hotelsForStay } from '../src/utils/tierExport.js'

const hotels = [
  { id: 1, name: 'Hotel Budget Inn', city: 'Srinagar', category: '3', price_sections: [{ room_type: 'Deluxe', price: 2500, meal_plan: 'breakfast_only', upto_5: 800 }, { room_type: 'Deluxe', price: 3200, meal_plan: 'breakfast_dinner', upto_5: 900 }] },
  { id: 2, name: 'Grand Mumtaz', city: 'Srinagar City', category: '4', price_sections: [{ room_type: 'Deluxe', price: 5200, meal_plan: 'breakfast_only' }, { room_type: 'Deluxe', price: 6400, meal_plan: 'breakfast_dinner', upto_5: 1500 }] },
  { id: 3, name: 'The Lalit Grand Palace', city: 'Srinagar', category: '5', price_sections: [{ room_type: 'Premium', price: 12000 }] },
  { id: 4, name: 'Highlands Park', city: 'Gulmarg', category: '4', price_sections: [{ room_type: 'Deluxe', price: 7000 }] },
  { id: 5, name: 'Khyber Resort', city: 'Gulmarg', category: '5', price_sections: [{ room_type: 'Deluxe', price: 18000 }] },
  { id: 6, name: 'Closed Hotel', city: 'Gulmarg', category: '5', is_available: false, price_sections: [{ room_type: 'Deluxe', price: 30000 }] },
]
const accs = [
  { id: 'a1', hotelId: 1, name: 'Hotel Budget Inn', city: 'Srinagar', category: '3 Star', roomType: 'Deluxe', rooms: '2', cnbCount: '1', extraBeds5To12Count: '1', mealPlan: 'Breakfast + Dinner', pricePerRoom: 3200, checkIn: '23-10-2026', checkOut: '25-10-2026', markupPercentage: '' },
  { id: 'a2', hotelId: 4, name: 'Highlands Park', city: 'Gulmarg', category: '4 Star', roomType: 'Deluxe', rooms: '2', mealPlan: '', pricePerRoom: 7000, checkIn: '25-10-2026', checkOut: '27-10-2026',
    alternateOptions: [{ name: 'Khyber Resort', package: 1, price: 18000 }] },
  { id: 'x', hotelId: 1, cancelled: true, name: 'Hotel Budget Inn', city: 'Srinagar' },
]
let pass = 0
const t = (name, fn) => { fn(); pass++; console.log('  ok  ', name) }

t('dates and names', () => {
  assert.equal(isoDate('23-10-2026'), '2026-10-23')
  assert.equal(isoDate('2026-10-23'), '2026-10-23')
  assert.equal(tierFileName('TRP592618', 'Premium'), 'TRP592618 Premium Itinerary.pdf')
  assert.equal(tierTitle('Kashmir Explorer', 'Budget'), 'Kashmir Explorer (Budget)')
  assert.equal(tierTitle('Kashmir Explorer (Budget)', 'Premium'), 'Kashmir Explorer (Premium)')
})

t('a stay only lists its own town, never closed hotels', () => {
  assert.deepEqual(hotelsForStay(accs[0], hotels).map((h) => h.id), [1, 2, 3])
  assert.deepEqual(hotelsForStay(accs[1], hotels).map((h) => h.id), [4, 5])
})

t('defaults: budget = the trip now; premium = its upgrade option, else the next better hotel', () => {
  const p = defaultTierPicks(accs, hotels)
  assert.deepEqual(p.budget, { a1: 1, a2: 4 })
  assert.equal(p.premium.a1, 2) // next better in Srinagar: 4-star before the 5-star
  assert.equal(p.premium.a2, 5) // the stay's own Deluxe-package option
  assert.equal(p.premium.x, undefined) // cancelled stays are not part of it
})

t('a swap keeps rooms, beds, meal plan and dates; prices from the new hotel', () => {
  const s = swapStayHotel(accs[0], hotels[1])
  assert.equal(s.name, 'Grand Mumtaz')
  assert.equal(s.hotelId, 2)
  assert.equal(s.rooms, '2')
  assert.equal(s.cnbCount, '1')
  assert.equal(s.extraBeds5To12Count, '1')
  assert.equal(s.mealPlan, 'Breakfast + Dinner')
  assert.equal(s.checkIn, '23-10-2026')
  assert.equal(s.pricePerRoom, 6400) // the Breakfast + Dinner row
  assert.deepEqual(s.bedPrices, [{ category: '5_to_12', price: 1500 }])
  // a hotel without that room type: its own first room type
  assert.equal(swapStayHotel(accs[0], hotels[2]).roomType, 'Premium')
  assert.equal(swapStayHotel(accs[0], hotels[2]).pricePerRoom, 12000)
})

t('a tier changes only the hotels and drops the "A or B" options', () => {
  const p = defaultTierPicks(accs, hotels)
  const prem = tierAccommodations(accs, p.premium, hotels)
  assert.deepEqual(prem.map((a) => a.name), ['Grand Mumtaz', 'Khyber Resort', 'Hotel Budget Inn'])
  assert.deepEqual(prem[1].alternateOptions, [])
  assert.equal(prem[2], accs[2]) // cancelled stay untouched
  const bud = tierAccommodations(accs, p.budget, hotels)
  assert.equal(bud[0].pricePerRoom, 3200)
  assert.deepEqual(bud[1].alternateOptions, [])
})

console.log(`\n${pass} passed`)
