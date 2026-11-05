// Lead-source integrations + demo requests + site content, against fakes:
//   node web/scripts/integrations.test.mjs
import { register } from 'node:module'
register('./alias-loader.mjs', import.meta.url)
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const prisma = (await import('../lib/prisma.js')).default
const ig = await import('../lib/integrations.js')
const demo = await import('../lib/demoRequests.js')
const site = await import('../lib/siteContent.js')

// ── fake tables ─────────────────────────────────────────────────────────────
const db = { leadInquiry: [], notification: [], integration: [], user: [{ id: 7, role: 'admin' }] }
let nextId = 1
const match = (r, w = {}) => Object.entries(w).every(([k, v]) => (k === 'settings' && v?.path ? r.settings?.[v.path[0]] === v.equals : r[k] === v))
for (const name of Object.keys(db)) {
  const t = db[name]
  Object.assign(prisma[name], {
    findFirst: async ({ where }) => t.find((r) => match(r, where)) || null,
    findUnique: async ({ where }) => t.find((r) => match(r, where.user_platform || where)) || null,
    findMany: async ({ where } = {}) => t.filter((r) => match(r, where)),
    create: async ({ data }) => { const r = { id: nextId++, ...data }; t.push(r); return r },
    upsert: async ({ where, create, update }) => { const r = t.find((x) => match(x, where.user_platform)); if (r) return Object.assign(r, update); const n = { id: nextId++, ...create }; t.push(n); return n },
  })
}

// ── OAuth state ─────────────────────────────────────────────────────────────
const state = ig.buildState(7)
assert.equal(ig.userIdFromState(state), 7)
assert.equal(ig.userIdFromState(state, Date.now() + 11 * 60e3), null, 'expires after 10 minutes')
assert.equal(ig.userIdFromState(state.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), null, 'tampered signature')
assert.equal(ig.userIdFromState('nope'), null)

// ── sign-in URLs ────────────────────────────────────────────────────────────
const req = new Request('https://app.test/api/auth/facebook/redirect')
assert.equal(ig.authorizeUrl('facebook', 7, req), null, 'no credentials → not configured')
process.env.FACEBOOK_CLIENT_ID = 'fbid'
process.env.FACEBOOK_CLIENT_SECRET = 'fbsecret'
process.env.META_INCLUDE_PAGES_SCOPES = '1'
const fbUrl = new URL(ig.authorizeUrl('facebook', 7, req))
assert.equal(fbUrl.host, 'www.facebook.com')
assert.equal(fbUrl.searchParams.get('redirect_uri'), 'https://app.test/api/auth/facebook/callback')
assert.equal(fbUrl.searchParams.get('scope'), 'public_profile,pages_show_list,pages_read_engagement')
assert.equal(ig.userIdFromState(fbUrl.searchParams.get('state')), 7)

// ── CSV + sheet URL ─────────────────────────────────────────────────────────
assert.deepEqual(ig.parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n'), [['a', 'b'], ['x, y', 'say "hi"\nthere']])
assert.equal(ig.sheetCsvUrl('https://docs.google.com/spreadsheets/d/AbC_1/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/AbC_1/export?format=csv&gid=42')
assert.equal(ig.sheetCsvUrl('https://docs.google.com/spreadsheets/d/AbC_1/edit'), 'https://docs.google.com/spreadsheets/d/AbC_1/export?format=csv')
assert.throws(() => ig.sheetCsvUrl('https://example.com/x'), /Invalid Google Sheet URL/)
assert.equal(ig.normalizeHeader(' Please share number of adults? '), 'please_share_number_of_adults')
assert.equal(ig.sheetDate('25-12-2026').toISOString().slice(0, 10), '2026-12-25')
assert.equal(ig.sheetDate('2026/12/25').toISOString().slice(0, 10), '2026-12-25')
assert.equal(ig.sheetDate('31-02-2026'), null, 'impossible date')

// ── sheet sync: imports, skips incomplete rows and duplicates ──────────────
const csv = [
  'id,Full Name,Email,Phone Number,Please share number of adults?,Please share number of kids under 5?,When are you planning to travel?,Platform,Destination to visit?',
  'L1,Asha Rao,asha@x.com,+919800000001,2,1,25-12-2026,ig,Gulmarg',
  'L2,No Phone,np@x.com,,2,0,25-12-2026,fb,Pahalgam',
  ',Ravi,ravi@x.com,+919800000002,3,0,2026-12-01,fb,',
].join('\n')
ig.setFetch(async (url) => {
  assert.match(url, /export\?format=csv/)
  return { ok: true, status: 200, text: async () => csv }
})
const integ = { userId: 7, settings: { sheet_url: 'https://docs.google.com/spreadsheets/d/S1/edit' } }
const r1 = await ig.syncMetaSheet(integ)
assert.equal(r1.imported, 2)
assert.equal(r1.skipped, 1)
assert.deepEqual(r1.skipped_rows[0], { reason: 'missing_required_fields', row: 3, missing_fields: ['Contact'] })
const asha = db.leadInquiry.find((l) => l.clientName === 'Asha Rao')
assert.equal(asha.externalId, 'meta_sheet_L1')
assert.equal(asha.adults, 2)
assert.equal(asha.kidsCnb, 1)
assert.equal(asha.source, 'instagram')
assert.equal(asha.destination, 'Gulmarg')
assert.equal(asha.startDate.toISOString().slice(0, 10), '2026-12-25')
assert.equal(db.leadInquiry.find((l) => l.clientName === 'Ravi').destination, 'Social Media Lead')
assert.equal(db.notification.length, 2)
const r2 = await ig.syncMetaSheet(integ)
assert.equal(r2.imported, 0, 'nothing imported twice')
assert.equal(r2.skip_reason_counts.duplicate_lead, 2)

// ── Meta webhook signature + lead save ──────────────────────────────────────
const raw = JSON.stringify({ object: 'page' })
const sig = 'sha256=' + crypto.createHmac('sha256', 'fbsecret').update(raw).digest('hex')
assert.equal(ig.verifyMetaSignature(raw, sig), true)
assert.equal(ig.verifyMetaSignature(raw + ' ', sig), false)
assert.equal(ig.verifyMetaSignature(raw, 'sha256=00'), false)
assert.equal(ig.verifyMetaSignature(raw, null), false)

db.integration.push({ id: 99, userId: 7, platform: 'facebook', accessToken: 'pagetok', settings: { page_id: '555' } })
ig.setFetch(async (url) => {
  assert.match(url, /\/9001\?/)
  assert.match(url, /access_token=pagetok/)
  return { ok: true, status: 200, json: async () => ({ id: '9001', field_data: [{ name: 'full_name', values: ['Meta Person'] }, { name: 'phone_number', values: ['+919811111111'] }] }) }
})
assert.deepEqual((await ig.handleLeadgen({ leadgen_id: '9001', page_id: '000' })).reason, 'no integration for page')
const saved = await ig.handleLeadgen({ leadgen_id: '9001', page_id: '555' })
assert.equal(saved.saved, true)
const metaLead = db.leadInquiry.find((l) => l.fbLeadId === '9001')
assert.equal(metaLead.clientName, 'Meta Person')
assert.equal(metaLead.userId, 7)
assert.match(metaLead.inquiryId, /^ADS[0-9A-F]{12}$/)
assert.equal((await ig.handleLeadgen({ leadgen_id: '9001', page_id: '555' })).reason, 'duplicate')

// ── listing never leaks tokens ──────────────────────────────────────────────
db.integration[0].settings = { page_id: '555', name: 'Owner', sheet_url: 'x' }
const listed = await ig.listIntegrations(7)
assert.deepEqual(listed.facebook.settings, { page_id: '555', sheet_url: 'x' })
assert.ok(!JSON.stringify(listed).includes('pagetok'))

// ── Meta settings validation ────────────────────────────────────────────────
await assert.rejects(ig.saveMetaSettings(7, {}), (e) => e.status === 422 && /Page ID or a Google Sheet/.test(e.message))

// ── demo request form rules ─────────────────────────────────────────────────
const good = { name: 'A', email: 'a@x.com', contact_number: '+91 98000 00000', company_name: 'Co', no_of_employees: '5', agency_type: 'DMC', destinations: 'Kashmir', processes: ['Quotes'], office_location: 'Srinagar', referral_source: 'Google', scheduled_at: '2026-12-01 10:30' }
const ok = demo.parseDemoRequest(good)
assert.ok(ok.data)
assert.equal(ok.data.noOfEmployees, '5')
assert.equal(ok.data.scheduledAt.toISOString().slice(0, 16), '2026-12-01T10:30')
assert.equal(demo.wallClockText(demo.parseWallClock('01-12-2026 19:05')), '01-12-2026 19:05', 'the picked clock time is kept')
assert.equal(demo.parseWallClock('31-02-2026 10:00'), null)
assert.equal(demo.serializeDemoRequest({ ...ok.data, id: 1 }).scheduled_at, '01-12-2026 10:30')
const bad = demo.parseDemoRequest({ ...good, email: 'nope', processes: 'x', no_of_employees: 0 })
assert.deepEqual(Object.keys(bad.errors).sort(), ['email', 'no_of_employees', 'processes'])
assert.equal(demo.serializeDemoRequest({ ...ok.data, id: 1, status: 'pending' }).contact_number, '+91 98000 00000')

// ── showcase body rules ─────────────────────────────────────────────────────
const sc = await site.parseShowcase({ city: 'Srinagar', title: '4N Trip', whatsapp_number: '+919800000000', price: '19999', is_active: true })
assert.deepEqual(sc.data, { city: 'Srinagar', title: '4N Trip', whatsappNumber: '+919800000000', price: 19999, isActive: true })
const scBad = await site.parseShowcase({ city: '', price: 'x' })
assert.deepEqual(Object.keys(scBad.errors).sort(), ['city', 'price', 'title', 'whatsapp_number'])
const scPartial = await site.parseShowcase({ whatsapp_number: '+919800000000', is_active: false }, { partial: true })
assert.deepEqual(scPartial.data, { whatsappNumber: '+919800000000', isActive: false }, 'update keeps unsent fields')
assert.equal((await site.storeLogo(null)).error, 'The logo field is required.')
assert.match((await site.storeLogo(new File([new Uint8Array([1, 2])], 'a.gif', { type: 'image/gif' }))).error, /jpeg, jpg, png, webp/)
assert.match((await site.storeLogo(new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' }))).url, /^data:image\/png;base64,/)

console.log('integrations: all checks passed')
