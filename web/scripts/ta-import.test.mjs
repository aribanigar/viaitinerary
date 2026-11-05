// Account import from viakashmiritinerary.in against a fake travel-agency API
// and an in-memory Prisma:   node web/scripts/ta-import.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'

const prisma = (await import('../lib/prisma.js')).default
const imp = await import('../lib/travelAgencyImport.js')

// ── in-memory tables ────────────────────────────────────────────────────────
const db = { importLink: [], destination: [], hotel: [], vehicle: [], user: [], leadInquiry: [], trip: [], itinerary: [], accommodation: [], transportation: [], tripActivity: [], agencySetting: [], policy: [], platformSetting: [] }
let nextId = 1000
const match = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return v.some((w) => match(row, w))
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(row[k])
      if ('notIn' in v) return !v.notIn.includes(row[k])
      if ('not' in v) return row[k] !== v.not
      if (k === 'membershipTeam') return false
      return true
    }
    return row[k] === v
  })
const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row)
for (const name of Object.keys(db)) {
  const t = db[name]
  Object.assign(prisma[name], {
    findMany: async ({ where, select } = {}) => t.filter((r) => match(r, where)).map((r) => pick(r, select)),
    findUnique: async ({ where, select }) => { const r = t.find((x) => match(x, where)); return r ? pick(r, select) : null },
    findFirst: async ({ where }) => t.find((x) => match(x, where)) || null,
    count: async ({ where } = {}) => t.filter((r) => match(r, where)).length,
    create: async ({ data }) => { const r = { id: nextId++, ...data }; t.push(r); return r },
    update: async ({ where, data }) => { const r = t.find((x) => match(x, where)); Object.assign(r, data); return r },
    delete: async ({ where }) => { const i = t.findIndex((x) => match(x, where)); const [r] = t.splice(i, 1); return r },
    deleteMany: async ({ where }) => { const keep = t.filter((r) => !match(r, where)); const n = t.length - keep.length; t.length = 0; t.push(...keep); return { count: n } },
  })
}
prisma.importLink.upsert = async ({ where, create, update }) => {
  const r = db.importLink.find((x) => match(x, where.import_link))
  if (r) return Object.assign(r, update)
  return prisma.importLink.create({ data: create })
}

// ── fake travel-agency API ──────────────────────────────────────────────────
const tripFull = {
  id: 5, trip_id: 'TRP111111', trip_title: 'Kashmir 4N/5D', destination: 'Kashmir', destination_id: 71,
  client_name: 'Rahul', client_phone: '+919800000000', client_email: 'r@x.com', adults: 2, kids_cnb: 1, kids_5_to_12: 0,
  start_date: '10-12-2026', duration: '4', cost: '52000.00', gst_amount: '0.00', gst_percentage: '5.00', profit_margin_percentage: '10.00',
  paid_amount: '15000.00', refunded_amount: '0.00', currency: 'INR (₹)', image_path: 'trips/hero.jpg', image_url: null, status: 'confirmed',
  template: 'ClassicTemplate', inclusions: [{ content: 'Breakfast' }], exclusions: [{ content: 'Flights' }], include_gst: 1, use_flight: 0,
  other_costs: [], transport_details: [], created_at: '2026-03-01T10:00:00.000000Z',
  itineraries: [
    { id: 2, trip_id: 5, day_number: 2, title: 'Gulmarg', location: 'Gulmarg', description: 'Gondola', image_path: null, image_url: 'https://cdn.example/g.jpg' },
    { id: 1, trip_id: 5, day_number: 1, title: 'Arrival', location: 'Srinagar', description: 'Shikara', image_path: null },
  ],
  accommodations: [{ id: 9, trip_id: 5, hotel_id: 81, name: 'Grand Mumtaz', city: 'Srinagar', rooms: '1', room_type: 'Deluxe', meal_plan: 'MAP', check_in: '10-12-2026', check_out: '12-12-2026', price_per_room: '5000.00', bed_prices: '[]', premium_option: { hotel_id: 82 }, hotel: { id: 81, name: 'Grand Mumtaz', city: 'Srinagar' } }],
  transportations: [{ id: 3, trip_id: 5, vehicle_id: 91, trip_type: 'Transfer', route: 'Airport → Hotel', date: '10-12-2026', vehicle_type: 'Dzire', quantity: 1, vehicle: { id: 91, name: 'Dzire' } }],
  destination_ref: { id: 71, name: 'Kashmir' },
}
const api = {
  'POST /login': (b) => (b.password === 'right' ? { access_token: 'tok', user: { email: 'Owner@Agency.com', role: 'admin', name: 'Owner' } } : [401, { message: 'Invalid login details' }]),
  'POST /logout': () => ({ message: 'ok' }),
  'GET /builder/init': () => ({
    settings: { agency_name: 'Snow Trails', contact_phone: '+91 90000 00000', brand_color: '#123456', gst_percentage: '5.00', smtp_email: 'a@b.c', logo_path: 'logos/l.png', logo_url: null },
    policies: { terms_conditions: 'Pay one week before\nNo refunds', must_haves: '', default_inclusions: ['Breakfast'], default_exclusions: [] },
  }),
  'GET /destinations': () => ({ data: [{ id: 71, name: 'Kashmir', activities: '["Shikara"]', image_path: null }, { id: 72, name: 'Ladakh', activities: [], image_path: null }], total: 2, last_page: 1 }),
  'GET /hotels': () => ({ data: [{ id: 81, name: 'Grand Mumtaz', city: 'Srinagar', price_sections: '[{"room_type":"Deluxe","price":5000}]', image_path: 'hotels/gm.jpg' }, { id: 82, name: 'Heevan', city: 'Pahalgam', price_sections: [] }], total: 2, last_page: 1 }),
  'GET /vehicles': () => ({ data: [{ id: 91, name: 'Dzire', price: '2500.00' }], total: 1, last_page: 1 }),
  'GET /lead-inquiries': () => ({ data: [{ id: 61, inquiry_id: 'INQ000111', client_name: 'Asha', adults: 3, status: 'contacted', start_date: '2026-12-01', created_at: '2026-02-01T00:00:00Z', assignee: null }], total: 1, last_page: 1 }),
  'GET /trips': () => ({ data: [{ id: 5, trip_id: 'TRP111111' }, { id: 6, trip_id: 'TRP222222' }], total: 2, last_page: 1 }),
  'GET /trips/TRP111111': () => tripFull,
  'GET /package-templates': () => ({ data: [{ id: 41, name: 'Honeymoon 5N' }] }),
  'GET /package-templates/41': () => ({
    id: 41, name: 'Honeymoon 5N', nights: 5, destinations: ['Srinagar'], estimated_price: 60000, currency: 'INR (₹)',
    data: { trip: { trip_title: 'Honeymoon 5N', adults: 2, duration: '5' }, itineraries: [{ day_number: 1, title: 'Arrive' }],
      accommodations: [{ hotel_id: 82, name: 'Heevan', city: 'Pahalgam', check_in_offset: 2, nights: 2, room_type: 'Deluxe' }],
      transportations: [{ vehicle_id: 91, trip_type: 'Transfer', day_offset: 0 }], inclusions: [], exclusions: [] },
  }),
}
const calls = []
imp.setFetch(async (url, opts = {}) => {
  const u = new URL(url)
  const path = u.pathname.replace(/^\/api/, '')
  const method = opts.method || 'GET'
  calls.push(`${method} ${path}${u.search}`)
  const h = api[`${method} ${path}`]
  if (!h) return { ok: false, status: 404, headers: new Map(), json: async () => ({ message: 'Not found.' }) }
  if (method !== 'POST' && path !== '/login') assert.equal(opts.headers.Authorization, 'Bearer tok', 'reads carry the session token')
  assert.equal(opts.headers['X-Device-ID'], undefined, 'no device id, so the single-device guard leaves it alone')
  const out = h(opts.body ? JSON.parse(opts.body) : {})
  const [status, body] = Array.isArray(out) ? out : [200, out]
  return { ok: status < 400, status, headers: new Map(), json: async () => body }
})

// ── tenant: admin 7, with one trip and one hotel already here ──────────────
const owner = { id: 7, role: 'admin', email: 'owner@agency.com' }
db.user.push({ id: 7, email: 'owner@agency.com' })
db.trip.push({ id: 1, userId: 7, tripId: 'TRP222222', isPackage: false })
db.hotel.push({ id: 500, userId: 7, name: 'heevan', city: 'pahalgam' })
db.agencySetting.push({ id: 1, userId: 7, agencyName: 'My Agency', contactPhone: null, brandColor: '', gstPercentage: null })

// ── connect: guards ─────────────────────────────────────────────────────────
await assert.rejects(imp.connect({ ...owner, role: 'team' }, { email: owner.email, password: 'right' }), /agency owner/)
await assert.rejects(imp.connect(owner, { email: 'other@x.com', password: 'right' }), /same account/)
await assert.rejects(imp.connect(owner, { email: owner.email, password: 'wrong' }), (e) => e.status === 422 && /didn't work/.test(e.message))
const conn = await imp.connect(owner, { email: 'OWNER@agency.com', password: 'right' })
assert.equal(conn.counts.trips, 2)
assert.equal(conn.counts.packages, 1)
assert.ok(!conn.handle.includes('tok'), 'token is sealed')
const session = imp.openHandle(conn.handle, 7)
assert.equal(session.t, 'tok')
assert.equal(imp.openHandle(conn.handle, 8), null, 'handle is bound to the user')
assert.equal(imp.openHandle(conn.handle, 7, Date.now() + 3 * 3600e3), null, 'handle expires')
assert.equal(imp.openHandle('garbage', 7), null)

// ── run every step ──────────────────────────────────────────────────────────
const runAll = async () => {
  const out = {}
  for (const step of imp.STEPS) {
    let page = 1
    while (page) {
      const r = await imp.runStep({ session, adminId: 7, step, page })
      out[step] = r
      assert.deepEqual(r.errors, [], `${step}: ${r.errors.join('; ')}`)
      page = r.next
    }
  }
  return out
}
const first = await runAll()

// settings: only empty fields filled
const s = db.agencySetting[0]
assert.equal(s.agencyName, 'My Agency', 'own value kept')
assert.equal(s.contactPhone, '+91 90000 00000')
assert.equal(s.brandColor, '#123456', 'empty string counts as empty')
assert.equal(s.gstPercentage, 5)
assert.equal(s.logoPath, 'https://viakashmiritinerary.in/api/storage/logos/l.png', 'no storage configured → absolute URL kept')
assert.ok(first.settings.notes.some((n) => /app password/.test(n)))
const pol = db.policy[0]
assert.deepEqual(pol.termsConditions, ['Pay one week before', 'No refunds'])
assert.equal(pol.mustHaves, undefined, 'nothing to copy → left alone')

// catalog
assert.equal(first.destinations.stats.created, 2)
assert.deepEqual(db.destination.find((d) => d.name === 'Kashmir').activities, ['Shikara'])
assert.equal(first.hotels.stats.created, 1)
assert.equal(first.hotels.stats.linked, 1, 'Heevan matched by name + city')
assert.deepEqual(db.hotel.find((h) => h.name === 'Grand Mumtaz').priceSections, [{ room_type: 'Deluxe', price: 5000 }])
assert.equal(first.vehicles.stats.created, 1)

// leads
const lead = db.leadInquiry[0]
assert.equal(lead.inquiryId, 'INQ000111')
assert.equal(lead.userId, 7)
assert.equal(lead.status, 'contacted')
assert.equal(lead.createdAt.toISOString().slice(0, 10), '2026-02-01')

// trips
assert.equal(first.trips.stats.created, 1)
assert.equal(first.trips.stats.linked, 1, 'TRP222222 already here → linked, not re-copied')
assert.ok(!calls.includes('GET /trips/TRP222222'), 'existing trip is not even fetched')
const trip = db.trip.find((t) => t.tripId === 'TRP111111')
assert.equal(trip.userId, 7)
assert.equal(trip.teamId, null)
assert.equal(trip.status, 'confirmed')
assert.equal(trip.paidAmount, 15000)
assert.equal(trip.kidsCnb, 1)
assert.equal(trip.startDate.toISOString().slice(0, 10), '2026-12-10', 'd-m-Y date read right')
assert.equal(trip.createdAt.toISOString().slice(0, 10), '2026-03-01')
assert.equal(trip.destinationId, db.destination.find((d) => d.name === 'Kashmir').id)
assert.equal(trip.imagePath, 'https://viakashmiritinerary.in/api/storage/trips/hero.jpg')
const days = db.itinerary.filter((i) => i.tripId === trip.id)
assert.deepEqual(days.map((d) => d.dayNumber), [1, 2], 'days in order')
assert.equal(days[1].imagePath, 'https://cdn.example/g.jpg')
const stay = db.accommodation.find((a) => a.tripId === trip.id)
assert.equal(stay.hotelId, db.hotel.find((h) => h.name === 'Grand Mumtaz').id, 'hotel id remapped to the copy here')
assert.equal(stay.checkOut.toISOString().slice(0, 10), '2026-12-12')
assert.notEqual(stay.id, 9, 'source ids never reused')
const cab = db.transportation.find((t) => t.tripId === trip.id)
assert.equal(cab.vehicleId, db.vehicle.find((v) => v.name === 'Dzire').id)

// packages: dates laid out from today
const pkg = db.trip.find((t) => t.isPackage)
assert.match(pkg.tripId, /^PKG\d{6}$/)
assert.equal(pkg.tripTitle, 'Honeymoon 5N')
const pStay = db.accommodation.find((a) => a.tripId === pkg.id)
assert.equal(pStay.hotelId, 500, 'package hotel → the Heevan that was already here')
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
assert.equal((pStay.checkIn - today) / 864e5, 2)
assert.equal((pStay.checkOut - pStay.checkIn) / 864e5, 2)

// ── run again: nothing new ──────────────────────────────────────────────────
const counts = Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.length]))
const second = await runAll()
for (const step of ['destinations', 'hotels', 'vehicles', 'leads', 'trips', 'packages']) {
  assert.equal(second[step].stats.created, 0, `${step}: nothing copied twice`)
}
for (const [k, n] of Object.entries(counts)) assert.equal(db[k].length, n, `${k} unchanged on re-run`)

// ── itinerary limit stops the trip step ─────────────────────────────────────
const keepOnly = (arr, fn) => { const kept = arr.filter(fn); arr.length = 0; arr.push(...kept) }
keepOnly(db.importLink, (l) => l.kind !== 'trip')
keepOnly(db.trip, (t) => t.tripId !== 'TRP111111' && t.tripId !== 'TRP222222')
db.platformSetting.push({ key: 'itinerary_hard_limit', value: '1' }, { key: 'itinerary_soft_limit', value: '1' })
db.trip.push({ id: 2, userId: 7, tripId: 'TRP000001', isPackage: false })
const limited = await imp.runStep({ session, adminId: 7, step: 'trips', page: 1 })
assert.equal(limited.stats.created, 0)
assert.equal(limited.next, null)
assert.ok(limited.notes.some((n) => /limit of 1 itineraries/.test(n)))

// ── a failed child write leaves no half trip ────────────────────────────────
db.platformSetting.length = 0
const realCreate = prisma.accommodation.create
prisma.accommodation.create = async () => { throw new Error('boom') }
const broken = await imp.runStep({ session, adminId: 7, step: 'trips', page: 1 })
prisma.accommodation.create = realCreate
assert.ok(broken.errors.includes('Trip TRP111111: boom'), broken.errors.join('; '))
assert.ok(!db.trip.some((t) => t.tripId === 'TRP111111'), 'partly written trip removed')

// ── session ended on the other side ─────────────────────────────────────────
api['GET /hotels'] = () => [401, { message: 'Session expired. Please login again.' }]
await assert.rejects(imp.runStep({ session, adminId: 7, step: 'hotels', page: 1 }), (e) => e.status === 409 && /Connect again/.test(e.message))

// pure helpers
assert.equal(imp.imageUrlOf(null, '/storage/a/b.jpg'), 'https://viakashmiritinerary.in/api/storage/a/b.jpg')
assert.equal(imp.imageUrlOf('https://x/y.png', 'z'), 'https://x/y.png')
assert.equal(imp.imageUrlOf(null, null), null)

console.log('ta-import: all checks passed')
