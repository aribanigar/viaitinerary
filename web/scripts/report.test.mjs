// Reports aggregation (lib/report.js) on plain objects: node web/scripts/report.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
const { buildReport, tripStage } = await import('@/lib/report.js')

let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('ok -', name) }

const ob = (partyType, partyId, partyName, expected, settled = 0) =>
  ({ direction: 'payable', partyType, partyId, partyName, sourceType: partyType === 'hotel' ? 'accommodation' : 'transportation', expectedAmount: expected, settledAmount: settled })
const trip = (o) => ({ tripId: 'T', tripTitle: 'Trip', clientName: 'Rahul', clientPhone: '+91 98765 43210', destination: 'Kashmir', status: 'confirmed',
  startDate: new Date('2026-11-10'), createdAt: new Date('2026-10-01T10:00:00Z'), currency: 'INR (₹)', cost: 0, gstAmount: 0, includeGst: true,
  paidAmount: 0, refundedAmount: 0, tripActivities: [], obligations: [], ...o })
const now = new Date('2026-11-15T06:00:00Z')

test('stages: confirmed/completed or paid = booked, rejected = lost, else quote', () => {
  assert.equal(tripStage({ status: 'confirmed' }), 'booked')
  assert.equal(tripStage({ status: 'pending', paidAmount: 5000 }), 'booked')
  assert.equal(tripStage({ status: 'pending' }), 'quote')
  assert.equal(tripStage({ status: 'rejected', paidAmount: 100 }), 'lost')
})

test('profit = sales - GST - hotel - cab - activity costs; margin on net', () => {
  const r = buildReport([trip({ tripId: 'A', cost: 105000, gstAmount: 5000, paidAmount: 30000,
    tripActivities: [{ costPerTicket: 1000, ticketCount: 2, childCost: 500, childCount: 1 }],
    obligations: [ob('hotel', 1, 'Lalit', 40000, 10000), ob('cab', 2, 'Innova', 15000)] })], { now })
  const k = r.kpi
  assert.equal(k.sales, 105000); assert.equal(k.gst, 5000); assert.equal(k.net, 100000)
  assert.equal(k.costs, 57500); assert.equal(k.profit, 42500); assert.equal(k.margin, 42.5)
  assert.equal(k.collected, 30000); assert.equal(k.outstanding, 75000)
  assert.equal(k.hotelDue, 30000); assert.equal(k.cabDue, 15000); assert.equal(k.hotelPaid, 10000)
})

test('quotes and lost trips count separately and never touch sales/costs', () => {
  const r = buildReport([
    trip({ tripId: 'A', cost: 50000, obligations: [ob('hotel', 1, 'Lalit', 20000)] }),
    trip({ tripId: 'Q', status: 'pending', cost: 80000, obligations: [ob('hotel', 1, 'Lalit', 30000)] }),
    trip({ tripId: 'L', status: 'rejected', cost: 60000 }),
  ], { now })
  assert.equal(r.kpi.booked, 1); assert.equal(r.kpi.quotes, 1); assert.equal(r.kpi.lost, 1)
  assert.equal(r.kpi.sales, 50000); assert.equal(r.kpi.quoteValue, 80000); assert.equal(r.kpi.lostValue, 60000)
  assert.equal(r.kpi.hotelDue, 20000)
  assert.equal(r.vendors.hotels[0].trips_count, 1)
  assert.equal(Math.round(r.kpi.conversion), 33)
})

test('receivables: overdue once travel has started, sorted overdue first', () => {
  const r = buildReport([
    trip({ tripId: 'LATER', cost: 20000, startDate: new Date('2026-12-01') }),
    trip({ tripId: 'PAST', cost: 30000, paidAmount: 10000, startDate: new Date('2026-11-12') }),
    trip({ tripId: 'PAID', cost: 10000, paidAmount: 10000 }),
  ], { now })
  assert.deepEqual(r.receivables.map((x) => x.trip_id), ['PAST', 'LATER'])
  assert.equal(r.receivables[0].overdue, true); assert.equal(r.kpi.overdue, 20000)
  assert.equal(r.receivables[1].days_to_travel, 16)
})

test('vendors grouped across trips, one row per trip, sorted by amount due', () => {
  const r = buildReport([
    trip({ tripId: 'A', obligations: [ob('hotel', 1, 'Lalit', 10000), ob('hotel', 1, 'Lalit', 5000), ob('hotel', 2, 'Khyber', 8000, 8000)] }),
    trip({ tripId: 'B', obligations: [ob('hotel', 1, 'Lalit', 20000, 5000)] }),
  ], { now })
  const [lalit, khyber] = r.vendors.hotels
  assert.equal(lalit.party_name, 'Lalit'); assert.equal(lalit.expected_total, 35000); assert.equal(lalit.due, 30000)
  assert.equal(lalit.trips_count, 2); assert.equal(lalit.trips[0].expected_amount, 15000)
  assert.equal(khyber.due, 0)
})

test('months follow the basis; booking month uses the agent time zone', () => {
  const t = trip({ cost: 1000, createdAt: new Date('2026-09-30T20:00:00Z'), startDate: new Date('2026-11-10') })
  assert.equal(buildReport([t], { now, basis: 'travel' }).months[0].month, '2026-11')
  assert.equal(buildReport([t], { now, basis: 'booking', tzOffsetMin: -330 }).months[0].month, '2026-10') // 01:30 IST on 1 Oct
  assert.equal(buildReport([t], { now, basis: 'booking', tzOffsetMin: 240 }).months[0].month, '2026-09')
})

test('top destinations and clients aggregate case-insensitively', () => {
  const r = buildReport([trip({ cost: 1000, destination: 'Kashmir' }), trip({ cost: 2000, destination: 'kashmir ' }), trip({ cost: 500, destination: 'Ladakh', clientName: 'Asha' })], { now })
  assert.equal(r.destinations[0].trips, 2); assert.equal(r.destinations[0].sales, 3000)
  assert.equal(r.clients[0].client_name, 'Rahul'); assert.equal(r.clients[0].trips, 2)
})

test('empty range is all zeros, no NaN', () => {
  const r = buildReport([], { now })
  assert.ok(Object.values(r.kpi).every((v) => v === 0))
})

console.log(`${passed} passed, 0 failed`)
