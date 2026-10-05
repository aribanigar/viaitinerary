// Ching in Hindi and Urdu (script as the browser's hi-IN / ur-PK recognisers
// write it, and romanized Hinglish / Roman Urdu from the English mic): the
// spoken request → toEnglishCommand → the same trip pipeline, field by field.
//   node frontend/scripts/ching-multilang.test.mjs
import { planLive } from '../src/utils/ching/liveFill.js'
import { stripFillers } from '../src/utils/ching/speechClean.js'
import { toEnglishCommand } from '../src/utils/ching/language.js'

const catalog = {
  destinations: [
    { id: 1, name: 'Srinagar', state: 'Jammu and Kashmir' }, { id: 2, name: 'Gulmarg', state: 'Jammu and Kashmir' },
    { id: 3, name: 'Pahalgam', state: 'Jammu and Kashmir' }, { id: 4, name: 'Sonamarg', state: 'Jammu and Kashmir' },
  ],
  hotels: [
    { id: 11, name: 'Hotel Grand Mumtaz', city: 'Srinagar', category: '4', is_available: true, price_sections: [{ room_type: 'Deluxe', price: 5200, meal_plan: 'breakfast_only' }, { room_type: 'Deluxe', price: 6400, meal_plan: 'breakfast_dinner' }] },
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
    { id: 31, name: 'Gondola Ride Phase 1', destination_id: 2, selling_price: 900, city: 'Gulmarg', price_sections: [{ option: 'Phase 2', price: 1900 }] },
    { id: 32, name: 'Shikara Ride', destination_id: 1, selling_price: 800, city: 'Srinagar', price_sections: [] },
    { id: 33, name: 'Pony Ride', destination_id: 3, selling_price: 1200, city: 'Pahalgam', price_sections: [] },
  ],
  memory: { clients: [{ name: 'Rahul Sharma' }, { name: 'Imran Malik' }] },
}
const settings = { profit_percentage: 10, gst_percentage: 5, include_gst: true }
const today = '2026-10-05'
// Ching's memory completes a returning client's name ("imran" → Imran Malik).
const blank = { tripInfo: { tripId: 'T', tripTitle: '', destination: '', clientName: '', clientPhone: '+91', clientEmail: '', adults: 2, kids5to12: 0, kidsUpto5: 0, startDate: today, duration: '2' }, itinerary: [], accommodations: [], transportation: [], tripActivities: [], inclusions: [], exclusions: [], profitMarginPercentage: 10, gstPercentage: 5, includeGST: true }
const day = (n, title, location, destinationId) => ({ day: n, title: `Day ${n}: ${title}`, location, destinationId, description: '', activities: [] })
const planned = { ...blank, tripInfo: { ...blank.tripInfo, clientName: 'Rahul', adults: 2, kids5to12: 1, startDate: '2026-11-10', duration: '4' }, itinerary: [day(1, 'Arrival in Srinagar', 'Srinagar', 1), day(2, 'Srinagar Sightseeing', 'Srinagar', 1), day(3, 'Srinagar to Gulmarg', 'Gulmarg', 2), day(4, 'Gulmarg Sightseeing', 'Gulmarg', 2), day(5, 'Departure from Gulmarg', 'Gulmarg', 2)] }

const run = (base, said) => planLive(base, toEnglishCommand(stripFillers(said), catalog), { catalog, settings, today }).snapshot
const H = (s) => s.accommodations.map((a) => [a.hotelId, a.checkIn, a.checkOut])

let pass = 0
let fail = 0
const check = (label, said, base, fn) => {
  const s = run(base, said)
  const bad = fn(s).filter(([a, e]) => JSON.stringify(a) !== JSON.stringify(e) && String(a) !== String(e)).map(([a, e]) => `got ${JSON.stringify(a)} want ${JSON.stringify(e)}`)
  if (bad.length) {
    fail++
    console.log(`  FAIL [${label}] ${said}\n       → ${toEnglishCommand(stripFillers(said), catalog)}\n       ${bad.join('\n       ')}`)
  } else {
    pass++
    console.log(`  ok   [${label}] ${said}`)
  }
}

console.log('Ching Hindi / Urdu tests')

// ── Hindi (Devanagari, as hi-IN writes it) ─────────────────────────────────
check('hi fill', 'राहुल शर्मा के लिए ट्रिप बनाओ 2 एडल्ट्स और 1 बच्चा 10 नवंबर से 2 रात श्रीनगर ग्रैंड मुमताज़ में और 2 रात गुलमर्ग हाईलैंड्स पार्क में इनोवा गाड़ी', blank, (s) => [
  [s.tripInfo.clientName, 'Rahul Sharma'], [s.tripInfo.adults, 2], [s.tripInfo.kids5to12, 1], [s.tripInfo.startDate, '2026-11-10'], [s.tripInfo.duration, '4'],
  [H(s), [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-14']]], [s.transportation.length, 5], [s.transportation[0]?.vehicleId, 21]])
check('hi fill', 'मलिक परिवार के लिए 5 रात 6 दिन का पैकेज बनाओ 4 बड़े 2 बच्चे 1 दिसंबर से श्रीनगर में 2 रात ललित ग्रैंड पैलेस 1 रात सोनमर्ग स्नोलैंड 2 रात पहलगाम हीवन रिसॉर्ट टेम्पो ट्रैवलर', blank, (s) => [
  [s.tripInfo.clientName, 'Malik'], [s.tripInfo.adults, 4], [s.tripInfo.kids5to12, 2], [s.tripInfo.duration, '5'], [s.tripInfo.startDate, '2026-12-01'],
  [H(s), [[12, '2026-12-01', '2026-12-03'], [16, '2026-12-03', '2026-12-04'], [15, '2026-12-04', '2026-12-06']]], [s.transportation[0]?.vehicleId, 23]])
check('hi fill', 'उम्म इमरान के लिए 3 रात की ट्रिप बनाओ 15 जनवरी 2027 से 3 लोग श्रीनगर ग्रैंड मुमताज़ नाश्ता और रात का खाना 2 कमरे डिज़ायर', blank, (s) => [
  [s.tripInfo.clientName, 'Imran Malik'], [s.tripInfo.adults, 3], [s.tripInfo.startDate, '2027-01-15'], [H(s), [[11, '2027-01-15', '2027-01-18']]],
  [s.accommodations[0]?.rooms, '2'], [s.accommodations[0]?.mealPlan, 'Breakfast + Dinner'], [s.accommodations[0]?.pricePerRoom, 6400], [s.transportation[0]?.vehicleId, 22]])
check('hi fill', 'राहुल के लिए ट्रिप बनाओ 2 लोग 20 नवंबर से दो रात श्रीनगर ग्रैंड मुमताज़ इनोवा तीसरे दिन शिकारा राइड जोड़ो मार्जिन 15 प्रतिशत', blank, (s) => [
  [s.tripInfo.duration, '2'], [s.tripActivities.map((a) => [a.activityId, a.dayNumber]), [[32, 3]]], [s.profitMarginPercentage, 15]])
// edits on a planned trip (Trip Info + Itinerary filled)
check('hi logistics', 'ग्रैंड मुमताज़ 2 रात के लिए जोड़ो 2 कमरे नाश्ता और रात का खाना', planned, (s) => [
  [H(s), [[11, '2026-11-10', '2026-11-12']]], [s.accommodations[0]?.rooms, '2'], [s.accommodations[0]?.mealPlan, 'Breakfast + Dinner'], [s.tripInfo.duration, '4']])
check('hi logistics', 'गुलमर्ग में होटल हाईलैंड्स पार्क जोड़ो', planned, (s) => [[H(s), [[13, '2026-11-12', '2026-11-14']]]])
check('hi logistics', 'होटल जोड़ो', planned, (s) => [[s.accommodations.length, 2], [s.tripInfo.duration, '4']])
check('hi logistics', 'इनोवा गाड़ी जोड़ो', planned, (s) => [[s.transportation.length, 5], [s.transportation[0]?.vehicleId, 21]])
check('hi logistics', 'पहले दिन एयरपोर्ट पिकअप डिज़ायर से करो', planned, (s) => [[s.transportation.map((t) => [t.date, t.vehicleId, t.route]), [['2026-11-10', 22, 'Airport pickup']]]])
check('hi logistics', 'तीसरे दिन गोंडोला राइड जोड़ो', planned, (s) => [[s.tripActivities.map((a) => [a.activityId, a.dayNumber]), [[31, 3]]]])
check('hi pricing', 'मार्जिन 20 प्रतिशत रखो', planned, (s) => [[s.profitMarginPercentage, 20]])
check('hi pricing', 'जीएसटी नहीं', planned, (s) => [[s.includeGST, false]])

// ── Urdu (Urdu script, as ur-PK writes it) ─────────────────────────────────
check('ur fill', 'راہل شرما کے لیے ٹرپ بناؤ دو بالغ دس نومبر سے دو رات سرینگر گرینڈ ممتاز اور دو رات گلمرگ ہائی لینڈز پارک انووا گاڑی', blank, (s) => [
  [s.tripInfo.clientName, 'Rahul Sharma'], [s.tripInfo.adults, 2], [s.tripInfo.startDate, '2026-11-10'], [s.tripInfo.duration, '4'],
  [H(s), [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-14']]], [s.transportation[0]?.vehicleId, 21]])
check('ur fill', 'عمران ملک کے لیے پانچ رات کا پیکج بناؤ چار لوگ ایک دسمبر سے تین رات سرینگر للت گرینڈ پیلس دو رات پہلگام ہیون ریزورٹ ٹیمپو ٹریولر', blank, (s) => [
  [s.tripInfo.clientName, 'Imran Malik'], [s.tripInfo.adults, 4], [s.tripInfo.duration, '5'], [H(s), [[12, '2026-12-01', '2026-12-04'], [15, '2026-12-04', '2026-12-06']]], [s.transportation[0]?.vehicleId, 23]])
check('ur logistics', 'گرینڈ ممتاز دو رات کے لیے جوڑو ناشتہ اور رات کا کھانا', planned, (s) => [[H(s), [[11, '2026-11-10', '2026-11-12']]], [s.accommodations[0]?.mealPlan, 'Breakfast + Dinner']])
check('ur logistics', 'انووا گاڑی جوڑو', planned, (s) => [[s.transportation.length, 5], [s.transportation[0]?.vehicleId, 21]])
check('ur logistics', 'تیسرے دن گنڈولا رائڈ جوڑو', planned, (s) => [[s.tripActivities.map((a) => [a.activityId, a.dayNumber]), [[31, 3]]]])
check('ur pricing', 'مارجن پندرہ فیصد', planned, (s) => [[s.profitMarginPercentage, 15]])

// ── Hinglish / Roman Urdu (the English mic) ─────────────────────────────────
check('roman fill', 'rahul ke liye trip banao 2 log 10 november se 2 raat srinagar grand mumtaz 2 raat gulmarg highlands park innova gaadi', blank, (s) => [
  [s.tripInfo.clientName, 'Rahul Sharma'], [s.tripInfo.duration, '4'], [H(s), [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-14']]], [s.transportation[0]?.vehicleId, 21]])
check('roman fill', 'imran ke liye teen raat ka trip banao 4 log 5 december se srinagar lalit grand palace tempo traveller', blank, (s) => [
  [s.tripInfo.clientName, 'Imran Malik'], [s.tripInfo.adults, 4], [s.tripInfo.duration, '3'], [H(s), [[12, '2026-12-05', '2026-12-08']]], [s.transportation[0]?.vehicleId, 23]])
check('roman logistics', 'pehle din airport pickup dzire se karo', planned, (s) => [[s.transportation.map((t) => [t.date, t.vehicleId, t.route]), [['2026-11-10', 22, 'Airport pickup']]]])
check('roman logistics', 'gulmarg mein highlands park jodo', planned, (s) => [[H(s), [[13, '2026-11-12', '2026-11-14']]]])
// ── more phrasings: pronouns, "need", commas, Urdu names without short vowels ──
check('hi fill', 'मुझे सना के लिए एक पैकेज चाहिए 3 लोगों का, 5 दिसंबर से 4 रात, 2 रात श्रीनगर में ललित और 2 रात पहलगाम में हीवन रिसॉर्ट, गाड़ी इनोवा', blank, (s) => [
  [s.tripInfo.clientName, 'Sana'], [s.tripInfo.adults, 3], [s.tripInfo.duration, '4'], [H(s), [[12, '2026-12-05', '2026-12-07'], [15, '2026-12-07', '2026-12-09']]], [s.transportation[0]?.vehicleId, 21]])
check('ur fill', 'ہمیں فاروق احمد کے لیے تین رات کا ٹرپ چاہیے، دو لوگ، پندرہ نومبر سے، سرینگر میں گرینڈ ممتاز، گاڑی ڈیزائر', blank, (s) => [
  [s.tripInfo.clientName, 'Farooq Ahmed'], [s.tripInfo.duration, '3'], [H(s), [[11, '2026-11-15', '2026-11-18']]], [s.transportation[0]?.vehicleId, 22]])
check('ur logistics', 'گلمرگ میں دو رات خیبر ریزورٹ جوڑو', planned, (s) => [[H(s).map((h) => h[0]), [14]]])
check('ur logistics', 'پہلے دن ایئرپورٹ پک اپ انووا سے کرو', planned, (s) => [[s.transportation.map((t) => [t.date, t.vehicleId, t.route]), [['2026-11-10', 21, 'Airport pickup']]]])
check('roman logistics', 'doosre din shikara ride daal do', planned, (s) => [[s.tripActivities.map((a) => [a.activityId, a.dayNumber]), [[32, 2]]]])
check('roman pricing', 'margin 18 percent kar do aur gst hatao', planned, (s) => [[s.profitMarginPercentage, 18], [s.includeGST, false]])
// English still exactly as before
check('english', 'create a trip for Rahul Sharma 2 adults from 10th november 2 nights in srinagar at grand mumtaz and 2 nights in gulmarg at highlands park with innova', blank, (s) => [
  [s.tripInfo.clientName, 'Rahul Sharma'], [H(s), [[11, '2026-11-10', '2026-11-12'], [13, '2026-11-12', '2026-11-14']]]])

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
