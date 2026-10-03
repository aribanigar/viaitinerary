// Ching assistant + trip checklist tests: node frontend/scripts/ching-assistant.test.mjs
import assert from 'node:assert/strict'
import { understandAssistant, replyAfter, pendingReply } from '../src/utils/ching/assistant.js'
const u = (t, o) => understandAssistant(t, o)
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


test('memory: name, aliases, usual hotel, notes, recall, forget', () => {
  assert.deepEqual(u('call me Arif'), { type: 'remember', kind: 'name', value: 'Arif' })
  assert.deepEqual(u('when I say heaven I mean Heevan Resort'), { type: 'remember', kind: 'alias', key: 'heaven', value: 'heevan resort' })
  assert.deepEqual(u('my usual hotel in gulmarg is the vintage'), { type: 'remember', kind: 'hotel', city: 'gulmarg', hotel: 'the vintage' })
  assert.equal(u('remember that Rahul likes window seats').kind, 'note')
  assert.equal(u('what do you remember').type, 'recall')
  assert.deepEqual(u('forget everything'), { type: 'forget', all: true })
  // In the builder a bare "forget the gondola" is a trip edit, not memory.
  assert.equal(understandAssistant('forget the gondola', { inBuilder: true }), null)
})

test('documents for any trip', () => {
  assert.deepEqual(u('email the invoice to rahul'), { type: 'doc', doc: 'invoice', action: 'email', query: 'rahul', toMe: false })
  assert.equal(u("download rahul sharma's vouchers").query, 'rahul sharma')
  assert.equal(u('send the payment receipt to rahul on whatsapp').action, 'whatsapp')
  assert.equal(u('send vouchers for TRP123456').query, 'TRP123456')
  // The builder's own commands stay the builder's.
  for (const t of ['export the pdf', 'email it to me', 'export excel', 'send the itinerary to the client']) {
    assert.equal(understandAssistant(t, { inBuilder: true }), null, t)
  }
})

test('operations, suppliers, drivers', () => {
  assert.deepEqual(u("today's arrivals"), { type: 'ops', when: 'today', focus: 'arrivals' })
  assert.equal(u('who is arriving tomorrow').when, 'tomorrow')
  assert.equal(u('any pending confirmations').focus, 'confirmations')
  assert.equal(u("who hasn't paid").focus, 'unpaid')
  assert.deepEqual(u("send hotel requests for rahul's trip"), { type: 'supplier', kinds: ['hotel'], query: 'rahul' })
  assert.deepEqual(u('ask the cabs to confirm'), { type: 'supplier', kinds: ['cab'], query: null })
  assert.deepEqual(u("the driver for rahul's trip is ramesh 98765 43210 jk01ab1234"), {
    type: 'driver', name: 'Ramesh', phone: '9876543210', vehicleNumber: 'JK01AB1234', query: 'rahul',
  })
  assert.equal(u('open daily ops').path, '/operations')
})

test('trip search with filters', () => {
  const r = u('find unpaid trips to gulmarg in october')
  assert.equal(r.type, 'find-trips')
  assert.equal(r.params.payment, 'unpaid')
  assert.equal(r.params.q, 'gulmarg')
  assert.match(r.params.from, /-10-01$/)
  assert.deepEqual(u('show confirmed bookings for rahul').params, { status: 'confirmed', q: 'rahul' })
  assert.deepEqual(u("rahul's trips").params, { q: 'rahul' })
  // Trip requests are never searches.
  assert.equal(u('show me a 3 night trip for rahul'), null)
  assert.equal(u('5 day kashmir trip for rahul'), null)
})

test('money, status and reminders by voice', () => {
  assert.deepEqual(u('rahul paid 20000 by upi'), { type: 'payment', amount: 20000, method: 'UPI', methodSaid: true, query: 'rahul' })
  assert.equal(u('received 25,000 from rahul through bank transfer').amount, 25000)
  assert.equal(u('rahul sharma has paid 15k in cash').amount, 15000)
  assert.equal(u('rahul paid 1,50,000').amount, 150000)
  assert.deepEqual(u("mark rahul's trip as confirmed"), { type: 'status', status: 'confirmed', query: 'rahul' })
  assert.equal(u('mark this trip as cancelled').query, null)
  assert.deepEqual(u('remind rahul about the payment'), { type: 'remind', kind: 'payment', query: 'rahul' })
  // The open trip's own reminder / edits stay with the builder.
  for (const t of ['remind the client about the payment', 'send a reminder to the client', 'make day 3 a leisure day', 'give me 20% margin']) {
    assert.equal(understandAssistant(t, { inBuilder: true }), null, t)
  }
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
