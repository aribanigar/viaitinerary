// Hotel tags + saved conversations (lib/chingMemory.js, lib/chingConversation.js)
// against a fake Prisma — both live in ChingMemory rows, apart from memory.
//   node web/scripts/ching-store.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
const prisma = (await import('../lib/prisma.js')).default
const mem = await import('../lib/chingMemory.js')
const conv = await import('../lib/chingConversation.js')
const { ALL_TAGS } = await import('../../frontend/src/utils/ching/meaning.js')
const { ALL_PLACE_TAGS } = await import('../../frontend/src/utils/ching/whereTo.js')

// ── a fake chingMemory table
let rows = []
const match = (r, w) => Object.entries(w).every(([k, v]) => (v && typeof v === 'object' && 'in' in v ? v.in.includes(r[k]) : r[k] === v))
prisma.chingMemory.findMany = async ({ where }) => rows.filter((r) => match(r, where))
prisma.chingMemory.findUnique = async ({ where }) => rows.find((r) => match(r, where.userId_kind_key)) || null
prisma.chingMemory.deleteMany = async ({ where }) => { const n = rows.length; rows = rows.filter((r) => !match(r, where)); return { count: n - rows.length } }
prisma.chingMemory.upsert = async ({ where, create, update }) => {
  let r = rows.find((x) => match(x, where.userId_kind_key))
  if (r) Object.assign(r, update, { updatedAt: new Date() })
  else rows.push((r = { ...create, updatedAt: new Date() }))
  return r
}
prisma.hotel.findFirst = async ({ where }) => (where.userId === 7 && [11, 12].includes(where.id) ? { id: where.id } : null)
prisma.trip.findMany = async () => []

// The server's tag list is the browser's.
assert.deepEqual([...mem.HOTEL_TAGS].sort(), [...ALL_TAGS].sort(), 'HOTEL_TAGS (web) and TAG_GROUPS (frontend) are the same vocabulary')

// ── hotel tags
assert.deepEqual(await mem.setHotelTags(7, 11, ['riverside', 'quiet', 'made-up', 'riverside'], 5), ['riverside', 'quiet'], 'unknown tags are dropped, repeats merged')
assert.equal(await mem.setHotelTags(7, 99, ['quiet']), null, "another agency's hotel (or none) is refused")
assert.equal(await mem.setHotelTags(8, 11, ['quiet']), null, 'tenant-scoped')
await mem.setHotelTags(7, 12, ['houseboat', 'lake-view'])
assert.deepEqual(await mem.hotelTagMap(7), { 11: ['riverside', 'quiet'], 12: ['houseboat', 'lake-view'] })
assert.deepEqual(await mem.hotelTagMap(8), {})
assert.deepEqual((await mem.chingMemory(7, 5)).hotelTags, { 11: ['riverside', 'quiet'], 12: ['houseboat', 'lake-view'] }, 'tags reach Ching with its memory')
assert.deepEqual(await mem.setHotelTags(7, 12, []), [], 'no tags = the row is removed')
assert.equal(rows.filter((r) => r.kind === 'hoteltag').length, 1)

// ── place tags (what a destination is like)
prisma.destination.findFirst = async ({ where }) => (where.userId === 7 && where.id === 2 ? { id: 2 } : null)
assert.deepEqual([...mem.PLACE_TAGS].sort(), [...ALL_PLACE_TAGS].sort(), 'PLACE_TAGS (web) and PLACE_TAG_GROUPS (frontend) are the same vocabulary')
assert.deepEqual(await mem.setPlaceTags(7, 2, ['snow', 'skiing', 'riverside']), ['snow', 'skiing'], 'a hotel tag is not a place tag')
assert.equal(await mem.setPlaceTags(8, 2, ['snow']), null, 'tenant-scoped')
assert.deepEqual(await mem.placeTagMap(7), { 2: ['snow', 'skiing'] })
assert.deepEqual((await mem.chingMemory(7, 5)).placeTags, { 2: ['snow', 'skiing'] }, 'place tags reach Ching with its memory')
assert.deepEqual(await mem.hotelTagMap(7), { 11: ['riverside', 'quiet'] }, 'and are kept apart from hotel tags')
await mem.setPlaceTags(7, 2, [])
assert.deepEqual(await mem.placeTagMap(7), {})

// ── conversations
const c0 = await conv.readConversation(7, 5)
assert.deepEqual([c0.lines, c0.pending], [[], null], 'nothing saved yet')
const lines = Array.from({ length: 260 }, (_, i) => ({ role: i % 2 ? 'ching' : 'you', text: `line ${i}`, at: 1000 + i, thread: 'draft:abc' }))
await conv.saveConversation(7, 5, { lines, threads: { 'draft:abc': { title: 'Kashmir 4N/5D', at: 1 } }, pending: { thread: 'draft:abc', text: 'kashmir trip, 4 nights', ask: ['adults', 'startDate'], month: 11, nameAsked: true, question: 'How many people?', evil: '<x>' } })
const c1 = await conv.readConversation(7, 5)
assert.equal(c1.lines.length, conv.MAX_LINES, 'bounded: the newest lines are kept')
assert.equal(c1.lines[c1.lines.length - 1].text, 'line 259')
assert.equal(c1.threads['draft:abc'].title, 'Kashmir 4N/5D')
assert.deepEqual([c1.pending.text, c1.pending.ask, c1.pending.month, c1.pending.nameAsked, 'evil' in c1.pending], ['kashmir trip, 4 nights', ['adults', 'startDate'], 11, true, false])
assert.deepEqual((await conv.readConversation(7, 6)).lines, [], "a team-mate doesn't see it")
assert.deepEqual((await conv.readConversation(8, 5)).lines, [], 'nor another agency')
// A conversation is not memory: it isn't in what Ching "remembers"…
const m = await mem.chingMemory(7, 5)
assert.deepEqual([m.notes, m.aliases], [[], {}])
// …and junk in never breaks a read.
assert.deepEqual(conv.cleanConversation('nonsense').lines, [])
assert.deepEqual(conv.cleanConversation({ lines: [{ text: '' }, { role: 'x', text: ' hi ' }] }).lines.map((l) => [l.role, l.text]), [['you', 'hi']])
await conv.clearConversation(7, 5)
assert.deepEqual((await conv.readConversation(7, 5)).lines, [])
assert.equal(rows.filter((r) => r.kind === 'hoteltag').length, 1, 'clearing a conversation leaves the hotel tags')

console.log('ching store: all checks passed')
