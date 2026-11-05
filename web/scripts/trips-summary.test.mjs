// GET /api/trips/summary must give the dashboard exactly what it used to work
// out from GET /api/trips?per_page=1000: node web/scripts/trips-summary.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
// Plain node needs the file extension on Next's own subpath imports.
register('data:text/javascript,' + encodeURIComponent(
  'export async function resolve(s, c, n) { return n(/^next\\/(headers|server)$/.test(s) ? s + ".js" : s, c) }'
))
import assert from 'node:assert/strict'

const prisma = (await import('../lib/prisma.js')).default
const { signToken } = await import('../lib/auth.js')

// ── fake data: two agencies, packages, mixed-case statuses, inline dates
const day = (n) => new Date(Date.UTC(2026, 10, 5 + n))
let id = 0
const T = (o) => ({ id: ++id, userId: 1, isPackage: false, tripId: 'TRP' + (100 + id), tripTitle: 'Trip ' + id, clientName: 'C' + id, clientPhone: null,
  startDate: null, duration: '3', cost: 1000, paidAmount: 0, refundedAmount: 0, currency: 'INR (₹)', imagePath: null, status: 'pending',
  proposalResponse: null, proposalMessage: null, proposalViewedAt: null, updatedAt: new Date(), createdAt: new Date(), ...o })
const rows = [
  T({ status: 'confirmed', paidAmount: 5000, startDate: day(0) }),
  T({ status: 'Confirmed', paidAmount: 2500.5, startDate: day(3) }),
  T({ status: 'completed', paidAmount: 9000, startDate: day(-30) }),
  T({ status: 'pending', startDate: day(8) }),
  T({ status: 'draft', startDate: day(40) }),
  T({ status: 'confirmed', isPackage: true, paidAmount: 77777, startDate: day(1) }), // package: never counted
  T({ userId: 2, status: 'confirmed', paidAmount: 99999, startDate: day(0) }), // another agency: never seen
]
const matches = (t, where) =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'startDate') return t.startDate && (!v.gte || t.startDate >= v.gte) && (!v.lte || t.startDate <= v.lte)
    if (k === 'OR' || k === 'id') return true
    return t[k] === v
  })
const scoped = (where) => rows.filter((t) => matches(t, where))
prisma.user.findUnique = async ({ where }) => (where.id === 1 ? { id: 1, role: 'admin', status: 'active', name: 'Owner' } : null)
prisma.user.findMany = async () => [{ id: 1, name: 'Owner' }]
prisma.trip.count = async ({ where }) => scoped(where).length
prisma.trip.findMany = async ({ where, skip = 0, take = 1e9 }) => scoped(where).slice(skip, skip + take)
prisma.trip.groupBy = async ({ where }) => {
  const m = new Map()
  for (const t of scoped(where)) m.set(t.status, (m.get(t.status) || 0) + 1)
  return [...m].map(([status, n]) => ({ status, _count: { _all: n } }))
}
prisma.trip.aggregate = async ({ where }) => ({ _sum: { paidAmount: scoped(where).reduce((s, t) => s + Number(t.paidAmount), 0) } })

const auth = { headers: { authorization: 'Bearer ' + signToken({ sub: 1 }) } }
const call = async (mod, url) => (await (await import(mod)).GET(new Request('http://x' + url, auth))).json()

// What the dashboard computed before, from the full list:
const list = await call('../app/api/trips/route.js', '/api/trips?per_page=1000')
const before = {
  total: list.data.length,
  revenue: list.data.reduce((s, t) => s + (parseFloat(t.paid_amount) || 0), 0),
  confirmed: list.data.filter((t) => t.status?.toLowerCase() === 'confirmed').length,
  completed: list.data.filter((t) => t.status?.toLowerCase() === 'completed').length,
}
const sum = await call('../app/api/trips/summary/route.js', '/api/trips/summary?from=2026-11-04&to=2026-11-14')
assert.equal(sum.total, before.total, 'total trips')
assert.equal(sum.paid_total, before.revenue, 'revenue')
assert.equal(sum.status.confirmed, before.confirmed, 'confirmed (case-insensitive)')
assert.equal(sum.status.completed, before.completed, 'completed')
assert.deepEqual(before, { total: 5, revenue: 16500.5, confirmed: 2, completed: 1 }, 'tenant + package scope')
// The window rows are the list rows, unchanged.
const inWindow = list.data.filter((t) => t.start_date >= '2026-11-04' && t.start_date <= '2026-11-14')
assert.deepEqual(sum.trips.map((t) => t.trip_id).sort(), inWindow.map((t) => t.trip_id).sort())
assert.deepEqual(sum.trips.find((t) => t.trip_id === inWindow[0].trip_id), inWindow[0], 'same row shape as GET /api/trips')
// A window is capped (31 days), and nobody else's trips appear.
const wide = await call('../app/api/trips/summary/route.js', '/api/trips/summary?from=2026-01-01&to=2027-12-31')
assert.equal(wide.to, '2026-02-01')
assert.ok(!sum.trips.some((t) => t.paid_amount === 99999 || t.paid_amount === 77777))
console.log('trips summary: all checks passed')
