// Catalog bulk import / export (Settings → Bulk Data Management) against a fake Prisma:
//   node web/scripts/bulk-import.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
const prisma = (await import('../lib/prisma.js')).default
const xl = await import('../lib/excel.js')

// ── fake prisma: three in-memory tables + plan limits ──
let db, nextId, planLimit
function reset() {
  db = { vehicle: [], hotel: [], destination: [] }
  nextId = 1
  planLimit = {}
}
const matches = (r, where) => Object.entries(where).every(([k, v]) => (r[k] ?? null) === v)
for (const m of ['vehicle', 'hotel', 'destination']) {
  prisma[m].findMany = async ({ where }) => db[m].filter((r) => matches(r, where)).map((r) => ({ ...r }))
  prisma[m].update = async ({ where, data }) => Object.assign(db[m].find((r) => r.id === where.id), data)
  prisma[m].create = async ({ data }) => { const r = { id: nextId++, ...data }; db[m].push(r); return r }
  prisma[m].count = async ({ where }) => db[m].filter((r) => matches(r, where)).length
}
prisma.user.findUnique = async () => ({ bypassSubscription: false })
prisma.subscription.findUnique = async () => ({ planKey: 'basic' })
prisma.plan.findFirst = async () => ({ hotelLimit: planLimit.hotel ?? null, cabLimit: planLimit.vehicle ?? null, destinationLimit: planLimit.destination ?? null })

const A = 7
const csv = (rows) => Buffer.from([xl.CATALOG_COLUMNS.join(','), ...rows].join('\n'))
const imp = (buf, opts = {}) => xl.importCatalogWorkbook(buf, A, { fileName: 'catalog.csv', ...opts })

// 1. The sample CSV imports hotels, transport and destinations.
reset()
const sample = xl.templateCsv()
assert.ok(sample.startsWith('﻿Type,Name,City'), 'sample starts with the header (BOM for Excel)')
let r = await imp(Buffer.from(sample))
assert.deepEqual(r.created, { hotels: 2, cabs: 3, destinations: 2 })
assert.equal(r.skipped.length, 0, JSON.stringify(r.skipped))
const lake = db.hotel.find((h) => h.name === 'Example Lake View Hotel')
assert.equal(lake.city, 'Srinagar'); assert.equal(lake.category, '4'); assert.equal(lake.phone, '9876543210')
assert.equal(lake.priceSections.length, 3, 'three rate rows → three rate sections')
assert.deepEqual(lake.priceSections[0], { room_type: 'deluxe', meal_plan: 'breakfast_dinner', price: 6500, cnb: 800, upto_5: 1500, above_12: 2000, extra_adult: 2500, valid_from: '2026-04-01', valid_to: '2026-06-30' })
assert.equal(lake.priceSections[2].room_type, 'super_deluxe')
const innova = db.vehicle.find((v) => v.name === 'Example Innova Crysta')
assert.equal(innova.seatingCapacity, 6); assert.equal(innova.vehicleType, 'suv'); assert.equal(innova.price, 3800)
const gulmarg = db.destination.find((d) => d.name === 'Gulmarg')
assert.deepEqual(gulmarg.activities, [{ name: 'Gondola Phase 1', cost: 900 }, { name: 'Gondola Phase 2', cost: 1100 }, { name: 'Snow Bike Ride', cost: 1500 }])
assert.equal(gulmarg.state, 'Jammu & Kashmir')
assert.match(xl.importSummaryText(r), /^Added 2 hotels, 3 cabs, 2 destinations\.$/)
console.log('sample csv imports: ok')

// 2. Importing it again updates, never duplicates.
r = await imp(Buffer.from(sample))
assert.deepEqual(r.created, { hotels: 0, cabs: 0, destinations: 0 })
assert.deepEqual(r.updated, { hotels: 2, cabs: 3, destinations: 2 })
assert.equal(db.hotel.length, 2); assert.equal(db.vehicle.length, 3); assert.equal(db.destination.length, 2)
console.log('re-import updates: ok')

// 3. Export → import round trip keeps everything (incl. activity prices and extra rate fields).
reset()
db.hotel.push({ id: nextId++, userId: A, name: 'Lalit', city: 'Srinagar', state: null, email: 'h@x.com', phone: '0194-2501001', category: '5', priceSections: [{ room_type: 'deluxe', meal_plan: 'breakfast_dinner', price: 9000, cnb: 0, upto_5: 0, above_12: 0, extra_adult: 0, valid_from: null, valid_to: null, source_id: 'keep-me' }] })
db.vehicle.push({ id: nextId++, userId: A, name: 'Innova', email: 'a@x.com', phone: '99', price: 3500, seatingCapacity: 6, vehicleType: 'suv' })
db.destination.push({ id: nextId++, userId: A, name: 'Gulmarg', state: 'Jammu & Kashmir', city: null, activities: [{ name: 'Gondola Phase 1', cost: 900, id: 'a1' }, { name: 'Snow bike', cost: 0 }] })
const before = JSON.parse(JSON.stringify(db))
const exported = await xl.exportCatalogCsv(A)
r = await imp(Buffer.from(exported))
assert.deepEqual(r.created, { hotels: 0, cabs: 0, destinations: 0 })
assert.equal(r.skipped.length, 0, JSON.stringify(r.skipped))
assert.deepEqual(db, before, 'export → import changes nothing')
console.log('export → import round trip: ok')

// 4. Blank cells leave things unchanged (the old import wiped hotel rates / cab prices).
r = await imp(csv(['Hotel,Lalit,Srinagar,,,0194-9999999', 'Transport,innova,,,,12']))
assert.equal(db.hotel[0].phone, '0194-9999999')
assert.deepEqual(db.hotel[0].priceSections, before.hotel[0].priceSections, 'rates untouched')
assert.equal(db.hotel[0].email, 'h@x.com', 'blank email keeps the old one')
assert.equal(db.vehicle[0].price, 3500, 'blank price keeps the old one')
assert.equal(db.vehicle[0].phone, '12')
console.log('blank cells keep values: ok')

// 5. Messy numbers, meal plan words, dates, star ratings.
reset()
r = await imp(csv([
  'hotel,Heevan,Pahalgam,,,,4 star,Deluxe,MAP,"₹7,500",500,1500,2000,"Rs 2,500",01/04/2026,30-06-2026',
  'Hotel,Heevan,Pahalgam,,,,,Deluxe,Breakfast only (CP),"6,500",,,,,,',
  'Cab,Dzire,Srinagar,,,9876543210,,,,,,,,,,,4,Sedan,"2,500"',
]))
assert.equal(r.skipped.length, 0, JSON.stringify(r.skipped))
const heevan = db.hotel[0]
assert.equal(heevan.category, '4')
assert.equal(heevan.priceSections[0].price, 7500); assert.equal(heevan.priceSections[0].meal_plan, 'breakfast_dinner')
assert.equal(heevan.priceSections[0].extra_adult, 2500)
assert.equal(heevan.priceSections[0].valid_from, '2026-04-01'); assert.equal(heevan.priceSections[0].valid_to, '2026-06-30')
assert.equal(heevan.priceSections[1].meal_plan, 'breakfast_only'); assert.equal(heevan.priceSections[1].price, 6500)
assert.equal(db.vehicle[0].price, 2500); assert.equal(db.vehicle[0].vehicleType, 'sedan'); assert.equal(db.vehicle[0].phone, '9876543210')
console.log('number/date/meal-plan parsing: ok')

// 6. Bad rows are reported, not silently dropped; a hotel with a bad rate row is left whole.
reset()
db.hotel.push({ id: nextId++, userId: A, name: 'Grand', city: 'Srinagar', priceSections: [{ room_type: 'deluxe', meal_plan: 'room_only', price: 5000 }] })
r = await imp(csv([
  'Hotel,Grand,Srinagar,,,,,Deluxe,Room only,5200',
  'Hotel,Grand,Srinagar,,,,,Suite,Half meals,9000',
  'Boat,Shikara,,,',
  'Transport,,Srinagar',
  'Transport,Tempo,,,,,,,,,,,,,,,lots',
  'Destination,Sonamarg,,,,,,,,,,,,,,,,,,Thajiwas Glacier (500); Pony ride',
]))
assert.deepEqual(db.hotel[0].priceSections, [{ room_type: 'deluxe', meal_plan: 'room_only', price: 5000 }], 'Grand untouched because one of its rows was bad')
const reasons = r.skipped.map((s) => `${s.row}: ${s.reason}`)
assert.deepEqual(reasons, [
  '2: Hotel not changed until the errors in its other rows are fixed',
  '3: Meal Plan "Half meals" not recognised (use Room only, CP, MAP or AP)',
  '4: Type "Boat" should be Hotel, Transport or Destination',
  '5: Name is empty',
  '6: Seats "lots" is not a number',
])
assert.deepEqual(db.destination[0].activities, [{ name: 'Thajiwas Glacier', cost: 500 }, { name: 'Pony ride', cost: 0 }])
console.log('bad rows reported:', r.skipped.length, 'ok')

// 7. Wrong file shape → a clear error, not "imported successfully".
await assert.rejects(imp(Buffer.from('Car Name,Price (INR)\nTempo,5000\n')), /first column must be "Type"/)
await assert.rejects(imp(Buffer.from(xl.CATALOG_COLUMNS.join(',') + '\n')), /no rows to import/)
console.log('wrong file shape rejected: ok')

// 8. Plan limits and DMC partners apply to new rows only.
reset()
db.vehicle.push({ id: nextId++, userId: A, name: 'Innova', price: 3500 })
planLimit = { vehicle: 2 }
r = await imp(csv(['Transport,Innova,,,,,,,,,,,,,,,,,3600', 'Transport,Dzire', 'Transport,Etios']))
assert.deepEqual(r.created.cabs, 1); assert.equal(r.updated.cabs, 1)
assert.match(r.skipped[0].reason, /plan allows up to 2 cabs/)
reset()
db.hotel.push({ id: nextId++, userId: A, name: 'Grand', city: 'Srinagar', phone: '1', priceSections: [] })
r = await imp(csv(['Hotel,Grand,Srinagar,,,2', 'Hotel,New One,Srinagar']), { isDmcBridge: true })
assert.equal(db.hotel[0].phone, '2', 'DMC partners can still update'); assert.equal(db.hotel.length, 1)
assert.match(r.skipped[0].reason, /managed by Via Kashmir/)
console.log('plan limit + DMC block: ok')

// 9. Excel files: the one-table layout as .xlsx, and the old three-sheet workbook.
reset()
const wb = XLSX.read(Buffer.from(xl.templateCsv()).toString('utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
r = await imp(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { fileName: 'catalog.xlsx' })
assert.deepEqual(r.created, { hotels: 2, cabs: 3, destinations: 2 })
reset()
const old = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(old, XLSX.utils.aoa_to_sheet([['Car Name', 'Vehicle Email', 'Vehicle Phone', 'Price (INR)'], ['Sedan', 'd@x.com', 9876543210, 2500]]), 'Transportation')
XLSX.utils.book_append_sheet(old, XLSX.utils.aoa_to_sheet([['Hotel Name', 'City', 'Hotel Email', 'Hotel Phone', 'Price Sections (JSON)'], ['Grand Plaza', 'Srinagar', '', '', '[{"room_type":"deluxe","meal_plan":"room_only","price":4500}]']]), 'Accommodation')
XLSX.utils.book_append_sheet(old, XLSX.utils.aoa_to_sheet([['Destination Name', 'Activities'], ['Gulmarg', 'Gondola (900), Skiing']]), 'Destinations')
r = await imp(XLSX.write(old, { type: 'buffer', bookType: 'xlsx' }), { fileName: 'old.xlsx' })
assert.deepEqual(r.created, { hotels: 1, cabs: 1, destinations: 1 })
assert.equal(db.vehicle[0].price, 2500); assert.equal(db.hotel[0].priceSections[0].price, 4500)
assert.deepEqual(db.destination[0].activities, [{ name: 'Gondola', cost: 900 }, { name: 'Skiing', cost: 0 }])
console.log('xlsx (new + old layout): ok')

console.log('bulk import: all ok')
