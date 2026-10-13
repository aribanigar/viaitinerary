// Ching as a travel agent (utils/ching/brief.js): a client's request → the few
// questions an agent asks → a whole trip planned from the agency's catalog.
//   node frontend/scripts/ching-brief.test.mjs
import assert from 'node:assert/strict'
import { startBrief, briefStep, briefWouldPlan, briefHeard, parseTripRequest, tripBudget, namesATrip, wantsStepByStep } from '../src/utils/ching/brief.js'
import { planLive } from '../src/utils/ching/liveFill.js'
import { readNarrative, isNarrative, soundsLikeAStory } from '../src/utils/ching/narrative.js'
import { understandAssistant } from '../src/utils/ching/assistant.js'
import { toEnglishCommand } from '../src/utils/ching/language.js'

let pass = 0
let fail = 0
function test(name, fn) {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}

const P = (room, bb, map) => [{ room_type: room, price: bb, meal_plan: 'breakfast_only' }, { room_type: room, price: map, meal_plan: 'breakfast_dinner' }]
const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', state: 'Jammu and Kashmir', activities: ['Dal Lake Shikara', 'Mughal Gardens'] },
    { id: 2, name: 'Gulmarg', state: 'Jammu and Kashmir', activities: ['Gondola Phase 1'] },
    { id: 3, name: 'Pahalgam', state: 'Jammu and Kashmir', activities: ['Betaab Valley'] },
    { id: 4, name: 'Sonamarg', state: 'Jammu and Kashmir', activities: ['Thajiwas Glacier'] },
  ],
  hotels: [
    { id: 11, name: 'Hotel Grand Mumtaz', city: 'Srinagar', category: '4', is_available: true, price_sections: P('Deluxe', 5200, 6400) },
    { id: 12, name: 'The Lalit Grand Palace', city: 'Srinagar', category: '5', is_available: true, price_sections: P('Deluxe', 14000, 17000) },
    { id: 13, name: 'Hotel Royal Batoo', city: 'Srinagar', category: '3', is_available: true, price_sections: P('Deluxe', 3200, 4000) },
    // A hotel with the region in its name: "5 nights kashmir" must not book it.
    { id: 14, name: 'Naaz Kashmir Houseboat', city: 'Srinagar', category: '3', is_available: true, price_sections: P('Deluxe', 3500, 4500) },
    { id: 15, name: 'Hotel Highlands Park', city: 'Gulmarg', category: '4', is_available: true, price_sections: P('Deluxe', 9000, 11000) },
    { id: 16, name: 'Khyber Himalayan Resort', city: 'Gulmarg', category: '5', is_available: true, price_sections: P('Deluxe', 24000, 28000) },
    { id: 17, name: 'Hotel Affarwat', city: 'Gulmarg', category: '3', is_available: true, price_sections: P('Deluxe', 4500, 5500) },
    { id: 18, name: 'Heevan Resort', city: 'Pahalgam', category: '4', is_available: true, price_sections: P('Deluxe', 6000, 7500) },
    { id: 19, name: 'Hotel Mount View', city: 'Pahalgam', category: '3', is_available: true, price_sections: P('Deluxe', 3800, 4800) },
    { id: 20, name: 'Hotel Snowland', city: 'Sonamarg', category: '3', is_available: true, price_sections: P('Deluxe', 4200, 5200) },
    { id: 24, name: 'Hotel Glacier Heights', city: 'Sonamarg', category: '4', is_available: true, price_sections: P('Deluxe', 7000, 8500) },
  ],
  vehicles: [
    { id: 21, name: 'Toyota Innova Crysta', price: 4000, rate_type: 'per_day', seating_capacity: 6, is_available: true },
    { id: 22, name: 'Swift Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4, is_available: true },
    { id: 23, name: 'Tempo Traveller', price: 6500, rate_type: 'per_day', seating_capacity: 12, is_available: true },
    { id: 60, name: 'Sunset Shikara', price: 1500, seating_capacity: 4, vehicle_type: 'Shikara', is_available: true },
  ],
  activities: [{ id: 31, name: 'Shikara Ride', destination_id: 1, selling_price: 800 }, { id: 32, name: 'Gondola Phase 1', destination_id: 2, selling_price: 1200 }],
  standard: { inclusions: ['Accommodation on twin sharing', 'Daily breakfast'], exclusions: ['Airfare'] },
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-10-13'
const ctx = { catalog, today, settings }
const blank = () => ({ tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2', template: 'ModernTemplate' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], otherCosts: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true })

// A whole conversation: the request, then the agent's answers. → what Ching
// said each turn and the trip it planned.
function talk(lines) {
  const said = []
  let r = startBrief(toEnglishCommand(lines[0], catalog) || lines[0], ctx)
  const st = r.state
  for (const line of lines.slice(1)) {
    assert.ok(!r.ready, `already planned before "${line}"`)
    said.push(r.say)
    r = briefStep(st, toEnglishCommand(line, catalog) || line, ctx)
  }
  if (!r.ready) return { said: [...said, r.say], ready: false, last: r }
  const plan = planLive(blank(), r.text, { catalog, settings, today })
  const s = plan.snapshot
  return {
    said, ready: true, plan, s, info: s.tripInfo,
    hotels: s.accommodations.map((a) => a.name),
    cities: s.accommodations.map((a) => a.city),
    nights: s.accommodations.map((a) => Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000)),
    cab: [...new Set(s.transportation.map((t) => t.vehicleType || t.name))].join(','),
  }
}

console.log('Ching travel-agent brief tests')

test('a full request is planned at once: route, hotels, days, cab', () => {
  const t = talk(['make a 5 night kashmir itinerary for 2 adults from 10 november'])
  assert.equal(t.ready, true)
  assert.equal(t.info.tripTitle, 'Kashmir 5N/6D')
  assert.equal(t.info.startDate, '2026-11-10')
  assert.deepEqual(t.cities, ['Srinagar', 'Gulmarg', 'Pahalgam'])
  assert.equal(t.nights.reduce((a, b) => a + b, 0), 5)
  assert.equal(t.s.itinerary.length, 6)
  assert.equal(t.s.itinerary[0].title, 'Day 1: Arrival in Srinagar')
  assert.equal(t.s.transportation.length, 6)
  assert.equal(t.cab, 'Swift Dzire')
})

test('the region is the trip, never a hotel with "Kashmir" in its name', () => {
  const c = parseTripRequest('plan a kashmir trip for 4 people for 5 nights', catalog, { today })
  assert.deepEqual(c.stays, [])
  assert.equal(c.nights, 5)
  assert.equal(c.destinationName, 'Kashmir')
})

test('"itinerary for kashmir": Kashmir is the place, not the client', () => {
  const c = parseTripRequest('make an itinerary for kashmir', catalog, { today })
  assert.equal(c.clientName, '')
  assert.equal(c.destinationName, 'Kashmir')
  assert.equal(understandAssistant('make an itinerary for kashmir', { inBuilder: false }), null)
  // …while fetching a document still is one.
  assert.equal(understandAssistant('download the itinerary for rahul', { inBuilder: false })?.type, 'doc')
})

test('asks only what is missing, in one question, then plans', () => {
  const t = talk(['make an itinerary for kashmir', 'rahul sharma, 4 people, 10 november, 5 nights'])
  assert.match(t.said[0], /client's name, how many nights, how many people are travelling and the date they arrive/)
  assert.equal(t.ready, true)
  assert.equal(t.info.clientName, 'Rahul Sharma')
  assert.equal(t.info.adults, 4)
  assert.equal(t.info.duration, '5')
  assert.equal(t.s.accommodations[0].rooms, '2')
})

test('nothing is assumed: guests and date are asked, not defaulted', () => {
  const r = startBrief('best itinerary for 7 days in kashmir', ctx)
  assert.equal(r.ready, false)
  assert.match(r.say, /how many people are travelling and the date they arrive/)
  const t = talk(['best itinerary for 7 days in kashmir', 'skip', 'couple', 'next friday'])
  assert.equal(t.ready, true)
  assert.equal(t.info.adults, 2)
  assert.equal(t.info.duration, '6')
  assert.equal(t.info.startDate, '2026-10-16')
})

test('a month is not a date: "in december" → which date in December', () => {
  const t = talk(['family of 6 wants to visit srinagar gulmarg and pahalgam for a week in december budget hotels', 'the 20th'])
  assert.match(t.said[0], /which date in December/)
  assert.equal(t.info.startDate, '2026-12-20')
  assert.equal(t.info.tripTitle, 'Kashmir 7N/8D')
  assert.deepEqual(t.hotels, ['Hotel Royal Batoo', 'Hotel Affarwat', 'Hotel Mount View'])
  assert.equal(t.cab, 'Toyota Innova Crysta')
  assert.deepEqual(t.plan.warnings, [])
})

test('the name and the day in one answer: "mr khan 20th"', () => {
  const t = talk(['family of 6 wants to visit srinagar gulmarg and pahalgam for a week in december', 'mr khan 20th'])
  assert.equal(t.ready, true)
  assert.equal(t.info.clientName, 'Khan')
  assert.equal(t.info.startDate, '2026-12-20')
})

test('one class of hotel through the trip; stars and luxury are followed', () => {
  const plain = talk(['kashmir trip 5 nights 2 adults from 10 november'])
  assert.deepEqual(plain.hotels, ['Hotel Royal Batoo', 'Hotel Affarwat', 'Hotel Mount View'])
  const lux = talk(['5 nights kashmir for mr sharma 4 adults starting 10 november luxury hotels'])
  assert.deepEqual(lux.hotels, ['The Lalit Grand Palace', 'Khyber Himalayan Resort', 'Heevan Resort'])
  assert.equal(lux.info.clientName, 'Sharma')
  const four = talk(['kashmir tour 4 nights 5 days 2 adults 1 child 15 november 4 star'])
  assert.deepEqual(four.hotels, ['Hotel Grand Mumtaz', 'Hotel Highlands Park', 'Heevan Resort'])
  assert.equal(four.info.kids5to12, 1)
  // "best itinerary" is not "the best hotels".
  const best = talk(['best itinerary for 5 nights in kashmir 2 adults from 10 november'])
  assert.deepEqual(best.hotels, plain.hotels)
})

test('a route Ching plans starts at the airport town', () => {
  const t = talk(['suggest a 3 night trip to gulmarg and srinagar', '2', 'tomorrow'])
  assert.deepEqual(t.cities, ['Srinagar', 'Gulmarg'])
  assert.equal(t.info.tripTitle, 'Kashmir 3N/4D')
  assert.equal(t.info.adults, 2)
})

test('a budget for the whole trip caps the room rate', () => {
  assert.equal(tripBudget('kashmir package under 50000 for 2 people 4 nights').total, 50000)
  assert.equal(tripBudget('30k per person', 4).total, 120000)
  assert.equal(tripBudget('budget is 1.5 lakh').total, 150000)
  assert.equal(tripBudget('hotels under 6000'), null) // a room rate, read by hotelPreference
  const t = talk(['kashmir package under 50000 for 2 people 4 nights', 'from 5 december'])
  assert.ok(t.s.accommodations.every((a) => a.pricePerRoom <= 7700))
  assert.ok(t.plan.changes.some((c) => /^Budget ₹50,000/.test(c)))
})

test('Hinglish request', () => {
  const t = talk(['ek kashmir trip banao 4 raat 2 log 10 november se'])
  assert.equal(t.ready, true)
  assert.equal(t.info.duration, '4')
  assert.equal(t.info.startDate, '2026-11-10')
})

test('"create a trip" with nothing said: everything is asked, an aside is not an answer', () => {
  const r = startBrief('create a trip', ctx)
  assert.match(r.say, /where they want to go, how many nights, how many people are travelling and the date they arrive/)
  const st = r.state
  assert.equal(briefStep(st, 'kashmir', ctx).handled, true)
  assert.equal(briefStep(st, '4 nights', ctx).handled, true)
  const aside = briefStep(st, "what's pending", ctx)
  assert.equal(aside.handled, false)
  const kids = briefStep(st, '2 adults and 2 kids', ctx)
  assert.match(kids.say, /2 adults and 2 children — got it\. From which date\?/)
  const done = briefStep(st, '1 december', ctx)
  assert.equal(done.ready, true)
  const s = planLive(blank(), done.text, { catalog, settings, today }).snapshot
  assert.equal(s.tripInfo.kids5to12, 2)
  assert.equal(s.accommodations.length, 3)
})

test('the mic can stop the moment the last piece is said; what was caught shows live', () => {
  const r = startBrief('plan a kashmir trip for 4 people for 5 nights', ctx)
  const before = JSON.stringify(r.state)
  assert.equal(briefWouldPlan(r.state, 'mr khan', ctx), false)
  assert.equal(briefWouldPlan(r.state, '10 november', ctx), true)
  assert.equal(JSON.stringify(r.state), before) // a dry run keeps nothing
  const h = briefHeard(null, 'there will be 3 adults and 4 kids and they will be travelling to kashmir on 17th of october for 4 nights 5 days', ctx)
  assert.deepEqual(h.lines, ['Destination: Kashmir', '4 nights / 5 days', 'Guests: 3 adults, 4 kids', 'From 17 Oct 2026'])
  assert.deepEqual(h.need, [])
  assert.deepEqual(briefHeard(r.state, '10 november', ctx).lines.slice(-1), ['From 10 Nov 2026'])
})

// A real client's WhatsApp voice note (13 Oct 2026), as a speech engine wrote it.
const VOICE_NOTE = "Hi, so I'm planning to be in Kashmir from the 26th of November until the 30th of November. At 26th, 3 p.m. is the landing time and then 30th morning from Srinagar Railway Station is the departure time. I want to stay for 2 days in Gulmarg and one day in Sonmarg, so 26th once we reach the hotel in Srinagar, maybe Dal Lake and whatever we can see in the evening, maybe that. And then next day, 27th, go to Gulmarg, I don't know, see places in Gulmarg, do the gondola on the 27th or on the 28th. Check out from Gulmarg on the 29th, go to Sonmarg, see whatever we can in Sonmarg and then check out on the 30th from Sonmarg and go to the railway station. We are four people and one infant. We are also okay if we have one room to accommodate all four of us because it's just my parents and my sister and my baby, so an infant is 18 months. So yeah, the hotels should be decent, nothing very high-fi or something, but very decent clean. If there are good views like the Riverside or something, then of course also that because I saw there are quite a few options with three stars and four stars with good views as well, so that would be great and yeah, just let me know."

test('a client\'s voice note: the story is read for its facts and planned as said', () => {
  assert.equal(isNarrative(VOICE_NOTE), true)
  const story = readNarrative(VOICE_NOTE, catalog, { today })
  assert.equal(story.text, 'kashmir trip, 4 adults 1 infant, starting 26 november 2026, 4 nights, 1 night in srinagar, 2 nights in gulmarg, 1 night in sonamarg, 1 room, 2 extra beds, 3 star, add gondola phase 1 on day 3')
  assert.equal(story.arrivalTime, '3 PM')
  assert.equal(story.departFrom, 'Srinagar Railway Station')

  const b = startBrief(VOICE_NOTE, ctx)
  assert.equal(b.ready, true) // nothing to ask: plan it
  const plan = planLive(blank(), b.text, { catalog, settings, today })
  const s = plan.snapshot
  assert.equal(s.tripInfo.clientName, '') // "landing time" is not a client
  assert.equal(s.tripInfo.adults, 4)
  assert.equal(s.tripInfo.kidsUpto5, 1)
  assert.equal(s.tripInfo.startDate, '2026-11-26')
  assert.equal(s.tripInfo.duration, '4')
  assert.deepEqual(s.accommodations.map((a) => [a.city, a.checkIn, a.checkOut, a.rooms, a.extraBedsAbove12Count, a.category]), [
    ['Srinagar', '2026-11-26', '2026-11-27', '1', '2', '3 Star'],
    ['Gulmarg', '2026-11-27', '2026-11-29', '1', '2', '3 Star'],
    ['Sonamarg', '2026-11-29', '2026-11-30', '1', '2', '3 Star'],
  ])
  assert.deepEqual(s.itinerary.map((d) => d.title), [
    'Day 1: Arrival in Srinagar', 'Day 2: Srinagar to Gulmarg', 'Day 3: Gulmarg Sightseeing', 'Day 4: Gulmarg to Sonamarg',
    'Day 5: Sonamarg to Srinagar Railway Station (Departure)',
  ])
  assert.equal(s.itinerary[0].activities[0], 'Arrival at 3 PM, transfer to the hotel')
  assert.equal(s.transportation[s.transportation.length - 1].route, 'Sonamarg → Srinagar Railway Station')
  // The gondola: on the day spent wholly in Gulmarg (the 28th), not the day they drive in.
  assert.deepEqual(s.tripActivities.map((a) => [a.name, a.dayNumber]), [['Gondola Phase 1', 3]])
  for (const line of ['1 room for all 4, with 2 extra beds — as the client asked', 'Client asked for 3 or 4 star: quoted 3 star', 'Leaves from Srinagar Railway Station']) {
    assert.ok(plan.changes.includes(line), line)
  }
})

test('a story is a story; an agent\'s request is not', () => {
  assert.equal(soundsLikeAStory("Hi, so I'm planning to be in Kashmir from the 26th"), true)
  assert.equal(soundsLikeAStory('make gulmarg 2 nights'), false)
  for (const t of ['plan a kashmir trip for 4 people for 5 nights budget hotels', '5 day 4 night itinerary for Rahul Sharma 4 adults starting 10 November 2 nights in lalit grand palace 1 night in khyber and 1 night in heevan with innova', 'open the ledger']) {
    assert.equal(isNarrative(t), false, t)
    assert.equal(readNarrative(t, catalog, { today }), null)
  }
  // "nothing very fancy" is not a wish for luxury; "we are a couple" is 2 adults.
  const r = readNarrative("hello we are a couple and we're planning a honeymoon in kashmir from 5th december to 9th december, we want 2 nights in pahalgam, nothing very fancy but not cheap either, i want a nice clean place", catalog, { today })
  assert.equal(r.text, 'kashmir trip, 2 adults, starting 5 december 2026, 4 nights, 2 nights in pahalgam')
})

test('cancel drops the request', () => {
  const r = startBrief('new trip', ctx)
  assert.equal(briefStep(r.state, 'cancel', ctx).cancelled, true)
})

test('a dictated spec still means exactly what was said', () => {
  const t = talk(['5 day 4 night itinerary for Rahul Sharma 4 adults starting 10 November 2 nights in lalit grand palace 1 night in khyber and 1 night in heevan with innova'])
  assert.equal(t.ready, true)
  assert.deepEqual(t.hotels, ['The Lalit Grand Palace', 'Khyber Himalayan Resort', 'Heevan Resort'])
  assert.deepEqual(t.nights, [2, 1, 1])
  assert.equal(t.cab, 'Toyota Innova Crysta')
})

test('what counts as a trip request, and the step-by-step interview on request', () => {
  assert.equal(namesATrip('kashmir trip for 4 people', catalog), true)
  assert.equal(namesATrip('they want to visit gulmarg in january', catalog), true)
  assert.equal(namesATrip('open the ledger', catalog), false)
  assert.equal(namesATrip('family of 6 wants to visit srinagar gulmarg and pahalgam for a week in december', catalog), true)
  // Work on a trip is not a new trip.
  assert.equal(namesATrip('add a day trip to sonamarg', catalog), false)
  assert.equal(namesATrip('change the gulmarg hotel for this trip', catalog), false)
  assert.equal(namesATrip('find unpaid trips to gulmarg in october', catalog), false)
  assert.equal(wantsStepByStep('create a trip step by step'), true)
  assert.equal(wantsStepByStep('create a kashmir trip'), false)
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
