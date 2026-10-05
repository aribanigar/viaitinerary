// Ching precision: realistic spoken requests → every field of the Trip Builder
// (Trip Info, Itinerary destinations, hotels, cabs, activities, pricing),
// through the same pipeline as the live mic (stripFillers → planLive).
//   node frontend/scripts/ching-precision.test.mjs
// Add a case here for every phrasing an agent reports Ching getting wrong.
import { planLive } from '../src/utils/ching/liveFill.js'
import { stripFillers } from '../src/utils/ching/speechClean.js'

const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', state: 'Jammu and Kashmir' }, { id: 2, name: 'Gulmarg', state: 'Jammu and Kashmir' },
    { id: 3, name: 'Pahalgam', state: 'Jammu and Kashmir' }, { id: 4, name: 'Sonamarg', state: 'Jammu and Kashmir' },
  ],
  hotels: [
    { id: 11, name: 'Hotel Grand Mumtaz', city: 'Srinagar', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 5200, meal_plan: 'breakfast_only', cnb: 800, upto_5: 1200, above_12: 1800 }, { room_type: 'Deluxe', price: 6400, meal_plan: 'breakfast_dinner' }, { room_type: 'Super Deluxe', price: 7000 }] },
    { id: 12, name: 'The Lalit Grand Palace', city: 'Srinagar City', category: '5', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 9000 }] },
    { id: 13, name: 'Hotel Highlands Park', city: 'Gulmarg', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 7000 }] },
    { id: 14, name: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg', category: '5', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 15000 }] },
    { id: 15, name: 'Heevan Resort', city: 'Pahalgam', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 6000 }] },
    { id: 16, name: 'Hotel Snowland', city: 'Sonamarg', category: '3', is_available: true, price_sections: [{ room_type: 'Standard', price: 3500 }] },
    { id: 17, name: 'Pine Spring Resort', city: 'Pahalgam', category: '3', is_available: true, price_sections: [{ room_type: 'Standard', price: 4000 }] },
  ],
  vehicles: [
    { id: 21, name: 'Toyota Innova Crysta', price: 4000, rate_type: 'per_day', seating_capacity: 6, is_available: true },
    { id: 22, name: 'Swift Dzire', price: 2500, rate_type: 'per_day', seating_capacity: 4, is_available: true },
    { id: 23, name: 'Tempo Traveller 12 Seater', price: 6000, rate_type: 'per_day', seating_capacity: 12, is_available: true },
  ],
  activities: [
    { id: 31, name: 'Gondola Ride Phase 1', destination_id: 2, selling_price: 900, child_price: 600, city: 'Gulmarg', price_sections: [{ option: 'Phase 2', price: 1900, child_price: 1300 }] },
    { id: 32, name: 'Shikara Ride', destination_id: 1, selling_price: 800, city: 'Srinagar', price_sections: [] },
    { id: 33, name: 'Pony Ride', destination_id: 3, selling_price: 1200, city: 'Pahalgam', price_sections: [] },
  ],
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-10-05'
const blank = { tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2', rooms: '' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true }

// A stand-in for the builder's calculators (rooms × nights × rate; cab per day; activities).
const priceOf = (snap) => {
  const nightsOf = (a) => Math.max(1, Math.round((Date.parse(a.checkOut) - Date.parse(a.checkIn)) / 864e5))
  const base = [
    ...snap.accommodations.map((a) => Number(a.pricePerRoom || 0) * Number(a.rooms || 1) * nightsOf(a)),
    ...snap.transportation.map((t) => (catalog.vehicles.find((v) => v.id === t.vehicleId)?.price || 0) * (t.quantity || 1)),
    ...snap.tripActivities.map((a) => Number(a.pricePerTicket || 0) * Number(a.ticketCount || 1) + Number(a.childPrice || 0) * Number(a.childCount || 0)),
  ].reduce((x, y) => x + y, 0)
  const net = base * (1 + snap.profitMarginPercentage / 100)
  const gst = snap.includeGST !== false ? (net * snap.gstPercentage) / 100 : 0
  return { base, flexBase: base, fixedBase: 0, fixedMarked: 0, net, gst, total: net + gst, profit: net - base }
}
const opts = { catalog, settings: { ...settings, priceOf }, today }
const fill = (t) => planLive(blank, stripFillers(t), opts).snapshot
const hotelNights = (s) => s.accommodations.reduce((x, a) => x + Math.round((Date.parse(a.checkOut) - Date.parse(a.checkIn)) / 864e5), 0)
const diff = (pairs) => pairs.filter(([a, e]) => JSON.stringify(a) !== JSON.stringify(e) && String(a) !== String(e)).map(([a, e]) => `got ${JSON.stringify(a)} want ${JSON.stringify(e)}`)
const sanity = (s, bad) => {
  if (s.accommodations.length && hotelNights(s) !== Number(s.tripInfo.duration)) bad.push(`hotel nights ${hotelNights(s)} ≠ ${s.tripInfo.duration}`)
  if (s.itinerary.some((d) => !d.destinationId)) bad.push('day without destination')
  return bad
}

let pass = 0
let fail = 0
const report = (said, bad) => {
  if (bad.length) {
    fail++
    console.log(`  FAIL ${said}\n       ${bad.join('\n       ')}`)
  } else pass++
}

console.log('Ching precision tests')

// ── 1. New trips, field by field ──────────────────────────────────────────
const C1 = [
  // From the browser check: "… on day 3 margin 15 percent" once gave 3% and dropped the activity.
  ['create a trip for Rahul Sharma phone 9876543210 email rahul@gmail.com 2 adults 1 child from 10th november 2 nights in srinagar at grand mumtaz 2 rooms breakfast and dinner then 2 nights gulmarg highlands park with innova add gondola phase 2 on day 3 margin 15 percent',
    { client: 'Rahul Sharma', phone: '+919876543210', email: 'rahul@gmail.com', adults: 2, kids: 1, start: '2026-11-10', nights: 4, hotels: [[11, '2026-11-10', '2026-11-12', '2', 'Breakfast + Dinner', 6400], [13, '2026-11-12', '2026-11-14', '2']], cab: 21, cabDays: 5, acts: [[31, 3, 2, 1, 1900]], margin: 15 }],
  ['create a trip for Rahul Sharma 2 adults from 10th november 2 nights in srinagar at grand mumtaz and 2 nights in gulmarg at highlands park with innova',
    { client: 'Rahul Sharma', adults: 2, start: '2026-11-10', nights: 4, days: ['Srinagar', 'Srinagar', 'Gulmarg', 'Gulmarg', 'Gulmarg'], hotels: [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-14']], cab: 21, cabDays: 5 }],
  ['trip for Mr Khan phone 98765 43210 email khan at gmail dot com 4 adults 2 kids starting 1st december 3 nights at lalit grand palace with tempo traveller',
    { client: 'Khan', phone: '+919876543210', email: 'khan@gmail.com', adults: 4, kids: 2, start: '2026-12-01', nights: 3, hotels: [[12, '2026-12-01', '2026-12-04']], cab: 23, cabDays: 4 }],
  ['make an itinerary for priya 2 adults and 1 infant 5 nights from 20 november srinagar 2 nights gulmarg 1 night pahalgam 2 nights',
    { client: 'Priya', adults: 2, infants: 1, nights: 5, start: '2026-11-20', days: ['Srinagar', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Pahalgam', 'Pahalgam'], hotelCities: ['Srinagar', 'Gulmarg', 'Pahalgam'], cab: 22 }],
  ['new trip for Arif 2 adults 15 november 3 nights srinagar grand mumtaz 2 rooms breakfast and dinner dzire',
    { client: 'Arif', nights: 3, hotels: [[11, '2026-11-15', '2026-11-18', '2', 'Breakfast + Dinner', 6400]], cab: 22 }],
  ['create trip for Sameer 6 adults 25 december 4 nights 2 nights heevan resort 2 nights khyber 3 rooms innova',
    { client: 'Sameer', adults: 6, nights: 4, start: '2026-12-25', hotels: [[15, '2026-12-25', '2026-12-27', '3'], [14, '2026-12-27', '2026-12-29', '3']], cab: 21 }],
  ['trip for Neha 2 adults 12 november 2 nights grand mumtaz with dzire add shikara ride on day 2 and gondola phase 2 on day 3',
    { client: 'Neha', nights: 2, acts: [[32, 2, 2], [31, 3, 2, 0, 1900]] }],
  ['trip for Neha 2 adults 12 november 3 nights srinagar with innova margin 20 percent no gst',
    { client: 'Neha', nights: 3, margin: 20, gst: false, cab: 21 }],
  ['umm create a trip for uh Vikram 3 adults from emm 5th january 2027 2 nights srinagar grand mumtaz ahh 1 night sonamarg snowland innova',
    { client: 'Vikram', adults: 3, start: '2027-01-05', nights: 3, hotels: [[11, '2027-01-05', '2027-01-07'], [16, '2027-01-07', '2027-01-08']], cab: 21 }],
  ['5 days 4 nights kashmir trip for Ali family 2 adults 2 children arriving 10 november',
    { client: 'Ali', adults: 2, kids: 2, nights: 4, start: '2026-11-10', cabDays: 5 }],
  ['trip for John 2 adults 10 november 4 nights day 1 arrival in srinagar day 2 srinagar to gulmarg day 3 gulmarg sightseeing day 4 gulmarg to pahalgam day 5 departure',
    { client: 'John', nights: 4, days: ['Srinagar', 'Gulmarg', 'Gulmarg', 'Pahalgam', 'Pahalgam'], hotelCities: ['Srinagar', 'Gulmarg', 'Pahalgam'] }],
  ['create a trip for Rahul 2 adults 10 nov 2 nights pine spring resort 1 night grand mumtaz meal plan room only innova',
    { client: 'Rahul', nights: 3, hotels: [[17, '2026-11-10', '2026-11-12', '1', 'Only Room'], [11, '2026-11-12', '2026-11-13', '1', 'Only Room']] }],
  ['create a trip for Rahul 2 adults 10 nov 2 nights grand mumtaz super deluxe room innova',
    { client: 'Rahul', hotels: [[11, '2026-11-10', '2026-11-12', '1', null, 7000]] }],
  ['trip for Kapoor 8 people 18 november 3 nights highlands park 4 rooms with tempo traveller',
    { client: 'Kapoor', adults: 8, hotels: [[13, '2026-11-18', '2026-11-21', '4']], cab: 23 }],
  ['create a trip for Rahul 2 adults 1 child 10 november 2 nights grand mumtaz innova add gondola for 2 adults and 1 child on day 2',
    { client: 'Rahul', kids: 1, acts: [[31, 2, 2, 1, 900]] }],
  ['create a trip for Meera 2 adults 30th november 2 nights grand mumtaz innova quote 40000',
    { client: 'Meera', total: 40000 }],
  ['trip for Rahul Verma 2 adults 10 november 3 nights srinagar 2 rooms breakfast only swift dzire',
    { client: 'Rahul Verma', hotelRooms: '2', meal: 'Only Room + Breakfast', cab: 22 }],
  ['trip for Rahul 2 adults from 10-11-2026 2 nights grand mumtaz innova',
    { start: '2026-11-10', nights: 2, hotels: [[11, '2026-11-10', '2026-11-12']] }],
  ['trip for Rahul 2 adults on 10/11/2026 for 2 nights at grand mumtaz by innova',
    { start: '2026-11-10', nights: 2, hotels: [[11, '2026-11-10', '2026-11-12']], cab: 21 }],
  ['create a trip for Rahul 2 adults next friday 2 nights grand mumtaz innova',
    { start: '2026-10-09', nights: 2 }],
  ['client name is Farooq Ahmed mobile number 9419012345 2 adults 14 november 2 nights grand mumtaz innova',
    { client: 'Farooq Ahmed', phone: '+919419012345' }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz all meals innova',
    { meal: 'Breakfast + Lunch + Dinner' }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz map innova',
    { meal: 'Breakfast + Dinner' }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz cp innova',
    { meal: 'Only Room + Breakfast' }],
  ['trip for Anil couple 14 november 2 nights grand mumtaz innova',
    { adults: 2 }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz innova 2 cabs',
    { cab: 21, cabQty: 2 }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz no cab',
    { cabDays: 0 }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz innova 4 star',
    { hotels: [[11, '2026-11-14', '2026-11-16']] }],
  ['trip for Anil 2 adults 14 november 3 nights srinagar 5 star innova',
    { hotels: [[12, '2026-11-14', '2026-11-17']] }],
  ['trip for Anil 2 adults 14 november 2 nights gulmarg budget hotel innova',
    { hotels: [[13, '2026-11-14', '2026-11-16']] }],
  ['trip for Anil 2 adults 14 november 2 nights khyber 1 extra bed innova',
    { hotels: [[14, '2026-11-14', '2026-11-16']], extraBeds: 1 }],
  ['trip for Anil and family 3 adults 14 november 2 nights grand mumtaz innova',
    { client: 'Anil', adults: 3 }],
  ['trip for Anil 2 adults and 2 kids aged 4 and 9 14 november 2 nights grand mumtaz innova',
    { kids: 1, infants: 1 }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz innova add pony ride in pahalgam',
    { acts: [[33, 0, 2]] }],
  ['trip for Anil 2 adults 14 november 2 nights srinagar 2 nights pahalgam innova add pony ride on day 4',
    { acts: [[33, 4, 2]] }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz innova margin 12% gst 18%',
    { margin: 12, gstPct: 18 }],
  ['trip for Anil 2 adults 14 november 2 nights grand mumtaz innova markup 10000 rupees',
    { marginAmount: 10000 }],
  ['trip for Zara 2 adults 14 november two nights grand mumtaz and one night highlands park innova',
    { nights: 3, hotels: [[11, '2026-11-14', '2026-11-16'], [13, '2026-11-16', '2026-11-17']] }],
  ['trip for Zara 2 adults fourteenth november three nights grand mumtaz innova',
    { start: '2026-11-14', nights: 3 }],
  ['trip for Zara two adults one child fourteen november two nights grand mumtaz innova',
    { adults: 2, kids: 1, start: '2026-11-14' }],
  ['trip for Zara 2 adults 14 november 2 nights at the grand mumtaz hotel in srinagar with an innova crysta',
    { hotels: [[11, '2026-11-14', '2026-11-16']], cab: 21 }],
]

for (const [said, exp] of C1) {
  const r = planLive(blank, stripFillers(said), opts)
  const s = r.snapshot, ti = s.tripInfo
  const bad = []
  const eq = (k, a, e) => { if (JSON.stringify(a) !== JSON.stringify(e)) bad.push(`${k}: got ${JSON.stringify(a)} want ${JSON.stringify(e)}`) }
  if ('client' in exp) eq('client', ti.clientName, exp.client)
  if ('phone' in exp) eq('phone', ti.clientPhone, exp.phone)
  if ('email' in exp) eq('email', ti.clientEmail, exp.email)
  if ('adults' in exp) eq('adults', Number(ti.adults), exp.adults)
  if ('kids' in exp) eq('kids', Number(ti.kids5to12), exp.kids)
  if ('infants' in exp) eq('infants', Number(ti.kidsUpto5), exp.infants)
  if ('start' in exp) eq('start', ti.startDate, exp.start)
  if ('nights' in exp) eq('nights', Number(ti.duration), exp.nights)
  if ('days' in exp) eq('days', s.itinerary.map((d) => d.location), exp.days)
  if (exp.days || exp.nights) { const missing = s.itinerary.filter((d) => !d.destinationId).length; if (missing) bad.push(`days without destination: ${missing}`) }
  if ('hotels' in exp) eq('hotels', s.accommodations.map((a, i) => { const e = exp.hotels[i] || []; const out = [a.hotelId, a.checkIn, a.checkOut]; if (e.length > 3) out.push(String(a.rooms)); if (e.length > 4) out.push(e[4] == null ? null : a.mealPlan); if (e.length > 5) out.push(Number(a.pricePerRoom)); return out }), exp.hotels.map((h) => h.length > 4 && h[4] == null ? [...h.slice(0, 4), null, ...h.slice(5)] : h))
  if ('hotelCities' in exp) eq('hotelCities', s.accommodations.map((a) => a.city.replace(/ City$/, '')), exp.hotelCities)
  if ('hotelRooms' in exp) eq('rooms', s.accommodations.map((a) => String(a.rooms))[0], exp.hotelRooms)
  if ('meal' in exp) eq('meal', s.accommodations[0]?.mealPlan, exp.meal)
  if ('extraBeds' in exp) eq('extraBeds', Number(s.accommodations[0]?.extraBedsAbove12Count || 0) + Number(s.accommodations[0]?.extraAdultCount || 0), exp.extraBeds)
  if ('cab' in exp) eq('cab', [...new Set(s.transportation.filter((t) => t.vehicleId).map((t) => t.vehicleId))], [exp.cab])
  if ('cabQty' in exp) eq('cabQty', s.transportation[0]?.quantity, exp.cabQty)
  if ('cabDays' in exp) eq('cabDays', s.transportation.length, exp.cabDays)
  if ('acts' in exp) eq('acts', s.tripActivities.map((a, i) => { const e = exp.acts[i] || []; const o = [a.activityId, Number(a.dayNumber), Number(a.ticketCount)]; if (e.length > 3) o.push(Number(a.childCount)); if (e.length > 4) o.push(Number(a.pricePerTicket)); return o }), exp.acts)
  if ('margin' in exp) eq('margin', s.profitMarginPercentage, exp.margin)
  if ('gst' in exp) eq('gst', s.includeGST, exp.gst)
  if ('gstPct' in exp) eq('gstPct', s.gstPercentage, exp.gstPct)
  if ('total' in exp) eq('total', Math.round(priceOf(s).total), exp.total)
  if ('marginAmount' in exp) eq('profit', Math.round(priceOf(s).profit), exp.marginAmount)
  // Every night has a hotel; hotels add up to the trip.
  const hn = s.accommodations.reduce((x, a) => x + Math.round((Date.parse(a.checkOut) - Date.parse(a.checkIn)) / 864e5), 0)
  if (s.accommodations.length && hn !== Number(ti.duration)) bad.push(`hotel nights ${hn} ≠ trip ${ti.duration}`)
  if (s.itinerary.length && s.itinerary.length !== Number(ti.duration) + 1) bad.push(`days ${s.itinerary.length} ≠ nights+1`)
  report(said, bad)
}

// ── 2. More phrasings + edits on an existing trip ─────────────────────────
const base = fill('create a trip for Rahul Sharma 2 adults from 10th november 2 nights in srinagar at grand mumtaz and 2 nights in gulmarg at highlands park with innova')
const hotels = (s) => s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut])
const C2 = [
  // fresh fills (phrasings not in eval 1)
  ['fill', 'I need a package for the Malik family, 4 adults, 2 kids, travelling 3rd december, 2 nights Srinagar in Lalit Grand Palace, 2 nights Pahalgam in Heevan Resort, tempo traveller', (s) => [
    [s.tripInfo.clientName, 'Malik'], [s.tripInfo.adults, 4], [s.tripInfo.kids5to12, 2], [s.tripInfo.startDate, '2026-12-03'], [s.tripInfo.duration, '4'],
    [hotels(s), [[12, '2026-12-03', '2026-12-05'], [15, '2026-12-05', '2026-12-07']]], [s.transportation[0]?.vehicleId, 23], [s.transportation.length, 5]]],
  ['fill', 'book a 3 night trip for Sana from 22 nov stay at highlands park all 3 nights with 2 rooms on map plan in an innova crysta', (s) => [
    [s.tripInfo.clientName, 'Sana'], [s.tripInfo.duration, '3'], [hotels(s), [[13, '2026-11-22', '2026-11-25']]], [s.accommodations[0]?.rooms, '2'], [s.accommodations[0]?.mealPlan, 'Breakfast + Dinner'], [s.transportation[0]?.vehicleId, 21]]],
  ['fill', 'quotation for Mr and Mrs Bhat 28th november 4 nights srinagar 2 gulmarg 2 sedan 15% margin', (s) => [
    [s.tripInfo.clientName, 'Bhat'], [s.tripInfo.adults, 2], [s.tripInfo.duration, '4'], [s.accommodations.map((a) => a.city.replace(/ City$/, '')), ['Srinagar', 'Gulmarg']], [s.transportation[0]?.vehicleId, 22], [s.profitMarginPercentage, 15]]],
  ['fill', 'trip for Irfan 2 adults 1 kid 5 november 1 night sonamarg snowland 2 nights srinagar grand mumtaz dzire, add shikara on day 3', (s) => [
    [hotels(s), [[16, '2026-11-05', '2026-11-06'], [11, '2026-11-06', '2026-11-08']]], [s.tripActivities.map((a) => [a.activityId, a.dayNumber]), [[32, 3]]], [s.tripInfo.kids5to12, 1]]],
  ['fill', 'create a trip for Rohan 2 adults 10 november 3 nights grand mumtaz innova gst 12 percent', (s) => [[s.gstPercentage, 12], [s.includeGST, true]]],
  ['fill', 'create a trip for Rohan 2 adults 10 november 3 nights grand mumtaz innova without gst', (s) => [[s.includeGST, false]]],
  ['fill', 'create a trip for Rohan 2 adults 10 november 3 nights grand mumtaz innova gst 5 percent quote 70000', (s) => [[s.gstPercentage, 5], [Math.round(priceOf(s).total), 70000]]],
  ['fill', 'create a trip for Rohan 2 adults 10 november 3 nights grand mumtaz innova final price 60000', (s) => [[Math.round(priceOf(s).total), 60000]]],
  ['fill', 'create a trip for Rohan Mehta email rohan.mehta@yahoo.com phone +91 99060 12345 2 adults 10 november 2 nights grand mumtaz innova', (s) => [[s.tripInfo.clientEmail, 'rohan.mehta@yahoo.com'], [s.tripInfo.clientPhone, '+919906012345'], [s.tripInfo.clientName, 'Rohan Mehta']]],
  ['fill', 'family of 5 trip for Gupta 10 november 2 nights grand mumtaz innova', (s) => [[s.tripInfo.clientName, 'Gupta'], [s.tripInfo.adults, 5]]],
  ['fill', 'honeymoon trip for Aamir and Sara 10 november 4 nights 2 nights khyber 2 nights heevan innova', (s) => [[s.tripInfo.adults, 2], [hotels(s), [[14, '2026-11-10', '2026-11-12'], [15, '2026-11-12', '2026-11-14']]]]],
  ['fill', 'trip for Ravi 2 adults 10 november 2 nights grand mumtaz deluxe room breakfast and dinner innova', (s) => [[s.accommodations[0]?.roomType, 'Deluxe'], [s.accommodations[0]?.pricePerRoom, 6400]]],
  ['fill', 'trip for Ravi 2 adults 10 november 2 nights grand mumtaz 2 rooms 1 extra bed innova 2 cabs', (s) => [[s.accommodations[0]?.rooms, '2'], [s.accommodations[0]?.extraBedsAbove12Count, '1'], [s.transportation[0]?.quantity, 2], [s.accommodations.length, 1]]],
  // edits on an existing trip
  ['edit', 'make gulmarg 3 nights', (s) => [[hotels(s), [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-15']]], [s.itinerary.length, 6], [s.transportation.length, 6]]],
  ['edit', 'change the hotel in srinagar to lalit grand palace', (s) => [[hotels(s)[0][0], 12], [s.accommodations[0]?.pricePerRoom, 9000]]],
  ['edit', 'change the cab to tempo traveller', (s) => [[[...new Set(s.transportation.map((t) => t.vehicleId))], [23]]]],
  ['edit', 'breakfast and dinner in all hotels', (s) => [[s.accommodations.map((a) => a.mealPlan), ['Breakfast + Dinner', 'Breakfast + Dinner']], [s.accommodations[0]?.pricePerRoom, 6400]]],
  ['edit', 'make it 2 rooms', (s) => [[s.accommodations.map((a) => a.rooms), ['2', '2']]]],
  ['edit', 'client phone is 9797012345 and email is rahul at gmail dot com', (s) => [[s.tripInfo.clientPhone, '+919797012345'], [s.tripInfo.clientEmail, 'rahul@gmail.com']]],
  ['edit', 'start date 15 december', (s) => [[hotels(s)[0][1], '2026-12-15'], [s.tripInfo.startDate, '2026-12-15'], [s.transportation[0]?.date, '2026-12-15']]],
  ['edit', 'add gondola phase 2 on day 3 for 2 adults', (s) => [[s.tripActivities.map((a) => [a.activityId, a.dayNumber, a.pricePerTicket]), [[31, 3, 1900]]]]],
  ['edit', 'add 1 night in pahalgam at heevan resort', (s) => [[hotels(s).at(-1), [15, '2026-11-14', '2026-11-15']], [s.tripInfo.duration, '5']]],
  ['edit', 'make day 2 a leisure day', (s) => [[/leisure/i.test(s.itinerary[1]?.title || ''), true]]],
  ['edit', 'add 1 child', (s) => [[s.tripInfo.kids5to12, 1]]],
  ['edit', 'make it 4 adults', (s) => [[s.tripInfo.adults, 4]]],
  ['edit', 'margin 18 percent and remove gst', (s) => [[s.profitMarginPercentage, 18], [s.includeGST, false]]],
  ['edit', 'quote 55000', (s) => [[Math.round(priceOf(s).total), 55000]]],
  ['edit', 'replace grand mumtaz with lalit', (s) => [[hotels(s)[0][0], 12]]],
  ['edit', 'umm change uh the cab to dzire', (s) => [[[...new Set(s.transportation.map((t) => t.vehicleId))], [22]]]],
  ['edit', 'the client name is Rahul Kumar', (s) => [[s.tripInfo.clientName, 'Rahul Kumar']]],
  ['edit', 'reduce srinagar to 1 night', (s) => [[hotels(s), [[11, '2026-11-10', '2026-11-11'], [13, '2026-11-11', '2026-11-13']]]]],
]
for (const [mode, said, check] of C2) {
  const s = mode === 'fill' ? fill(said) : planLive(base, stripFillers(said), opts).snapshot
  report(`[${mode}] ${said}`, sanity(s, diff(check(s))))
}

// ── 3. Harder speech: corrections, Hinglish, number words, spoken email ───
const H = hotels
const C3 = [
  ['create a kashmir package for 4 pax, Mr Lone, arriving twelfth of november, three nights srinagar at grand mumtaz, two nights pahalgam at pine spring, innova', (s) => [[s.tripInfo.clientName, 'Lone'], [s.tripInfo.adults, 4], [s.tripInfo.startDate, '2026-11-12'], [s.tripInfo.duration, '5'], [H(s), [[11, '2026-11-12', '2026-11-15'], [17, '2026-11-15', '2026-11-17']]], [s.transportation[0]?.vehicleId, 21]]],
  ['trip for Kiran 2 adults 3 nights no sorry 4 nights from 1st december grand mumtaz innova', (s) => [[s.tripInfo.duration, '4'], [H(s), [[11, '2026-12-01', '2026-12-05']]]]],
  ['trip for Kiran 2 adults from 1st december 2 nights grand mumtaz actually make it lalit innova', (s) => [[H(s).map((h) => h[0]), [12]]]],
  ['Rahul ke liye trip banao 2 adults 10 november se 2 raat srinagar grand mumtaz innova', (s) => [[s.tripInfo.clientName, 'Rahul'], [s.tripInfo.duration, '2'], [H(s), [[11, '2026-11-10', '2026-11-12']]]]],
  ['trip for Omar six adults ten november two nights khyber himalayan resort and two nights heevan with tempo traveller', (s) => [[s.tripInfo.adults, 6], [H(s), [[14, '2026-11-10', '2026-11-12'], [15, '2026-11-12', '2026-11-14']]], [s.transportation[0]?.vehicleId, 23]]],
  ['trip for Omar 2 adults 10 november 2 nights at Grand Mumtaz Hotel Srinagar and 1 night at Snowland Sonamarg innova', (s) => [[H(s), [[11, '2026-11-10', '2026-11-12'], [16, '2026-11-12', '2026-11-13']]]]],
  ['trip for Omar 2 adults 10 november 2 nights srinagar 1 night gulmarg day trip to sonamarg on day 2 innova', (s) => [[s.tripInfo.duration, '3'], [s.accommodations.map((a) => a.city.replace(/ City$/, '')), ['Srinagar', 'Gulmarg']], [/Sonamarg/.test(s.itinerary[1]?.title || ''), true]]],
  ['trip for Asha 2 adults and 1 child aged 3 10 november 2 nights grand mumtaz innova', (s) => [[s.tripInfo.kidsUpto5, 1], [s.tripInfo.kids5to12, 0]]],
  ['trip for Asha 2 adults 10 november 2 nights grand mumtaz innova add shikara ride and pony ride', (s) => [[s.tripActivities.map((a) => a.activityId).sort(), [32, 33]]]],
  ['trip for Asha 2 adults 10 november 2 nights grand mumtaz with breakfast innova 10 percent margin 5 percent gst', (s) => [[s.accommodations[0]?.mealPlan, 'Only Room + Breakfast'], [s.accommodations[0]?.pricePerRoom, 5200], [s.profitMarginPercentage, 10], [s.gstPercentage, 5]]],
  ['trip for Asha phone nine eight seven six five four three two one zero 2 adults 10 november 2 nights grand mumtaz innova', (s) => [[s.tripInfo.clientPhone, '+919876543210']]],
  ['trip for Asha 2 adults 10 november 2 nights grand mumtaz innova email asha underscore k at outlook dot com', (s) => [[s.tripInfo.clientEmail, 'asha_k@outlook.com']]],
  ['trip for Asha 2 adults 10 november 2 nights grand mumtaz innova and the client email is asha123@gmail.com', (s) => [[s.tripInfo.clientEmail, 'asha123@gmail.com']]],
  ['trip for Asha 2 adults 10 november 1 week srinagar grand mumtaz innova', (s) => [[s.tripInfo.duration, '7'], [H(s), [[11, '2026-11-10', '2026-11-17']]]]],
  ['trip for the Sharma family 4 adults 2 children 10 november 2 nights grand mumtaz 2 rooms innova', (s) => [[s.tripInfo.clientName, 'Sharma'], [s.accommodations[0]?.rooms, '2'], [s.accommodations[0]?.cnbCount, '2']]],
]
for (const [said, check] of C3) {
  const s = fill(said)
  report(said, sanity(s, diff(check(s))))
}


// ── 4. Logistics by voice: Trip Info + Itinerary filled, then "add …" ──────
// Every field of the Add Hotel / Add Transport form; the trip keeps its nights.
const planned = (() => {
  const day = (n, title, location, destinationId) => ({ day: n, title: `Day ${n}: ${title}`, location, destinationId, description: '', activities: [] })
  return {
    ...blank,
    tripInfo: { ...blank.tripInfo, clientName: 'Rahul', adults: 2, kids5to12: 1, startDate: '2026-11-10', duration: '4' },
    itinerary: [day(1, 'Arrival in Srinagar', 'Srinagar', 1), day(2, 'Srinagar Sightseeing', 'Srinagar', 1), day(3, 'Srinagar to Gulmarg', 'Gulmarg', 2), day(4, 'Gulmarg Sightseeing', 'Gulmarg', 2), day(5, 'Departure from Gulmarg', 'Gulmarg', 2)],
  }
})()
const onPlanned = (said) => planLive(planned, stripFillers(said), opts).snapshot
const stay = (a) => [a.hotelId, a.checkIn, a.checkOut, a.rooms, a.roomType, a.mealPlan, a.pricePerRoom, a.cnbCount, a.extraBedsAbove12Count]
const cabRow = (t) => [t.date, t.vehicleId, t.quantity, t.tripType, t.route]
const L = [
  ['add accommodation grand mumtaz for 2 nights 2 rooms breakfast and dinner super deluxe room 1 extra bed', (s) => [[s.accommodations.map(stay), [[11, '2026-11-10', '2026-11-12', '2', 'Super Deluxe', 'Breakfast + Dinner', 7000, '1', '1']]]]],
  ['add 2 nights at grand mumtaz', (s) => [[s.accommodations.map(stay), [[11, '2026-11-10', '2026-11-12', '1', 'Deluxe', 'Only Room + Breakfast', 5200, '1', '0']]]]],
  ['add hotel highlands park in gulmarg', (s) => [[s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut]), [[13, '2026-11-12', '2026-11-14']]]]],
  ['add grand mumtaz from 10th to 12th november', (s) => [[s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut]), [[11, '2026-11-10', '2026-11-12']]], [s.tripInfo.startDate, '2026-11-10']]],
  ['add grand mumtaz for day 1 and 2', (s) => [[s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut]), [[11, '2026-11-10', '2026-11-12']]]]],
  ['add a hotel in srinagar', (s) => [[s.accommodations.map((a) => [a.city, a.checkIn, a.checkOut]), [['Srinagar', '2026-11-10', '2026-11-12']]]]],
  ['add accommodation', (s) => [[s.accommodations.map((a) => [a.city.replace(/ City$/, ''), a.checkIn, a.checkOut]), [['Srinagar', '2026-11-10', '2026-11-12'], ['Gulmarg', '2026-11-12', '2026-11-14']]]]],
  ['add transportation', (s) => [[s.transportation.length, 5], [s.transportation[0]?.vehicleId, 22]]],
  ['add 2 innovas', (s) => [[s.transportation.map((t) => [t.vehicleId, t.quantity]), Array(5).fill([21, 2])]]],
  ['add cab innova for day 3 from srinagar to gulmarg', (s) => [[s.transportation.map(cabRow), [['2026-11-12', 21, 1, 'Transfer', 'Srinagar → Gulmarg']]]]],
  ['add airport pickup on day 1 by dzire', (s) => [[s.transportation.map(cabRow), [['2026-11-10', 22, 1, 'Transfer', 'Airport pickup']]]]],
  ['add dzire for sightseeing on day 2', (s) => [[s.transportation.map(cabRow), [['2026-11-11', 22, 1, 'Sightseeing', 'Srinagar Sightseeing']]]]],
  ['add transport innova for day 1 to 3', (s) => [[s.transportation.map((t) => t.date), ['2026-11-10', '2026-11-11', '2026-11-12']]]],
]
for (const [said, check] of L) {
  const s = onPlanned(said)
  const bad = diff(check(s))
  if (s.tripInfo.duration !== '4' || s.itinerary.length !== 5) bad.push(`trip changed: ${s.tripInfo.duration} nights, ${s.itinerary.length} days`)
  report(`[logistics] ${said}`, bad)
}

// ── 5. Whole trips 4N/5D … 7N/8D: every section filled, total computed ─────
const W = [
  ['create a 4 night 5 day trip for Rahul Sharma phone 9876543210 email rahul@gmail.com 2 adults 1 child from 10th november 2 nights srinagar grand mumtaz 2 nights gulmarg highlands park breakfast and dinner innova add gondola phase 2 on day 3 margin 15 percent', 4, 62669],
  ['5 nights 6 days itinerary for the Malik family phone 9419012345 4 adults 2 kids from 1st december 2 nights srinagar lalit grand palace 1 night sonamarg snowland 2 nights pahalgam heevan resort 2 rooms tempo traveller add shikara ride on day 2 and pony ride on day 5 margin 12%', 5, 135240],
  ['6N7D trip for Priya phone 9906012345 2 adults 15 january 2027 day 1 arrival in srinagar day 2 srinagar to gulmarg day 3 gulmarg sightseeing day 4 gulmarg to pahalgam day 5 pahalgam sightseeing day 6 pahalgam to srinagar day 7 departure dzire', 6, null],
  ['7 nights 8 days kashmir package for Mr Khan phone 9797012345 3 adults from 20 november 3 nights srinagar grand mumtaz 2 nights gulmarg khyber 2 nights pahalgam pine spring resort innova breakfast only add gondola on day 4 gst 5 percent quote 150000', 7, 150000],
]
for (const [said, nights, total] of W) {
  const s = fill(said)
  const bad = []
  if (Number(s.tripInfo.duration) !== nights) bad.push(`nights ${s.tripInfo.duration} want ${nights}`)
  if (s.itinerary.length !== nights + 1) bad.push(`days ${s.itinerary.length} want ${nights + 1}`)
  if (!s.tripInfo.clientName || !s.tripInfo.startDate || !/^\+91\d{10}$/.test(s.tripInfo.clientPhone)) bad.push('trip info incomplete')
  if (s.transportation.length !== nights + 1) bad.push(`cab rows ${s.transportation.length} want ${nights + 1}`)
  if (s.accommodations.some((a) => !a.hotelId || !(a.pricePerRoom > 0) || !a.roomType || !a.rooms)) bad.push('a hotel form is incomplete')
  if (total != null && Math.round(priceOf(s).total) !== total) bad.push(`total ${Math.round(priceOf(s).total)} want ${total}`)
  report(`[${nights}N/${nights + 1}D] ${said.slice(0, 60)}…`, sanity(s, bad))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
