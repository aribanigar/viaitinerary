// Operations (Phase 3) + Ching memory server logic against a fake Prisma:
//   node web/scripts/operations.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
const prisma = (await import('../lib/prisma.js')).default
const ops = await import('../lib/operations.js')
const d = (s) => new Date(s + 'T00:00:00Z')
const vehicle = { id: 22, name: 'Dzire', price: 2500, email: 'cabs@example.com', phone: '9811100000' }
const trip = {
  id: 1, userId: 7, tripId: 'TRP1', tripTitle: 'Kashmir 3N/4D', clientName: 'Rahul Sharma', clientPhone: '+919876543210', clientEmail: 'r@x.com',
  adults: 2, kids5to12: 0, kidsCnb: 0, startDate: d('2026-10-03'), duration: '3', status: 'pending', cost: 50000, paidAmount: 10000, refundedAmount: 0, isPackage: false,
  accommodations: [
    { id: 11, name: 'Heevan', city: 'Pahalgam', rooms: '1', roomType: 'Deluxe', mealPlan: 'Breakfast + Dinner', pricePerRoom: 6500, checkIn: d('2026-10-03'), checkOut: d('2026-10-05'), hotel: { name: 'Heevan', email: 'h@example.com', phone: null } },
    { id: 12, name: 'Grand', city: 'Srinagar', rooms: '1', roomType: 'Deluxe', mealPlan: 'Only Room', pricePerRoom: 5000, checkIn: d('2026-10-05'), checkOut: d('2026-10-06'), supplierStatus: 'confirmed', supplierRef: 'G1', hotel: { name: 'Grand', email: null, phone: '9000000000' } },
  ],
  transportations: [1, 2, 3, 4].map((n) => ({ id: 30 + n, vehicleId: n === 1 ? 22 : null, vehicleType: 'Dzire', route: `Day ${n}`, date: d(`2026-10-0${2 + n}`), vehicle: n === 1 ? vehicle : null })),
}
// ── fake prisma
const updates = []
prisma.trip.findMany = async () => [trip]
prisma.accommodation.update = async ({ where, data }) => { updates.push(['acc', where.id, data]); Object.assign(trip.accommodations.find((a) => a.id === where.id), data) }
prisma.transportation.update = async ({ where, data }) => { updates.push(['cab', where.id, data]); Object.assign(trip.transportations.find((a) => a.id === where.id), data) }
prisma.accommodation.updateMany = async ({ where, data }) => { updates.push(['accMany', where.id.in, data]); trip.accommodations.filter((a) => where.id.in.includes(a.id)).forEach((a) => Object.assign(a, data)) }
prisma.transportation.updateMany = async ({ where, data }) => { updates.push(['cabMany', where.id.in, data]); trip.transportations.filter((a) => where.id.in.includes(a.id)).forEach((a) => Object.assign(a, data)) }
const sent = []
const mailer = { transporter: { sendMail: async (m) => sent.push(m) }, fromName: 'A', fromEmail: 'a@x' }

// board
const b = await ops.operationsBoard(7, { from: '2026-10-03', days: 1 })
assert.equal(b.days[0].arrivals.length, 1)
assert.equal(b.days[0].checkins.length, 1)
assert.equal(b.days[0].cabs.length, 1)
assert.equal(b.confirmations.length, 2, 'Heevan + the cab group (Grand is confirmed)')
assert.equal(b.confirmations.find((c) => c.kind === 'cab').days, 4)
assert.equal(b.unpaid[0].balance, 40000)
assert.equal(b.counts.cabs_without_driver, 1)
// requests
const rows = await ops.requestSupplierConfirmations(trip, { kinds: ['hotel', 'cab'], origin: 'https://app.test', mailer, settings: { agencyName: 'Hudace' } })
assert.equal(rows.length, 3)
assert.equal(rows.find((r) => r.id === 12).skipped, 'already confirmed')
assert.equal(sent.length, 2, 'hotel + cab emailed once each (one email for all 4 cab days)')
assert.ok(rows.find((r) => r.kind === 'cab').link.startsWith('https://app.test/s/'))
assert.ok(trip.transportations.every((t) => t.supplierStatus === 'requested'))
assert.ok(rows.find((r) => r.kind === 'cab').whatsapp_url.startsWith('https://wa.me/919811100000'))
// public view: no prices, no client contact
const pub = ops.publicBooking({ kind: 'hotel', row: trip.accommodations[0], trip, settings: { agencyName: 'Hudace' } })
const json = JSON.stringify(pub)
assert.ok(!/6500|price|cost|9876543210|r@x\.com/.test(json), json)
const pubCab = ops.publicBooking({ kind: 'cab', row: trip.transportations[0], siblings: trip.transportations, trip, settings: {} })
assert.equal(pubCab.days.length, 4)
assert.ok(!/2500|price/.test(JSON.stringify(pubCab)))
// change detection
assert.ok(ops.bookingChanged('hotel', trip.accommodations[0], { ...trip.accommodations[0], checkOut: d('2026-10-06') }))
assert.ok(!ops.bookingChanged('hotel', trip.accommodations[0], { ...trip.accommodations[0] }))
assert.ok(ops.bookingChanged('cab', trip.transportations[0], { ...trip.transportations[0], date: d('2026-10-09') }))
const em = ops.supplierRequestEmail({ kind: 'cab', booking: pubCab, url: 'https://app.test/s/x', settings: { agencyName: 'Hudace' } })
assert.match(em.subject, /Booking request TRP1/)
console.log('operations: all checks passed')

const { chingMemory } = await import('../lib/chingMemory.js')

const mk = (i, name, hotelPah, cab, guests = 2) => ({
  tripId: `TRP${i}`, tripTitle: 'Kashmir', clientName: name, clientPhone: i === 1 ? '+919811122233' : '', clientEmail: i === 2 ? 'rahul@example.com' : '',
  destination: 'Kashmir', duration: '4', adults: guests, kids5to12: 0, startDate: d('2026-10-01'), updatedAt: d('2026-10-01'),
  accommodations: [
    { hotelId: hotelPah, city: 'Pahalgam', mealPlan: 'Breakfast + Dinner', checkIn: d('2026-10-01'), checkOut: d('2026-10-03'), cancelledAt: null },
    { hotelId: 50, city: 'Srinagar City', mealPlan: 'Breakfast + Dinner', checkIn: d('2026-10-03'), checkOut: d('2026-10-05'), cancelledAt: null },
  ],
  transportations: [{ vehicleId: cab }, { vehicleId: cab }],
})
prisma.trip.findMany = async () => [mk(1, 'Rahul Sharma', 15, 22), mk(2, 'Rahul Sharma', 15, 22), mk(3, 'Asha', 13, 21, 6)]
prisma.chingMemory.findMany = async () => [
  { kind: 'alias', key: 'heaven', value: 'Heevan Resort', updatedAt: d('2026-10-01') },
  { kind: 'hotel', key: 'pahalgam', value: '13', updatedAt: d('2026-10-01') },
  { kind: 'name', key: 'me', value: 'Arif', updatedAt: d('2026-10-01') },
]
const m = await chingMemory(7)
assert.deepEqual(m.hotels.pahalgam, [13, 15], 'told hotel first, then learned')
assert.deepEqual(m.hotels.srinagar, [50])
assert.equal(m.mealPlan, 'Breakfast + Dinner')
assert.deepEqual(m.routes['kashmir|4'], [{ city: 'Pahalgam', nights: 2 }, { city: 'Srinagar City', nights: 2 }])
const rahul = m.clients.find((c) => c.name === 'Rahul Sharma')
assert.equal(rahul.trips, 2); assert.equal(rahul.phone, '+919811122233'); assert.equal(rahul.email, 'rahul@example.com')
assert.equal(m.vehicles.find((v) => v.id === 21).minGuests, 6)
assert.equal(m.aliases.heaven, 'Heevan Resort'); assert.equal(m.callMe, 'Arif')
console.log('memory: all checks passed')
