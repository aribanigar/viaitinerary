// Hearing the agent right: spoken names, sound-alike hotels, the recognizer's
// alternatives, hotels named inside a day-by-day route, and the questions the
// Trip Draft asks back (day trip or transfer? which hotel?).
//   node frontend/scripts/ching-hearing.test.mjs
import assert from 'node:assert/strict'
import { cleanSpokenName } from '../src/utils/ching/names.js'
import { soundKey } from '../src/utils/ching/fuzzy.js'
import { vocabularyFrom, pickAlternative } from '../src/utils/ching/vocabulary.js'
import { parseChingCommand } from '../src/utils/ching/parseCommand.js'
import { planLive } from '../src/utils/ching/liveFill.js'
import { buildTripDraft } from '../src/utils/ching/tripDraft.js'
import { repairSpeech } from '../src/utils/ching/repair.js'

let pass = 0
let fail = 0
const test = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}

const P = (id, name, city, category, price) => ({ id, name, city, category, price_sections: [{ room_type: 'Deluxe', price }] })
const catalog = {
  hotels: [
    P(4, 'The Lalit Grand Palace', 'Srinagar', '5', 12000), P(8, 'Jarman Residency', 'Srinagar', '3', 4000),
    P(5, 'Khyber Himalayan Resort & Spa', 'Gulmarg', '5', 15000), P(11, 'Hotel Khaleel Palace', 'Gulmarg', '4', 6000),
    P(9, 'Hotel Heevan', 'Pahalgam', '4', 6000),
  ],
  destinations: [{ id: 11, name: 'Kashmir' }, { id: 12, name: 'Srinagar' }, { id: 13, name: 'Gulmarg' }, { id: 14, name: 'Pahalgam' }],
  vehicles: [{ id: 21, name: 'Innova Crysta', rate_type: 'per_day', seating_capacity: 6, price: 4000 }],
  activities: [],
}
const today = new Date(2026, 9, 7)
const parse = (t) => parseChingCommand(t, catalog, { today })
const blank = { tripInfo: { adults: 2 }, itinerary: [], accommodations: [], transportation: [], tripActivities: [] }
const fill = (t) => planLive(blank, t, { catalog, today })
const blocking = (snap, meta) => buildTripDraft(snap, meta).blocking.map((c) => c.text)

console.log('Ching hearing tests')

// ---- Client names: fillers, titles and self-corrections ----
for (const [said, name] of [
  ['create an itinerary for the customer Shah 3 nights', 'Shah'],
  ['client Atif Aslam client 3 nights in srinagar', 'Atif Aslam'],
  ['itinerary for the customer Shah not customer 3 nights', 'Shah'],
  ['itinerary for my client mister Atif Aslam ji 3 nights', 'Atif Aslam'],
  ['itinerary for client Atif Aslam sahab 3 nights', 'Atif Aslam'],
  ['itinerary for um Atif uh Aslam 3 nights', 'Atif Aslam'],
  ['itinerary for Atif sorry Aamir Khan 3 nights', 'Aamir Khan'],
  ['itinerary for Atif I mean Aamir 3 nights', 'Aamir'],
  ['customer name is Shah no Shah Lone, 3 nights', 'Shah Lone'],
  ['itinerary for the customer okay so the name is Atif Aslam 3 nights', 'Atif Aslam'],
  ['itinerary for Atif Aslam basically 3 nights', 'Atif Aslam'],
]) {
  test(`name: "${said}" → ${name}`, () => assert.equal(parse(said).clientName, name))
}
test('cleanSpokenName: "A not B" keeps A, "A sorry B" keeps B, max 3 words', () => {
  assert.equal(cleanSpokenName('shah not shock line'), 'Shah')
  assert.equal(cleanSpokenName('ravi sorry ravi kumar'), 'Ravi Kumar')
  assert.equal(cleanSpokenName('the customer mohammad ashraf bhat lone'), 'Mohammad Ashraf Bhat')
  assert.equal(cleanSpokenName('the customer'), '')
})

// ---- Sound-alikes and the recognizer's alternatives ----
test('soundKey: misheard spellings sound the same', () => {
  for (const [a, b] of [['german', 'jarman'], ['khaleel', 'khalil'], ['heevan', 'hiwan'], ['khyber', 'kyber'], ['srinagar', 'shrinagar']]) {
    assert.equal(soundKey(a), soundKey(b), `${a} / ${b}`)
  }
})
test('a misheard hotel name still finds the hotel ("german residency" → Jarman Residency)', () => {
  const c = parse('trip for Shah 2 nights in srinagar hotel german residency')
  assert.deepEqual(c.stays.map((s) => s.hotelId), [8])
})
test('pickAlternative: the guess naming the agency\'s hotels wins; otherwise the first', () => {
  const v = vocabularyFrom(catalog)
  assert.equal(pickAlternative(['srinagar hotel german residency', 'srinagar hotel jarman residency'], v), 'srinagar hotel jarman residency')
  assert.equal(pickAlternative(['for mister shah', 'for mister shaw'], v), 'for mister shah')
  assert.equal(pickAlternative(['only one'], v), 'only one')
})

// ---- Hotels named inside a day-by-day route ----
test('hotels said per day are kept (not swapped for auto-picks)', () => {
  const c = parse('trip for Rahul from 10 nov, day 1 arrival in srinagar stay at lalit, day 2 gulmarg hotel khyber, day 3 pahalgam hotel heevan, day 4 departure')
  assert.deepEqual(c.stays.map((s) => [s.nights, s.hotelId]), [[1, 4], [1, 5], [1, 9]])
  assert.deepEqual(c.dayPlan.questions, [])
})
test('a hotel back in the last night\'s city makes that day a day trip', () => {
  const c = parse('trip for Rahul from 10 nov, day 1 arrival srinagar hotel lalit, day 2 gulmarg hotel lalit, day 3 departure')
  assert.deepEqual(c.stays.map((s) => [s.nights, s.hotelId]), [[2, 4]])
  assert.equal(c.dayPlan.days[1].kind, 'excursion')
})
test('"day 4 departure, hotel …": the departure day ends at the comma', () => {
  const c = parse('trip for Rahul from 10 nov, day 1 arrival srinagar, day 2 srinagar, day 3 departure, hotel lalit')
  assert.ok(c.stays.some((s) => s.hotelId === 4), JSON.stringify(c.stays))
})

// ---- Questions back to the agent ----
test('a bare "day 2 Gulmarg" asks: day trip or transfer (once, not for the way back)', () => {
  const c = parse('trip for Rahul from 10 nov, day 1 arrival srinagar, day 2 gulmarg, day 3 srinagar, day 4 departure')
  assert.deepEqual(c.dayPlan.questions, [{ day: 2, city: 'Gulmarg', from: 'Srinagar' }])
  assert.deepEqual(c.dayPlan.days.map((d) => d.title), ['Arrival in Srinagar', 'Srinagar to Gulmarg', 'Gulmarg to Srinagar', 'Departure from Srinagar'])
})
test('two days in the same city is a stay — no question', () => {
  assert.deepEqual(parse('trip for Rahul from 10 nov, day 1 arrival srinagar, day 2 gulmarg, day 3 gulmarg, day 4 departure').dayPlan.questions, [])
})
const routeTrip = 'trip for Shah, phone 9876543210, 2 adults from 10 nov, day 1 arrival srinagar hotel lalit, day 2 gulmarg, day 3 srinagar, day 4 departure'
test('the Trip Draft blocks on the question; "day 2 day trip" answers it (hotel + cab back in Srinagar)', () => {
  const f = fill(routeTrip)
  assert.equal(blocking(f.snapshot, f.draftMeta).length, 1)
  assert.match(blocking(f.snapshot, f.draftMeta)[0], /Day 2 – Gulmarg: a day trip from Srinagar/)
  const e = planLive(f.snapshot, 'day 2 day trip', { catalog, today })
  const meta = { ...f.draftMeta, answeredDays: e.answered.days, answeredHotels: e.answered.hotels }
  assert.deepEqual(blocking(e.snapshot, meta), [])
  assert.deepEqual(e.snapshot.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut]), [[4, '2026-11-10', '2026-11-13']])
  assert.ok(e.snapshot.transportation.some((t) => t.route === 'Srinagar → Gulmarg → Srinagar' && t.tripType === 'Day Trip'))
})
test('"day 2 stay in gulmarg" answers it the other way (a Gulmarg night)', () => {
  const f = fill(routeTrip)
  const e = planLive(f.snapshot, 'day 2 stay in gulmarg', { catalog, today })
  assert.deepEqual(e.answered.days, [2])
  assert.ok(e.snapshot.accommodations.some((a) => a.city === 'Gulmarg'))
})
test('a named hotel that isn\'t in the catalog is asked about, never auto-replaced', () => {
  const f = fill('trip for Shah, phone 9876543210, 2 adults from 10 nov, 2 nights in gulmarg hotel snow peak residency, 1 night srinagar lalit')
  assert.ok(!f.snapshot.accommodations.some((a) => a.city === 'Gulmarg'))
  const q = blocking(f.snapshot, f.draftMeta).find((t) => /I heard the hotel/.test(t))
  assert.match(q, /"Hotel Snow Peak Residency" but it isn't in your hotels in Gulmarg\. Did you mean Khyber Himalayan Resort & Spa or Hotel Khaleel Palace\?/)
  for (const answer of ['gulmarg hotel khyber', 'khyber for gulmarg', 'book khaleel palace in gulmarg']) {
    const e = planLive(f.snapshot, answer, { catalog, today })
    assert.ok(e.snapshot.accommodations.some((a) => a.city === 'Gulmarg' && a.hotelId), answer)
    assert.deepEqual(blocking(e.snapshot, { ...f.draftMeta, answeredHotels: e.answered.hotels }).filter((t) => /I heard/.test(t)), [], answer)
  }
})
test('"5 star" / "budget hotel" are preferences, not hotel names', () => {
  assert.deepEqual(parse('trip for Anil 3 nights srinagar 5 star').unmatchedHotels, [])
  assert.deepEqual(parse('trip for Anil 2 nights gulmarg budget hotel').unmatchedHotels, [])
})
test('a spoken star rating picks by the rating saved on the hotel', () => {
  const f = fill('trip for Shah, phone 9876543210, 2 adults from 10 nov, 2 nights gulmarg 4 star, 1 night srinagar 3 star')
  assert.deepEqual(f.snapshot.accommodations.map((a) => a.hotelId), [11, 8])
})

// ---- Guests: semantic tags (total, "the rest are …", "N of them are kids", ages) ----
for (const [said, want] of [
  ['build an itinerary for a family of four where three are adults and the rest are kids', [3, 1, 0]],
  ['itinerary for family of four, three adults and rest kids', [3, 1, 0]],
  ['6 people out of which 2 are kids', [4, 2, 0]],
  ['group of 10, 8 adults rest children', [8, 2, 0]],
  ['5 members, 2 of them kids', [3, 2, 0]],
  ['3 adults and 2 kids one of them is 3 years old', [3, 1, 1]],
  ['husband wife and one child of 4 years', [2, 0, 1]],
  ['family of four all adults', [4, 0, 0]],
  ['couple with 2 kids aged 8 and 3', [2, 1, 1]],
]) {
  test(`guests: "${said}" → ${want.join('/')}`, () => {
    const c = parse(`${said} 3 nights in srinagar`)
    assert.deepEqual([c.adults, c.children, c.infants], want)
  })
}

// ---- Taking things back while speaking ----
for (const [said, want] of [
  ['trip for Rahul 3 nights in srinagar, no wait, 4 nights', 'trip for Rahul 4 nights in srinagar'],
  ['trip for Rahul starting 10 november sorry 12 november 2 adults', 'trip for Rahul starting 12 november 2 adults'],
  ['trip for Rahul, no, for Amit, 3 nights', 'trip for Amit, 3 nights'],
  ['2 nights in gulmarg hotel lalit actually hotel khyber', '2 nights in gulmarg hotel khyber'],
  ['trip for Kiran 2 adults 3 nights no sorry 4 nights from 1st december', 'trip for Kiran 2 adults 4 nights from 1st december'],
  ['trip for Rahul 3 nights scratch that trip for Amit 2 nights in gulmarg', 'trip for Amit 2 nights in gulmarg'],
  ['trip for Rahul 3 nights no meals', 'trip for Rahul 3 nights no meals'],
  ['trip for Rahul with no breakfast', 'trip for Rahul with no breakfast'],
]) {
  test(`repair: "${said}"`, () => assert.equal(repairSpeech(said).text, want))
}
test('"… no stop", "cancel", "never mind" apply nothing', () => {
  for (const t of ['trip for Rahul 3 nights in srinagar no stop', 'make gulmarg 2 nights cancel', 'add shikara ride never mind']) {
    assert.equal(repairSpeech(t).cancelled, true, t)
  }
  const r = planLive(blank, 'trip for Rahul 3 nights in srinagar no stop', { catalog, today })
  assert.equal(r.cancelled, true)
  assert.deepEqual(r.snapshot, blank)
})
test('"the name is different, it is Amit Shah" swaps the name; without a new name Ching asks', () => {
  assert.equal(parse(repairSpeech('trip for Rahul, okay the name is different, it is Amit Shah, 3 nights').text).clientName, 'Amit Shah')
  const r = planLive(blank, 'trip for Rahul the name is wrong 3 nights in srinagar', { catalog, today })
  assert.match(r.warnings[0], /What's the client's name\?/)
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
