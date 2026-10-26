// How Ching is doing (lib/chingInsight.js) against a fake Prisma, with the
// browser's shape maker (frontend utils/ching/insight.js):
//   node web/scripts/ching-insight.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
const prisma = (await import('../lib/prisma.js')).default
const ins = await import('../lib/chingInsight.js')
const mem = await import('../lib/chingMemory.js')
const { shapeOf, shapeKey, missEvent, scrub, missesAsText } = await import('../../frontend/src/utils/ching/insight.js')

let rows = []
let id = 0
const cmp = (a, v) => (v && typeof v === 'object' && 'in' in v ? v.in.includes(a) : v && typeof v === 'object' && 'lt' in v ? a < v.lt : a === v)
const match = (r, w) => Object.entries(w || {}).every(([k, v]) => cmp(r[k], v))
prisma.chingMemory.findMany = async ({ where, take, orderBy }) => {
  let out = rows.filter((r) => match(r, where))
  if (orderBy?.updatedAt) out = out.sort((a, b) => (orderBy.updatedAt === 'asc' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt))
  return take ? out.slice(0, take) : out
}
prisma.chingMemory.findUnique = async ({ where }) => rows.find((r) => match(r, where.userId_kind_key)) || null
prisma.chingMemory.count = async ({ where }) => rows.filter((r) => match(r, where)).length
prisma.chingMemory.deleteMany = async ({ where }) => { const n = rows.length; rows = rows.filter((r) => !match(r, where)); return { count: n - rows.length } }
prisma.chingMemory.upsert = async ({ where, create, update }) => {
  let r = rows.find((x) => match(x, where.userId_kind_key))
  if (r) Object.assign(r, update, { updatedAt: new Date() })
  else rows.push((r = { id: ++id, ...create, updatedAt: new Date() }))
  return r
}
prisma.chingMemory.update = async ({ where, data }) => Object.assign(rows.find((r) => match(r, where.userId_kind_key)), data)
prisma.trip.findMany = async () => []

const catalog = { hotels: [{ name: 'Heevan Resort', city: 'Pahalgam' }], destinations: [{ name: 'Gulmarg' }], vehicles: [{ name: 'Toyota Innova Crysta' }] }

// ── shapes: one weak spot is one line
assert.equal(shapeOf('make gulmarg 3 nites', catalog), 'make {place} # nites')
assert.equal(shapeOf('Make Pahalgam 2 nites', catalog), 'make {place} # nites')
assert.equal(shapeOf('book heevan resort for rahul sharma from 10th november', catalog), 'book {hotel} for {name} from {date}')
assert.equal(shapeOf('quote 45,000 for mr khan', catalog), 'quote # for {name}')
assert.equal(shapeOf('swap the innova crysta on day 3', catalog), 'swap the {cab} on day #')
assert.equal(shapeKey('a'), shapeKey('a'))
assert.notEqual(shapeKey('make {place} # nites'), shapeKey('make {place} # nights'))
// Nothing personal leaves the browser.
assert.equal(scrub('call rahul on +91 98765 43210 or rahul.s@example.com'), 'call rahul on <phone> or <email>')
assert.equal(missEvent('unknown', '   '), null)
const e1 = missEvent('unknown', 'make gulmarg 3 nites', { catalog, page: '/trip-builder' })
const e2 = missEvent('unknown', 'make pahalgam 2 nites', { catalog, page: '/trip-builder' })
assert.equal(e1.key, e2.key, 'the same shape is the same miss')
assert.notEqual(missEvent('partial', 'make gulmarg 3 nites', { catalog }).key, e1.key, 'but another kind of miss is its own line')

// ── recording
await ins.recordInsights(7, 5, [e1, e2, { type: 'stat', name: 'turns', n: 10 }, { type: 'stat', name: 'missed', n: 2 }, { type: 'stat', name: 'plans', n: 4 }, { type: 'stat', name: 'confirmed', n: 3 }, { type: 'stat', name: 'made-up', n: 9 }, { type: 'miss', kind: 'made-up', key: 'x', text: 'y' }])
await ins.recordInsights(7, 6, [missEvent('unknown', 'make srinagar 4 nites call 9876543210', { catalog }), { type: 'stat', name: 'turns', n: 5 }, { type: 'stat', name: 'corrected', n: 1 }])
const r = await ins.readInsights(7, { days: 14 })
assert.equal(r.misses.length, 2, 'two shapes (the third sentence has a phone number in it)')
const top = r.misses.find((m) => m.shape === 'make {place} # nites')
assert.deepEqual([top.count, top.kind, top.status, top.examples.length, top.by], [2, 'unknown', 'open', 2, [5]])
assert.ok(r.misses.every((m) => !/\d{7}/.test(JSON.stringify(m))), 'no phone number stored')
assert.deepEqual([r.totals.turns, r.totals.missed, r.totals['made-up']], [15, 2, undefined])
assert.deepEqual(r.score, { understood: 86.7, missed: 13.3, corrected: 7.7, confirmed: 75, turns: 15 })
assert.equal(r.open, 2)
assert.deepEqual(r.byKind, { unknown: 3 })
assert.match(missesAsText(r.misses), /^\[unknown x2\] make (?:gulmarg 3|pahalgam 2) nites/)

// ── fixing and ignoring
assert.equal(await ins.setMissStatus(7, top.key, 'done'), true)
assert.equal(await ins.setMissStatus(8, top.key, 'done'), false, 'tenant-scoped')
assert.equal((await ins.readInsights(7)).open, 1)
await ins.recordInsights(7, 5, [e1]) // seen again after "fixed"
const again = (await ins.readInsights(7)).misses.find((m) => m.key === top.key)
assert.deepEqual([again.status, again.count, again.reopened], ['open', 3, 1], 'a fixed miss that comes back reopens itself')
await ins.setMissStatus(7, top.key, 'ignored')
await ins.recordInsights(7, 5, [e1])
assert.equal((await ins.readInsights(7)).misses.find((m) => m.key === top.key).status, 'ignored', 'an ignored one stays ignored')

// ── every agency together (platform super admins)
await ins.recordInsights(9, 1, [e1, { type: 'stat', name: 'turns', n: 20 }])
const all = await ins.readInsights(null)
const shared = all.misses.find((m) => m.shape === 'make {place} # nites')
assert.deepEqual([shared.count, shared.agencies, shared.status], [5, 2, 'open'])
assert.equal(all.totals.turns, 35)
assert.equal((await ins.readInsights(9)).totals.turns, 20)

// ── not memory, and never in the way of it
const m = await mem.chingMemory(7, 5)
assert.deepEqual([m.notes, m.aliases, m.hotelTags], [[], {}, {}])
assert.equal(await ins.deleteMisses(7), 2)
assert.equal((await ins.readInsights(7)).totals.turns, 15, 'clearing the list keeps the numbers')

// ── the report maths on its own
const rep = ins.buildReport([], [{ key: '2026-10-14', value: '{"turns":0}' }, { key: 'junk', value: 'x' }], { days: 7, now: new Date('2026-10-14T10:00:00Z') })
assert.deepEqual(rep.score, { understood: null, missed: null, corrected: null, confirmed: null, turns: 0 })
assert.equal(rep.daily.length, 1)

console.log('ching insight: all checks passed')
