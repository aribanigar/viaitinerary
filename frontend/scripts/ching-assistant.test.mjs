// Ching assistant + trip checklist tests: node frontend/scripts/ching-assistant.test.mjs
import assert from 'node:assert/strict'
import { understandAssistant as u, replyAfter, pendingReply } from '../src/utils/ching/assistant.js'
import { tripChecklist } from '../src/utils/tripChecklist.js'
import { parseChingCommand } from '../src/utils/ching/parseCommand.js'

let pass = 0
let fail = 0
const test = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${err.message}`)
  }
}

console.log('Ching assistant tests')

test('navigation', () => {
  assert.deepEqual(u('ching open me the ledger'), { type: 'navigate', path: '/ledger', label: 'the ledger' })
  assert.equal(u('hello ching go to accounting').path, '/accounting')
  assert.equal(u('show me the accounting summary').path, '/accounting-summary')
  assert.equal(u('open the hotel calendar').path, '/accommodation/calendar')
  assert.equal(u('take me to hotels').path, '/accommodation')
  assert.equal(u('open my trips').path, '/my-trips')
  assert.equal(u('open settings').path, '/settings')
  assert.equal(u('go back').type, 'back')
})
test('builder tabs only inside the builder', () => {
  assert.deepEqual(u('go to logistics', { inBuilder: true }), { type: 'tab', tab: 'Logistics' })
  assert.deepEqual(u('open pricing', { inBuilder: true }), { type: 'tab', tab: 'Pricing' })
})
test('open a trip by id or client', () => {
  assert.deepEqual(u('open trip TRP123456'), { type: 'open-trip', query: 'TRP123456' })
  assert.deepEqual(u("open rahul's trip"), { type: 'open-trip', query: 'rahul' })
  assert.deepEqual(u('open the trip for rahul sharma'), { type: 'open-trip', query: 'rahul sharma' })
})
test('questions and voice', () => {
  assert.equal(u("what's pending", { inBuilder: true }).type, 'pending')
  assert.equal(u('is the trip ready').type, 'pending')
  assert.equal(u('what is the total').type, 'total')
  assert.deepEqual(u('stop talking'), { type: 'voice', on: false })
  assert.deepEqual(u('talk to me'), { type: 'voice', on: true })
})
test('small talk has a reply', () => {
  for (const t of ['tell me a joke', 'how are you', 'thank you', 'hello', 'what can you do', 'who are you']) {
    const r = u(t)
    assert.equal(r?.type, 'smalltalk', t)
    assert.ok(r.reply.length > 5, t)
  }
})
test('trip building and edits are left alone', () => {
  for (const [t, b] of [
    ['show me a 3 night trip for rahul sharma 4 adults from 10 november', false],
    ['create a 5 day 4 night itinerary for rahul', false],
    ['make gulmarg 2 nights', true],
    ['add shikara ride on day 2', true],
    ['give me 20% margin', true],
    ['send it to the client on whatsapp', true],
    ['2 nights in srinagar at lalit', true],
    ['5 day kashmir trip for rahul sharma 4 adults from 10 november', false],
  ]) assert.equal(u(t, { inBuilder: b }), null, t)
})
test('replies', () => {
  const pending = [{ key: 'clientPhone', label: 'Client phone', level: 'required' }, { key: 'meal0', label: 'Meal plan for Hotel Heevan', level: 'recommended' }]
  assert.match(replyAfter({ mode: 'fill', changes: ['x'], pending, total: '₹79,118', clientName: 'Rahul Sharma' }), /Rahul's trip is filled in\. Total comes to ₹79,118\. Still need client phone\./)
  assert.match(replyAfter({ mode: 'fill', changes: ['x'], pending: [], clientName: '' }), /save or export/)
  assert.match(pendingReply(pending), /Must fill: client phone\. Nice to have: meal plan for Hotel Heevan\./)
  assert.match(pendingReply([]), /ready/)
})
test('checklist: blank trip vs complete trip', () => {
  const blank = tripChecklist({ tripInfo: {}, itinerary: [], accommodations: [], transportation: [] }).map((i) => i.key)
  for (const k of ['clientName', 'clientPhone', 'clientEmail', 'startDate', 'days', 'hotels', 'price']) assert.ok(blank.includes(k), k)
  const done = tripChecklist({
    tripInfo: { clientName: 'Rahul', clientPhone: '+919876543210', clientEmail: 'r@x.com', tripTitle: 'K', destination: 'Kashmir', startDate: '2026-11-10', duration: '2', cost: '50000' },
    itinerary: [{ day: 1, title: 'Day 1: Arrival', activities: ['A'] }, { day: 2, title: 'Day 2: Local', activities: ['B'] }, { day: 3, title: 'Day 3: Departure', activities: [] }],
    accommodations: [{ name: 'H', checkIn: '2026-11-10', checkOut: '2026-11-12', pricePerRoom: 5000, mealPlan: 'Breakfast + Dinner' }],
    transportation: [{ vehicleId: 1 }],
  })
  assert.deepEqual(done, [])
})
test('checklist: a night with no hotel is caught', () => {
  const items = tripChecklist({
    tripInfo: { startDate: '2026-11-10', duration: '3' },
    itinerary: [],
    accommodations: [{ name: 'H', checkIn: '2026-11-10', checkOut: '2026-11-12', pricePerRoom: 1, mealPlan: 'x' }],
    transportation: [],
  })
  assert.ok(items.some((i) => i.key === 'hotelGaps' && /12 Nov/.test(i.label)))
})

test('client name without a lead-in word', () => {
  const cat = { hotels: [{ id: 1, name: 'Pine N Peak', city: 'Pahalgam' }], destinations: [{ id: 3, name: 'Pahalgam' }], vehicles: [] }
  const name = (t) => parseChingCommand(t, cat, { today: '2026-10-03' }).clientName
  assert.equal(name('rahul sharma pahalgam 2 nights'), 'Rahul Sharma')
  assert.equal(name('itinerary for 2 adults rahul sharma pahalgam 2 nights'), 'Rahul Sharma')
  assert.equal(name("for rahul sharma's family 2 nights in pahalgam"), 'Rahul Sharma')
  assert.equal(name('rahul ka 2 night pahalgam package banao'), 'Rahul')
  assert.equal(name('2 night pahalgam trip'), '')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
