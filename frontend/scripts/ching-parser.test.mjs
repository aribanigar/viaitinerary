/* global process */
// Plain-Node tests for the Ching rule-based parser.
// Run: node frontend/scripts/ching-parser.test.mjs
import assert from 'node:assert/strict'
import { parseChingCommand, validateChingCommand, stripWakePhrase, hasWakePhrase } from '../src/utils/ching/parseCommand.js'

const catalog = {
  hotels: [
    { id: 1, name: 'Hotel A', city: 'Srinagar', is_available: true },
    { id: 2, name: 'Hotel B', city: 'Gulmarg', is_available: true },
    { id: 3, name: 'Hotel C', city: 'Pahalgam', is_available: true },
    { id: 4, name: 'The Lalit Grand Palace', city: 'Srinagar', is_available: true },
    { id: 5, name: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg', is_available: true },
    { id: 6, name: 'Welcomhotel Pine N Peak', city: 'Pahalgam', is_available: true },
    { id: 7, name: 'Grand Mumtaz Resorts', city: 'Pahalgam', is_available: false },
  ],
  destinations: [
    { id: 11, name: 'Kashmir' },
    { id: 12, name: 'Srinagar' },
    { id: 13, name: 'Gulmarg' },
    { id: 14, name: 'Pahalgam' },
  ],
  vehicles: [
    { id: 21, name: 'Innova Crysta', price: 4500 },
    { id: 22, name: 'Sedan (Dzire)', price: 3000 },
    { id: 23, name: 'Tempo Traveller', price: 7000 },
  ],
}
const today = new Date(2026, 8, 29) // 29 Sep 2026
const parse = (text) => parseChingCommand(text, catalog, { today })
const staysOf = (cmd) => cmd.stays.map((s) => [s.nights, s.hotelId])

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}

console.log('Ching parser tests')

// ---- Full example phrasings ----
test('example 1: 5 day 4 night, Rahul Sharma, 4+2, 10 November 2026, A/B/C', () => {
  const c = parse(
    'create a 5 day 4 night itinerary for Rahul Sharma 4 adults and 2 children starting from 10 November 2026 two nights in Hotel A one night in Hotel B and one night in Hotel C',
  )
  assert.equal(c.intent, 'create_trip')
  assert.equal(c.clientName, 'Rahul Sharma')
  assert.equal(c.adults, 4)
  assert.equal(c.children, 2)
  assert.equal(c.infants, 0)
  assert.equal(c.startDate, '2026-11-10')
  assert.equal(c.nights, 4)
  assert.equal(c.days, 5)
  assert.deepEqual(staysOf(c), [[2, 1], [1, 2], [1, 3]])
  assert.equal(c.stays[0].hotelName, 'Hotel A')
  assert.equal(c.stays[0].city, 'Srinagar')
  assert.equal(c.stays[0].heard, 'hotel a')
  assert.deepEqual(c.warnings, [])
  assert.equal(validateChingCommand(c).ok, true)
})

test("user's template: X-day, Y-night, customer, number of guests, dd/mm/yyyy", () => {
  const c = parse(
    'I want an 5-day, 4-night itinerary for the customer Priya Verma, number of guests 3, starting from date 12/12/2026, 3 nights in hotel a and 1 nights in hotel b',
  )
  assert.equal(c.clientName, 'Priya Verma')
  assert.equal(c.adults, 3)
  assert.equal(c.startDate, '2026-12-12')
  assert.equal(c.nights, 4)
  assert.equal(c.days, 5)
  assert.deepEqual(staysOf(c), [[3, 1], [1, 2]])
})

test('template with day-first date 05/11/2026 (5 Nov, not 11 May)', () => {
  const c = parse('itinerary for customer Amit, number of guests 2, starting from date 05/11/2026, 2 nights in hotel a')
  assert.equal(c.startDate, '2026-11-05')
  assert.equal(c.clientName, 'Amit')
})

test('speech-style, all lowercase, words for numbers', () => {
  const c = parse(
    'hello ching create a five day four night itinerary for the customer anil kapoor two adults and one child starting from tenth of november two nights in srinagar at hotel lalit one night in gulmarg at khyber and one night in pahalgam at pine n peak',
  )
  assert.equal(c.clientName, 'Anil Kapoor')
  assert.equal(c.adults, 2)
  assert.equal(c.children, 1)
  assert.equal(c.startDate, '2026-11-10')
  assert.deepEqual(staysOf(c), [[2, 4], [1, 5], [1, 6]])
})

// ---- Dates ----
const dateOf = (phrase) => parse(`3 nights trip for Ravi starting ${phrase}`).startDate
test('date: dd-mm-yyyy', () => assert.equal(dateOf('15-10-2026'), '2026-10-15'))
test('date: "10 Nov" without year -> next occurrence', () => assert.equal(dateOf('10 nov'), '2026-11-10'))
test('date: month already passed this year rolls to next year', () => assert.equal(dateOf('5 march'), '2027-03-05'))
test('date: "Nov 10 2026"', () => assert.equal(dateOf('Nov 10 2026'), '2026-11-10'))
test('date: "November 10th, 2026"', () => assert.equal(dateOf('November 10th, 2026'), '2026-11-10'))
test('date: "10th of November"', () => assert.equal(dateOf('on 10th of November'), '2026-11-10'))
test('date: "tenth of november" (words)', () => assert.equal(dateOf('from the tenth of november'), '2026-11-10'))
test('date: "twenty first december"', () => assert.equal(dateOf('twenty first december'), '2026-12-21'))
test('date: tomorrow', () => assert.equal(dateOf('tomorrow'), '2026-09-30'))
test('date: day after tomorrow', () => assert.equal(dateOf('day after tomorrow'), '2026-10-01'))
test('date: next friday', () => assert.equal(dateOf('next friday'), '2026-10-02'))
test('date: ISO 2026-12-01', () => assert.equal(dateOf('2026-12-01'), '2026-12-01'))
test('date: 10/11 (no year) day first', () => assert.equal(dateOf('10/11'), '2026-11-10'))
test('date: invalid 31/02/2026 is not accepted', () => assert.equal(dateOf('31/02/2026'), ''))

// ---- Duration ----
test('duration: 4N/5D', () => {
  const c = parse('4N/5D kashmir package for Rahul')
  assert.equal(c.nights, 4)
  assert.equal(c.days, 5)
})
test('duration: "4 nights 5 days"', () => {
  const c = parse('4 nights 5 days for Rahul')
  assert.deepEqual([c.nights, c.days], [4, 5])
})
test('duration: "five days and four nights"', () => {
  const c = parse('five days and four nights trip for Rahul')
  assert.deepEqual([c.nights, c.days], [4, 5])
})
test('duration: only days -> nights = days - 1', () => {
  const c = parse('6 day trip for Rahul')
  assert.deepEqual([c.nights, c.days], [5, 6])
})
test('duration: only nights -> days = nights + 1', () => {
  const c = parse('a 3 night itinerary for Rahul')
  assert.deepEqual([c.nights, c.days], [3, 4])
  assert.equal(c.stays.length, 0)
})
test('duration: from stays only', () => {
  const c = parse('trip for Rahul 2 nights in hotel a and 2 nights in hotel b')
  assert.deepEqual([c.nights, c.days], [4, 5])
})
test('duration: "3 nights kashmir trip" is a length + destination, not a stay', () => {
  const c = parse('3 nights kashmir trip for Rahul')
  assert.equal(c.nights, 3)
  assert.equal(c.stays.length, 0)
  assert.equal(c.destinationId, 11)
})

// ---- Guests ----
const guestsOf = (phrase) => {
  const c = parse(`4 night trip for Rahul ${phrase}`)
  return [c.adults, c.children, c.infants]
}
test('guests: "number of guests 6"', () => assert.deepEqual(guestsOf('number of guests 6'), [6, 0, 0]))
test('guests: "6 guests"', () => assert.deepEqual(guestsOf('with 6 guests'), [6, 0, 0]))
test('guests: "6 people"', () => assert.deepEqual(guestsOf('6 people'), [6, 0, 0]))
test('guests: "6 pax"', () => assert.deepEqual(guestsOf('6 pax'), [6, 0, 0]))
test('guests: "4 adults 2 kids"', () => assert.deepEqual(guestsOf('4 adults 2 kids'), [4, 2, 0]))
test('guests: "2 adults and one child"', () => assert.deepEqual(guestsOf('2 adults and one child'), [2, 1, 0]))
test('guests: "a child below 5" -> infant', () => assert.deepEqual(guestsOf('2 adults and a child below 5'), [2, 0, 1]))
test('guests: "an infant"', () => assert.deepEqual(guestsOf('two adults and an infant'), [2, 0, 1]))
test('guests: nothing heard -> default 2 adults, flagged missing', () => {
  const c = parse('4 night trip for Rahul')
  assert.equal(c.adults, 2)
  assert.ok(c.missing.includes('adults'))
})
test('guests: "family of 5" does not become the client name', () => {
  const c = parse('4 night trip for a family of 5')
  assert.equal(c.adults, 5)
  assert.equal(c.clientName, '')
  assert.ok(c.missing.includes('clientName'))
})

// ---- Client name ----
test('name: "for mr rahul sharma with ..."', () => {
  assert.equal(parse('4 night trip for mr rahul sharma with innova').clientName, 'Rahul Sharma')
})
test('name: "client name is neha gupta"', () => {
  assert.equal(parse('client name is neha gupta 3 night trip').clientName, 'Neha Gupta')
})
test('name: destination after "for" is not a name', () => {
  const c = parse('5 day trip for kashmir for sunil')
  assert.equal(c.clientName, 'Sunil')
  assert.equal(c.destinationName, 'Kashmir')
})

// ---- Stays ----
test('stay: "<hotel> for 2 nights" form', () => {
  const c = parse('trip for Ravi lalit for 2 nights and khyber for 2 nights')
  assert.deepEqual(staysOf(c), [[2, 4], [2, 5]])
  assert.equal(c.clientName, 'Ravi')
})
test('stay: "two nights in Srinagar at Hotel Lalit" then "1 night Gulmarg <hotel>"', () => {
  const c = parse('trip for Ravi two nights in Srinagar at Hotel Lalit then 1 night Gulmarg Khyber Himalayan')
  assert.deepEqual(staysOf(c), [[2, 4], [1, 5]])
  assert.equal(c.stays[0].city, 'Srinagar')
  assert.equal(c.stays[1].city, 'Gulmarg')
})
test('stay: fuzzy name "welcome hotel pine and peak"', () => {
  const c = parse('trip for Ravi 2 nights at welcome hotel pine and peak')
  assert.deepEqual(staysOf(c), [[2, 6]])
})
test('stay: misheard "lalith grand palace"', () => {
  assert.deepEqual(staysOf(parse('trip for Ravi 2 nights in lalith grand palace')), [[2, 4]])
})
test('stay: unknown hotel -> hotelId null + warning', () => {
  const c = parse('trip for Ravi 2 nights in hotel xyz')
  assert.equal(c.stays[0].hotelId, null)
  assert.equal(c.stays[0].hotelName, 'Hotel Xyz')
  assert.ok(c.warnings.some((w) => w.includes('Couldn\'t find "hotel xyz"')), c.warnings.join(' | '))
})
test('stay: city only -> hotelId null, city set, warning', () => {
  const c = parse('trip for Ravi 2 nights in pahalgam')
  assert.equal(c.stays[0].hotelId, null)
  assert.equal(c.stays[0].city, 'Pahalgam')
  assert.ok(c.warnings.some((w) => w.includes('Pahalgam')))
  assert.equal(c.destinationName, 'Pahalgam')
  assert.equal(c.destinationId, 14)
})
test('stay: unavailable hotel is matched but warned', () => {
  const c = parse('trip for Ravi 2 nights at grand mumtaz')
  assert.deepEqual(staysOf(c), [[2, 7]])
  assert.ok(c.warnings.some((w) => w.includes('unavailable')))
})
test('stay: sum mismatch warning', () => {
  const c = parse('4 night trip for Ravi 2 nights in hotel a')
  assert.equal(c.nights, 4)
  assert.ok(c.warnings.some((w) => w.includes('add up to 2')))
})

// ---- Destination / vehicle / meal plan / contact ----
test('destination: named anywhere', () => {
  const c = parse('create a kashmir itinerary for Ravi 2 nights in hotel a')
  assert.equal(c.destinationId, 11)
})
test('destination: falls back to first stay city', () => {
  const c = parse('trip for Ravi 2 nights in hotel b')
  assert.equal(c.destinationId, 13)
  assert.equal(c.destinationName, 'Gulmarg')
})
test('vehicle: innova / sedan / tempo traveller', () => {
  assert.equal(parse('trip for Ravi with innova').vehicleId, 21)
  assert.equal(parse('trip for Ravi by sedan').vehicleId, 22)
  assert.equal(parse('trip for Ravi in a tempo traveler').vehicleId, 23)
  assert.equal(parse('trip for Ravi').vehicleId, null)
})
test('meal plans', () => {
  const mp = (p) => parse(`trip for Ravi ${p}`).mealPlan
  assert.equal(mp('with breakfast'), 'Only Room + Breakfast')
  assert.equal(mp('breakfast only'), 'Only Room + Breakfast')
  assert.equal(mp('on CP'), 'Only Room + Breakfast')
  assert.equal(mp('breakfast and dinner'), 'Breakfast + Dinner')
  assert.equal(mp('MAP plan'), 'Breakfast + Dinner')
  assert.equal(mp('all meals'), 'Breakfast + Lunch + Dinner')
  assert.equal(mp('AP plan'), 'Breakfast + Lunch + Dinner')
  assert.equal(mp('room only'), 'Only Room')
  assert.equal(mp('EP plan'), 'Only Room')
  assert.equal(mp(''), '')
})
test('meal plan does not leak into the hotel name', () => {
  const c = parse('trip for Ravi 2 nights in hotel a with breakfast and dinner')
  assert.deepEqual(staysOf(c), [[2, 1]])
  assert.equal(c.mealPlan, 'Breakfast + Dinner')
})
test('phone and email', () => {
  const c = parse('trip for Ravi Kumar phone 98765 43210 email ravi.k@gmail.com 2 nights in hotel a')
  assert.equal(c.clientPhone, '9876543210')
  assert.equal(c.clientEmail, 'ravi.k@gmail.com')
  assert.equal(c.clientName, 'Ravi Kumar')
  assert.deepEqual(staysOf(c), [[2, 1]])
})
test('spoken email "at the rate ... dot com"', () => {
  assert.equal(parse('trip for Ravi email ravi at the rate gmail dot com').clientEmail, 'ravi@gmail.com')
})

// ---- Wake phrase / intent ----
test('wake phrase stripped (hello ching / hey ching / hello chin / hello jing)', () => {
  for (const w of ['hello ching', 'Hey Ching,', 'hello chin', 'hello jing']) {
    const c = parse(`${w} 3 night trip for Ravi`)
    assert.equal(c.clientName, 'Ravi', w)
    assert.equal(c.nights, 3, w)
  }
  assert.equal(stripWakePhrase('Hello Ching, make a trip').text, 'make a trip')
  assert.equal(hasWakePhrase('blah blah hey ching'), true)
  assert.equal(hasWakePhrase('hello chink create a trip'), true)
  // hands-free needs the greeting: an overheard "chin up" / "Jin said" must not wake Ching
  assert.equal(hasWakePhrase('chin up'), false)
  assert.equal(hasWakePhrase('jin said the hotel is full'), false)
  assert.equal(hasWakePhrase('rub your chin'), false)
})
test('vehicle named right after a hotel is not swallowed into the hotel phrase', () => {
  const c = parse('4 night trip for Ravi from 10 nov 2026 2 nights at lalit grand palace 2 nights at pine n peak innova breakfast and dinner')
  assert.equal(c.vehicleId, 21)
  assert.deepEqual(c.stays.map((s) => s.hotelId).every(Boolean), true)
  assert.ok(!c.stays.some((s) => /innova/.test(s.heard)))
  assert.equal(c.mealPlan, 'Breakfast + Dinner')
})
test('intent unknown when nothing trip-like', () => {
  assert.equal(parse('hello ching what is the weather like').intent, 'unknown')
  assert.equal(parse('hello ching').intent, 'unknown')
  assert.equal(parse('').intent, 'unknown')
})
test('output shape is complete even for empty input / missing catalog', () => {
  const c = parseChingCommand('', undefined, { today })
  for (const k of ['intent', 'transcript', 'clientName', 'clientPhone', 'clientEmail', 'adults', 'children', 'infants',
    'startDate', 'nights', 'days', 'destinationId', 'destinationName', 'stays', 'vehicleId', 'vehicleName', 'mealPlan',
    'missing', 'warnings']) assert.ok(k in c, k)
  assert.deepEqual(c.missing, ['clientName', 'adults', 'startDate', 'nights', 'stays', 'destination', 'vehicle', 'mealPlan'])
})

// ---- Validator ----
const good = () => parse('4 night trip for Rahul 2 adults starting 10 nov 2026 2 nights in hotel a and 2 nights in hotel b')
test('validator: good command is ok', () => {
  const v = validateChingCommand(good())
  assert.equal(v.ok, true, v.problems.join(' | '))
  assert.deepEqual(v.problems, [])
})
test('validator: missing client name blocks', () => {
  const v = validateChingCommand({ ...good(), clientName: '  ' })
  assert.equal(v.ok, false)
  assert.ok(v.problems.some((p) => /client name/i.test(p)))
})
test('validator: adults < 1 blocks', () => {
  assert.equal(validateChingCommand({ ...good(), adults: 0 }).ok, false)
})
test('validator: missing / invalid start date blocks', () => {
  assert.equal(validateChingCommand({ ...good(), startDate: '' }).ok, false)
  assert.equal(validateChingCommand({ ...good(), startDate: '2026-02-30' }).ok, false)
  assert.equal(validateChingCommand({ ...good(), startDate: '10/11/2026' }).ok, false)
})
test('validator: nights < 1 blocks', () => {
  assert.equal(validateChingCommand({ ...good(), nights: 0, stays: [] }).ok, false)
})
test('validator: stay without hotelId blocks', () => {
  const c = good()
  c.stays[1] = { ...c.stays[1], hotelId: null }
  const v = validateChingCommand(c)
  assert.equal(v.ok, false)
  assert.ok(v.problems.some((p) => p.includes('stay 2')))
})
test('validator: stays sum != nights blocks', () => {
  const v = validateChingCommand({ ...good(), nights: 5, days: 6 })
  assert.equal(v.ok, false)
  assert.ok(v.problems.some((p) => p.includes('add up to 4')))
})
test('validator: days != nights + 1 is only a warning', () => {
  const v = validateChingCommand({ ...good(), days: 7 })
  assert.equal(v.ok, true)
  assert.ok(v.warnings.some((w) => w.includes('builder will use 5 days')))
})
test('validator: no stays is only a warning', () => {
  const v = validateChingCommand({ ...good(), stays: [] })
  assert.equal(v.ok, true)
  assert.ok(v.warnings.some((w) => /no hotels/i.test(w)))
})
test('validator: unavailable hotel warns when catalog passed', () => {
  const c = { ...good(), stays: [{ nights: 4, hotelId: 7, hotelName: 'Grand Mumtaz Resorts', city: 'Pahalgam', heard: '' }] }
  const v = validateChingCommand(c, catalog)
  assert.equal(v.ok, true)
  assert.ok(v.warnings.some((w) => w.includes('unavailable')))
})
test('validator: null command', () => {
  assert.equal(validateChingCommand(null).ok, false)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
