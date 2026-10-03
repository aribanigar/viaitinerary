/* global process */
// Plain-Node tests for the Ching edit parser.
// Run: node frontend/scripts/ching-edit-parser.test.mjs
import assert from 'node:assert/strict'
import { parseChingEdit, isCreateRequest } from '../src/utils/ching/parseEdit.js'

const catalog = {
  hotels: [
    { id: 1, name: 'Hotel A', city: 'Srinagar', is_available: true },
    { id: 2, name: 'Hotel B', city: 'Srinagar', is_available: true },
    { id: 3, name: 'Hotel Heevan', city: 'Srinagar', is_available: true },
    { id: 4, name: 'The Lalit Grand Palace', city: 'Srinagar', is_available: true },
    { id: 5, name: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg', is_available: true },
    { id: 6, name: 'Hotel Highlands Park', city: 'Gulmarg', is_available: true },
    { id: 7, name: 'Welcomhotel Pine N Peak', city: 'Pahalgam', is_available: true },
    { id: 8, name: 'Grand Mumtaz', city: 'Pahalgam', is_available: true },
    { id: 9, name: 'Sonamarg Glacier Resort', city: 'Sonamarg', is_available: true },
  ],
  destinations: [
    { id: 11, name: 'Kashmir' },
    { id: 12, name: 'Srinagar' },
    { id: 13, name: 'Gulmarg' },
    { id: 14, name: 'Pahalgam' },
    { id: 15, name: 'Sonamarg' },
  ],
  vehicles: [
    { id: 21, name: 'Innova Crysta', price: 4500 },
    { id: 22, name: 'Sedan (Dzire)', price: 3000 },
    { id: 23, name: 'Tempo Traveller', price: 7000 },
  ],
  activities: [
    { id: 31, name: 'Shikara Ride', destination_id: 12, selling_price: 800 },
    { id: 32, name: 'Gondola Phase 2', destination_id: 13, selling_price: 1900 },
    { id: 33, name: 'Pony Ride', destination_id: 14, selling_price: 1200 },
  ],
}

const context = {
  tripId: 501,
  clientName: 'Rahul Sharma',
  startDate: '2026-11-10',
  nights: 4,
  adults: 2,
  children: 1,
  infants: 0,
  stays: [
    { index: 0, hotelId: 4, hotelName: 'The Lalit Grand Palace', city: 'Srinagar', nights: 2, mealPlan: 'Only Room + Breakfast', checkIn: '2026-11-10', checkOut: '2026-11-12' },
    { index: 1, hotelId: 5, hotelName: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg', nights: 1, mealPlan: 'Only Room + Breakfast', checkIn: '2026-11-12', checkOut: '2026-11-13' },
    { index: 2, hotelId: 7, hotelName: 'Welcomhotel Pine N Peak', city: 'Pahalgam', nights: 1, mealPlan: 'Only Room + Breakfast', checkIn: '2026-11-13', checkOut: '2026-11-14' },
  ],
  days: [
    { day: 1, title: 'Day 1: Arrival in Srinagar', location: 'Srinagar', activities: ['Airport pickup', 'Evening at Dal Lake'] },
    { day: 2, title: 'Day 2: Srinagar Sightseeing', location: 'Srinagar', activities: ['Mughal Gardens', 'Shankaracharya Temple'] },
    { day: 3, title: 'Day 3: Srinagar to Gulmarg', location: 'Gulmarg', activities: ['Drive to Gulmarg', 'Gondola Ride'] },
    { day: 4, title: 'Day 4: Gulmarg to Pahalgam', location: 'Pahalgam', activities: ['Drive to Pahalgam', 'Saffron fields en route'] },
    { day: 5, title: 'Day 5: Pahalgam Sightseeing and Departure', location: 'Pahalgam', activities: ['Betaab Valley', 'Aru Valley', 'Drop at Srinagar airport'] },
  ],
  activities: [{ index: 0, name: 'Gondola Ride', dayNumber: 3, location: 'Gulmarg' }],
  vehicle: { id: 22, name: 'Sedan (Dzire)' },
  marginPercent: 10,
  gstPercent: 5,
  includeGst: true,
}
// Same trip but with Hotel A in Srinagar.
const contextA = { ...context, stays: [{ ...context.stays[0], hotelId: 1, hotelName: 'Hotel A' }, ...context.stays.slice(1)] }

const today = new Date(2026, 8, 29)
const edit = (text, ctx = context) => parseChingEdit(text, ctx, catalog, { today })
const acts = (text, ctx) => edit(text, ctx).actions

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}
const only = (text, expected, ctx) => {
  const r = edit(text, ctx)
  assert.deepEqual(r.actions, expected, `actions for "${text}"`)
  assert.deepEqual(r.unrecognized, [], `unrecognized for "${text}"`)
  assert.equal(r.intent, 'edit')
  return r
}

console.log('Ching edit parser tests')

// ---- nights / stays ----
test('change Gulmarg to two nights', () => only('change Gulmarg to two nights', [{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }]))
test('make Gulmarg 2 nights', () => only('make Gulmarg 2 nights', [{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }]))
test('reduce Srinagar to one night', () => only('reduce Srinagar to one night', [{ type: 'SET_STAY_NIGHTS', stay: 0, nights: 1 }]))
test('add one more night in Pahalgam (+1)', () => only('add one more night in Pahalgam', [{ type: 'SET_STAY_NIGHTS', stay: 2, nights: 2 }]))
test('an extra night in Gulmarg (+1)', () => only('an extra night in Gulmarg', [{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }]))
test('one night less in Srinagar (-1)', () => only('one night less in Srinagar', [{ type: 'SET_STAY_NIGHTS', stay: 0, nights: 1 }]))
test('reduce Pahalgam by one night -> stay removed', () => {
  const r = only('reduce Pahalgam by one night', [{ type: 'REMOVE_STAY', stay: 2 }])
  assert.ok(r.warnings.some((w) => /no nights left/.test(w)))
})
test('remove Pahalgam', () => only('remove Pahalgam', [{ type: 'REMOVE_STAY', stay: 2 }]))
test('skip Pahalgam', () => only('skip Pahalgam', [{ type: 'REMOVE_STAY', stay: 2 }]))
test('stay named by hotel: "make the lalit 3 nights"', () => only('make the lalit 3 nights', [{ type: 'SET_STAY_NIGHTS', stay: 0, nights: 3 }]))
test('add 2 nights in Sonamarg at a catalog hotel', () =>
  only('add 2 nights in Sonamarg at glacier resort', [
    { type: 'ADD_STAY', hotelId: 9, hotelName: 'Sonamarg Glacier Resort', city: 'Sonamarg', nights: 2, after: null },
  ]))
test('add 2 nights in Sonamarg at an unknown hotel -> hotelId null + warning', () => {
  const r = only('add 2 nights in Sonamarg at hotel snowland', [
    { type: 'ADD_STAY', hotelId: null, hotelName: 'Hotel Snowland', city: 'Sonamarg', nights: 2, after: null },
  ])
  assert.ok(r.warnings.some((w) => w.includes('hotel snowland')), r.warnings.join(' | '))
})
test('add 2 nights in Sonamarg (no hotel) after Srinagar', () => {
  const r = only('add two nights in Sonamarg after Srinagar', [
    { type: 'ADD_STAY', hotelId: null, hotelName: '', city: 'Sonamarg', nights: 2, after: 0 },
  ])
  assert.ok(r.warnings.some((w) => /No hotel named/.test(w)))
})
test('make the trip 6 nights', () => only('make the trip 6 nights', [{ type: 'SET_TRIP_NIGHTS', nights: 6 }]))
test('extend the trip by one night', () => only('extend the trip by one night', [{ type: 'SET_TRIP_NIGHTS', nights: 5 }]))
test('make it a 6 night trip, keep two nights in Gulmarg -> stay first, then trip', () =>
  only('make it a 6 night trip, keep two nights in Gulmarg', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SET_TRIP_NIGHTS', nights: 6 },
  ]))
test('same without punctuation (speech)', () =>
  only('make it a six night trip keep two nights in gulmarg', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SET_TRIP_NIGHTS', nights: 6 },
  ]))

// ---- hotels ----
test('replace Hotel A with Hotel B', () =>
  only('replace Hotel A with Hotel B', [{ type: 'REPLACE_HOTEL', stay: 0, hotelId: 2, hotelName: 'Hotel B', city: 'Srinagar' }], contextA))
test('change the Srinagar hotel to Hotel Heevan', () =>
  only('change the Srinagar hotel to Hotel Heevan', [{ type: 'REPLACE_HOTEL', stay: 0, hotelId: 3, hotelName: 'Hotel Heevan', city: 'Srinagar' }]))
test('use Grand Mumtaz in Pahalgam instead', () =>
  only('use Grand Mumtaz in Pahalgam instead', [{ type: 'REPLACE_HOTEL', stay: 2, hotelId: 8, hotelName: 'Grand Mumtaz', city: 'Pahalgam' }]))
test('swap the Gulmarg hotel for Highlands Park', () =>
  only('swap the Gulmarg hotel for Highlands Park', [{ type: 'REPLACE_HOTEL', stay: 1, hotelId: 6, hotelName: 'Hotel Highlands Park', city: 'Gulmarg' }]))
test('use Grand Mumtaz (city inferred from the hotel)', () =>
  only('use grand mumtaz', [{ type: 'REPLACE_HOTEL', stay: 2, hotelId: 8, hotelName: 'Grand Mumtaz', city: 'Pahalgam' }]))
test('unknown replacement hotel -> warning, no action', () => {
  const r = edit('change the Srinagar hotel to Hotel Xyz Paradise')
  assert.deepEqual(r.actions, [])
  assert.ok(r.warnings.some((w) => w.includes("Couldn't find")), r.warnings.join(' | '))
})

// ---- activities ----
test('add Shikara ride on day 2', () =>
  only('add Shikara ride on day 2', [
    { type: 'ADD_ACTIVITY', day: 2, activityId: 31, name: 'Shikara Ride', location: 'Srinagar', pricePerTicket: 800, persons: null },
  ]))
test('add gondola phase 2 in Gulmarg (day null)', () =>
  only('add gondola phase two in Gulmarg', [
    { type: 'ADD_ACTIVITY', day: null, activityId: 32, name: 'Gondola Phase 2', location: 'Gulmarg', pricePerTicket: 1900, persons: null },
  ]))
test('add pony ride for 4 people on day 4', () =>
  only('add pony ride for 4 people on day 4', [
    { type: 'ADD_ACTIVITY', day: 4, activityId: 33, name: 'Pony Ride', location: 'Pahalgam', pricePerTicket: 1200, persons: 4 },
  ]))
test('remove the gondola ride', () => only('remove the gondola ride', [{ type: 'REMOVE_ACTIVITY', index: 0 }]))
test('add Pari Mahal to day 2 (not in catalog)', () => only('add Pari Mahal to day 2', [{ type: 'ADD_DAY_ITEM', day: 2, text: 'Pari Mahal' }]))
test('add something unknown with no day -> unrecognized', () => {
  const r = edit('add pari mahal')
  assert.deepEqual(r.actions, [])
  assert.deepEqual(r.unrecognized, ['add pari mahal'])
})

// ---- days ----
test('make day 3 a leisure day', () => only('make day 3 a leisure day', [{ type: 'SET_DAY_LEISURE', day: 3 }]))
test('day 3 free', () => only('day three free', [{ type: 'SET_DAY_LEISURE', day: 3 }]))
test('keep the third day free', () => only('keep the third day free', [{ type: 'SET_DAY_LEISURE', day: 3 }]))
test('remove sightseeing from day 4', () => only('remove sightseeing from day 4', [{ type: 'CLEAR_DAY_SIGHTSEEING', day: 4 }]))
test('move the Pahalgam sightseeing to day 4', () => only('move the Pahalgam sightseeing to day 4', [{ type: 'MOVE_DAY_PLAN', fromDay: 5, toDay: 4 }]))
test("move day 2's sightseeing to day 3", () => only("move day 2's sightseeing to day 3", [{ type: 'MOVE_DAY_PLAN', fromDay: 2, toDay: 3 }]))
test('day out of range -> warning, no action', () => {
  const r = edit('make day 9 a leisure day')
  assert.deepEqual(r.actions, [])
  assert.ok(r.warnings.some((w) => /no day 9/.test(w)))
})

// ---- vehicle ----
test('change the vehicle from sedan to Innova', () =>
  only('change the vehicle from sedan to Innova', [{ type: 'SET_VEHICLE', vehicleId: 21, vehicleName: 'Innova Crysta' }]))
test('use a tempo traveller', () => only('use a tempo traveller', [{ type: 'SET_VEHICLE', vehicleId: 23, vehicleName: 'Tempo Traveller' }]))
test('no cab / remove the vehicle', () => {
  only('no cab', [{ type: 'REMOVE_VEHICLE' }])
  only('remove the vehicle', [{ type: 'REMOVE_VEHICLE' }])
})
test('unknown vehicle -> warning, no action', () => {
  const r = edit('change the vehicle to scorpio')
  assert.deepEqual(r.actions, [])
  assert.ok(r.warnings.some((w) => w.includes('scorpio')))
})

// ---- meals / rooms ----
test('add breakfast to all hotels', () =>
  only('add breakfast to all hotels', [{ type: 'SET_MEAL_PLAN', stay: 'all', mealPlan: 'Only Room + Breakfast' }]))
test('MAP in Gulmarg', () => only('MAP in Gulmarg', [{ type: 'SET_MEAL_PLAN', stay: 1, mealPlan: 'Breakfast + Dinner' }]))
test('breakfast and dinner everywhere', () =>
  only('breakfast and dinner everywhere', [{ type: 'SET_MEAL_PLAN', stay: 'all', mealPlan: 'Breakfast + Dinner' }]))
test('remove breakfast in Pahalgam -> room only', () =>
  only('remove breakfast in Pahalgam', [{ type: 'SET_MEAL_PLAN', stay: 2, mealPlan: 'Only Room' }]))
test('3 rooms in Srinagar', () => only('3 rooms in Srinagar', [{ type: 'SET_ROOMS', stay: 0, rooms: 3 }]))
test('make it 2 rooms', () => only('make it 2 rooms', [{ type: 'SET_ROOMS', stay: 'all', rooms: 2 }]))

// ---- pricing ----
test('give me 20% margin', () => only('give me 20% margin', [{ type: 'SET_MARGIN', percent: 20 }]))
test('margin 15 percent', () => only('margin fifteen percent', [{ type: 'SET_MARGIN', percent: 15 }]))
test('remove GST / no GST', () => {
  only('remove GST', [{ type: 'SET_GST', include: false, percent: null }])
  only('no G S T', [{ type: 'SET_GST', include: false, percent: null }])
})
test('add 5% GST', () => only('add 5% GST', [{ type: 'SET_GST', include: true, percent: 5 }]))

// ---- dates / guests / client ----
test('shift the trip to 12 November', () => only('shift the trip to 12 November', [{ type: 'SET_START_DATE', date: '2026-11-12' }]))
test('start on 12/11/2026 (day first)', () => only('start on 12/11/2026', [{ type: 'SET_START_DATE', date: '2026-11-12' }]))
test('make it 3 adults and 1 child', () =>
  only('make it 3 adults and 1 child', [{ type: 'SET_GUESTS', adults: 3, children: 1, infants: null }]))
test('add one infant (context + 1)', () => only('add one infant', [{ type: 'SET_GUESTS', adults: null, children: null, infants: 1 }]))
test('client phone', () =>
  only('client phone 98765 43210', [{ type: 'SET_CLIENT', clientName: null, clientPhone: '+919876543210', clientEmail: null }]))
test('email is x@y.com', () =>
  only('email is rahul.v@gmail.com', [{ type: 'SET_CLIENT', clientName: null, clientPhone: null, clientEmail: 'rahul.v@gmail.com' }]))
test('change the name to Rahul Verma', () =>
  only('change the name to Rahul Verma', [{ type: 'SET_CLIENT', clientName: 'Rahul Verma', clientPhone: null, clientEmail: null }]))
test('name + email in one utterance -> one SET_CLIENT', () =>
  only('change the name to Rahul Verma and email is rv@x.com', [
    { type: 'SET_CLIENT', clientName: 'Rahul Verma', clientPhone: null, clientEmail: 'rv@x.com' },
  ]))

// ---- commands ----
test('export / download the pdf', () => {
  only('export', [{ type: 'EXPORT_PDF' }])
  only('download the pdf', [{ type: 'EXPORT_PDF' }])
})
test('email it to me / send it to my mail', () => {
  only('email it to me', [{ type: 'EMAIL_ME' }])
  only('send it to my mail', [{ type: 'EMAIL_ME' }])
})
test('save / undo / undo that', () => {
  only('save', [{ type: 'SAVE' }])
  only('undo', [{ type: 'UNDO' }])
  only('undo that', [{ type: 'UNDO' }])
})
test('email it to the client -> SEND_PROPOSAL email (not EMAIL_ME)', () => {
  only('email it to the client', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('email it to the customer', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('email it to Rahul', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('email it to me', [{ type: 'EMAIL_ME' }])
})
test('send proposal: whatsapp', () => {
  only('send it to the customer on WhatsApp', [{ type: 'SEND_PROPOSAL', channel: 'whatsapp' }])
  only('send it to the client on whats app', [{ type: 'SEND_PROPOSAL', channel: 'whatsapp' }])
  only('WhatsApp it to Rahul', [{ type: 'SEND_PROPOSAL', channel: 'whatsapp' }])
})
test('send proposal: email', () => {
  only('send the proposal to the client', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('send it to the client', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('send it to rahul', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
})
test('send proposal: link', () => {
  only('send the approval link', [{ type: 'SEND_PROPOSAL', channel: 'link' }])
  only('copy the link', [{ type: 'SEND_PROPOSAL', channel: 'link' }])
  only('share the link', [{ type: 'SEND_PROPOSAL', channel: 'link' }])
})
test('send proposal goes last, after edits', () =>
  only('whatsapp it to rahul, make gulmarg 2 nights and then add breakfast to all hotels', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SET_MEAL_PLAN', stay: 'all', mealPlan: 'Only Room + Breakfast' },
    { type: 'SEND_PROPOSAL', channel: 'whatsapp' },
  ]))
test('chained: make gulmarg 2 nights and whatsapp it to the client', () =>
  only('make gulmarg 2 nights and whatsapp it to the client', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SEND_PROPOSAL', channel: 'whatsapp' },
  ]))
test('email it to the client does not become SET_CLIENT or EMAIL_ME', () => {
  const r = edit('email it to the client and download the pdf')
  assert.deepEqual(r.actions, [{ type: 'SEND_PROPOSAL', channel: 'email' }, { type: 'EXPORT_PDF' }])
})

test('payment link: whatsapp by default, email / link when said', () => {
  only('send the payment link to the client', [{ type: 'SEND_PAYMENT_LINK', channel: 'whatsapp' }])
  only('WhatsApp Rahul the payment link', [{ type: 'SEND_PAYMENT_LINK', channel: 'whatsapp' }])
  only('ask the client to pay the advance', [{ type: 'SEND_PAYMENT_LINK', channel: 'whatsapp' }])
  only('send the advance payment link', [{ type: 'SEND_PAYMENT_LINK', channel: 'whatsapp' }])
  only('email the payment link to the customer', [{ type: 'SEND_PAYMENT_LINK', channel: 'email' }])
  only('copy the payment link', [{ type: 'SEND_PAYMENT_LINK', channel: 'link' }])
  only('send me the payment link', [{ type: 'SEND_PAYMENT_LINK', channel: 'link' }])
})
test('reminders: kind and channel', () => {
  only('remind the client', [{ type: 'SEND_REMINDER', kind: 'proposal', channel: 'email' }])
  only('send a reminder to Rahul', [{ type: 'SEND_REMINDER', kind: 'proposal', channel: 'email' }])
  only('send a payment reminder', [{ type: 'SEND_REMINDER', kind: 'payment', channel: 'email' }])
  only('remind them to pay the balance', [{ type: 'SEND_REMINDER', kind: 'payment', channel: 'email' }])
  only('remind the client on WhatsApp', [{ type: 'SEND_REMINDER', kind: 'proposal', channel: 'whatsapp' }])
  only('send a payment reminder by email', [{ type: 'SEND_REMINDER', kind: 'payment', channel: 'email' }])
})
test('excel export vs pdf export', () => {
  only('export excel', [{ type: 'EXPORT_EXCEL' }])
  only('download the excel quotation', [{ type: 'EXPORT_EXCEL' }])
  only('download the spreadsheet quotation', [{ type: 'EXPORT_EXCEL' }])
  only('excel sheet please', [{ type: 'EXPORT_EXCEL' }])
  only('download the pdf and the excel', [{ type: 'EXPORT_PDF' }, { type: 'EXPORT_EXCEL' }])
  only('export the pdf', [{ type: 'EXPORT_PDF' }])
  only('export', [{ type: 'EXPORT_PDF' }])
})
test('no collisions with proposal / email-me phrasings', () => {
  only('send the proposal to the client', [{ type: 'SEND_PROPOSAL', channel: 'email' }])
  only('send it to me', [{ type: 'EMAIL_ME' }])
  only('send it to the customer on WhatsApp', [{ type: 'SEND_PROPOSAL', channel: 'whatsapp' }])
  only('share the link', [{ type: 'SEND_PROPOSAL', channel: 'link' }])
  only('email it to me', [{ type: 'EMAIL_ME' }])
  const r = edit('remind me later')
  assert.deepEqual(r.actions, [])
})
test('new commands chain and go last in spoken order', () =>
  only('remind the client on whatsapp and make gulmarg 2 nights, then export excel and ask rahul to pay the advance', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SEND_REMINDER', kind: 'proposal', channel: 'whatsapp' },
    { type: 'EXPORT_EXCEL' },
    { type: 'SEND_PAYMENT_LINK', channel: 'whatsapp' },
  ]))

// ---- chaining ----
test('chain: Change Gulmarg to two nights and reduce Srinagar to one night', () =>
  only('Change Gulmarg to two nights and reduce Srinagar to one night', [
    { type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 },
    { type: 'SET_STAY_NIGHTS', stay: 0, nights: 1 },
  ]))
test('chain with wake phrase, commas and "then"; commands last', () =>
  only('hello ching, export the pdf, then make day 3 a leisure day and use an innova, give me 15% margin', [
    { type: 'SET_DAY_LEISURE', day: 3 },
    { type: 'SET_VEHICLE', vehicleId: 21, vehicleName: 'Innova Crysta' },
    { type: 'SET_MARGIN', percent: 15 },
    { type: 'EXPORT_PDF' },
  ]))
test('chain: replace hotel, add breakfast everywhere and email it to me', () =>
  only('replace the lalit with hotel heevan and add breakfast to all hotels and email it to me', [
    { type: 'REPLACE_HOTEL', stay: 0, hotelId: 3, hotelName: 'Hotel Heevan', city: 'Srinagar' },
    { type: 'SET_MEAL_PLAN', stay: 'all', mealPlan: 'Only Room + Breakfast' },
    { type: 'EMAIL_ME' },
  ]))
test('chain: good + gibberish -> action plus unrecognized', () => {
  const r = edit('make gulmarg 2 nights, flibber the jabberwock')
  assert.deepEqual(r.actions, [{ type: 'SET_STAY_NIGHTS', stay: 1, nights: 2 }])
  assert.deepEqual(r.unrecognized, ['flibber the jabberwock'])
})
test('nothing understood -> intent unknown', () => {
  const r = edit('what is the weather in gulmarg')
  assert.equal(r.intent, 'unknown')
  assert.deepEqual(r.actions, [])
  assert.equal(r.unrecognized.length, 1)
})
test('questions are never turned into edits', () => {
  for (const t of ['is breakfast included in gulmarg', 'how many nights in gulmarg', 'what is the total price']) {
    const r = edit(t)
    assert.deepEqual(r.actions, [], t)
    assert.equal(r.unrecognized.length, 1, t)
  }
})
test('empty / wake phrase only', () => {
  assert.equal(edit('').intent, 'unknown')
  assert.equal(edit('hello ching').intent, 'unknown')
  assert.deepEqual(edit('hello ching').unrecognized, [])
})
test('city with two stays: warn and pick the first', () => {
  const ctx2 = {
    ...context,
    stays: [...context.stays, { index: 3, hotelId: 2, hotelName: 'Hotel B', city: 'Srinagar', nights: 1, mealPlan: '' }],
  }
  const r = edit('make srinagar 3 nights', ctx2)
  assert.deepEqual(r.actions, [{ type: 'SET_STAY_NIGHTS', stay: 0, nights: 3 }])
  assert.ok(r.warnings.some((w) => /Srinagar has 2 stays/.test(w)))
  assert.deepEqual(edit('make srinagar hotel b 2 nights', ctx2).actions, [{ type: 'SET_STAY_NIGHTS', stay: 3, nights: 2 }])
})

// ---- create vs edit ----
test('isCreateRequest: true for new-trip requests', () => {
  assert.equal(isCreateRequest('create a 5 day 4 night trip for Rahul Sharma 2 adults'), true)
  assert.equal(isCreateRequest('hello ching plan a new itinerary for Priya'), true)
  assert.equal(isCreateRequest('build an itinerary for Ravi 3 nights'), true)
  assert.equal(isCreateRequest('I want an 5-day, 4-night itinerary for the customer Rahul'), true)
  assert.equal(edit('create a 5 day 4 night trip for Rahul').intent, 'create')
  assert.deepEqual(edit('create a 5 day 4 night trip for Rahul').actions, [])
})
test('isCreateRequest: false for edit phrasings', () => {
  for (const t of [
    'make day 3 a leisure day', 'make the trip 6 nights', 'make Gulmarg 2 nights',
    'make it a 6 night trip, keep two nights in Gulmarg', 'change Gulmarg to two nights', 'replace Hotel A with Hotel B',
    'add Shikara ride on day 2', 'add one more night in Pahalgam', 'use a tempo traveller', 'give me 20% margin',
    'shift the trip to 12 November', 'make it 3 adults and 1 child', 'download the pdf', 'undo',
    'add 2 nights in Sonamarg at glacier resort', 'extend the trip by one night',
  ]) assert.equal(isCreateRequest(t), false, t)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
