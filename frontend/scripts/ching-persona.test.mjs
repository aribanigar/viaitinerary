// Ching's personality and languages: which language to answer in, small-talk
// intents, a line for every intent in every language, Hinglish stock replies —
// and that none of it ever swallows a trip sentence.
//   node frontend/scripts/ching-persona.test.mjs
import assert from 'node:assert/strict'
import { replyStyle, smalltalkIntent, personaLine, hinglishReply, PERSONA_INTENTS } from '../src/utils/ching/persona.js'
import { understandAssistant } from '../src/utils/ching/assistant.js'
import { toEnglishCommand } from '../src/utils/ching/language.js'
import { parseChingCommand } from '../src/utils/ching/parseCommand.js'

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

const catalog = {
  hotels: [
    { id: 4, name: 'The Lalit Grand Palace', city: 'Srinagar' },
    { id: 5, name: 'Khyber Himalayan Resort & Spa', city: 'Gulmarg' },
  ],
  destinations: [{ id: 1, name: 'Kashmir' }, { id: 2, name: 'Srinagar' }, { id: 3, name: 'Gulmarg' }],
  vehicles: [{ id: 1, name: 'Innova Crysta' }],
}
const ask = (said) => understandAssistant(toEnglishCommand(said, catalog) || said, { inBuilder: true })
const fill = (said) => parseChingCommand(toEnglishCommand(said, catalog) || said, catalog, { today: new Date(2026, 9, 8) })

console.log('Ching persona tests')

test('reply language follows how the agent spoke', () => {
  assert.equal(replyStyle('make gulmarg 2 nights'), 'en')
  assert.equal(replyStyle('aap kaise ho'), 'hinglish')
  assert.equal(replyStyle('rahul ke liye 2 raat srinagar trip banao'), 'hinglish')
  assert.equal(replyStyle('राहुल के लिए ट्रिप बनाओ'), 'hi')
  assert.equal(replyStyle('راہل کے لیے ٹرپ بناؤ'), 'ur')
  assert.equal(replyStyle('make it 3 nights', 'ur-PK'), 'ur')
  assert.equal(replyStyle('hello', 'hi-IN'), 'hi')
})

test('every intent has a line in English, Hinglish, Hindi and Urdu', () => {
  for (const intent of PERSONA_INTENTS) {
    for (const style of ['en', 'hinglish', 'hi', 'ur']) {
      const line = personaLine(intent, style)
      assert.ok(line && line.text && line.text.length > 5, `${intent}/${style}`)
      if (style === 'hi') assert.match(line.text, /[ऀ-ॿ]/, `${intent}/hi is Devanagari`)
      if (style === 'ur') assert.match(line.text, /[؀-ۿ]/, `${intent}/ur is Urdu script`)
      if (style === 'hi' || style === 'ur') assert.ok(line.parts?.[0]?.ur && line.parts[0].hi, `${intent}/${style} speakable`)
    }
  }
})

test('small-talk intents, in English and Roman Hindi / Urdu', () => {
  for (const [t, intent] of [
    ['tell me a joke', 'joke'], ['koi chutkula sunao', 'joke'], ['you are useless', 'roast'], ['bekaar ho tum', 'roast'],
    ['are you human', 'human'], ['i love you ching', 'love'], ["i'm so tired", 'tired'], ['thak gaya yaar', 'tired'],
    ['my boss is angry', 'boss'], ['client wants a discount', 'bargain'], ['chai time', 'chai'], ['do you sleep', 'sleep'],
    ['motivate me', 'motivate'], ['kaise ho', 'how'], ['assalamu alaikum', 'greet'], ['shukriya', 'thanks'], ['khuda hafiz', 'bye'],
  ]) assert.equal(smalltalkIntent(t), intent, t)
})

test('the assistant answers small talk (with an intent the widget can localize)', () => {
  for (const t of ['tell me a joke', 'you are useless', 'are you human', "i'm so tired", 'my boss is angry', 'chai time', 'kaise ho', 'koi joke sunao']) {
    const a = ask(t)
    assert.equal(a?.type, 'smalltalk', t)
    assert.ok(a.intent, `${t} has an intent`)
  }
})

test('Hindi / Urdu small talk is understood too', () => {
  for (const t of ['आप कैसे हो', 'शुक्रिया', 'آپ کیسے ہیں', 'شکریہ']) {
    assert.equal(ask(t)?.type, 'smalltalk', t)
  }
})

test('trip sentences are never taken for small talk', () => {
  for (const t of [
    'add tea garden visit on day 2', 'make gulmarg 2 nights', 'trip for Rahul 3 nights in srinagar, tired of waiting',
    'chai break on day 3', 'add a weather buffer day', 'client wants 2 rooms in gulmarg',
  ]) {
    const a = ask(t)
    assert.ok(!a || a.type !== 'smalltalk', `${t} → ${JSON.stringify(a)}`)
  }
})

test('Hinglish stock replies', () => {
  assert.equal(hinglishReply("Done! Rahul's trip is filled in. Total comes to ₹45,000."), 'Ho gaya! Rahul ka trip taiyaar hai. Total ₹45,000 ban raha hai.')
  assert.equal(hinglishReply('Still need client phone and client email.'), 'Abhi bhi chahiye: client phone aur client email.')
  assert.equal(hinglishReply('Updated. Gulmarg: 1 → 2 nights'), 'Ho gaya. Gulmarg: 1 → 2 nights')
  assert.equal(hinglishReply('Something brand new.'), 'Something brand new.')
})

test('Hinglish / Hindi / Urdu fills land in the right fields', () => {
  let c = fill('customer Atif Aslam ke liye 10 november se 2 raat srinagar lalit aur 1 raat gulmarg khyber, chaar log ki family, teen bade baaki bachche, innova')
  assert.deepEqual([c.clientName, c.adults, c.children, c.startDate, c.nights, c.vehicleId], ['Atif Aslam', 3, 1, '2026-11-10', 3, 1])
  assert.deepEqual(c.stays.map((s) => [s.nights, s.hotelId]), [[2, 4], [1, 5]])
  c = fill('shah ke liye trip banao 12 nov se 14 nov tak srinagar, phone 9876543210')
  assert.deepEqual([c.clientName, c.startDate, c.nights, c.clientPhone], ['Shah', '2026-11-12', 2, '+919876543210'])
  c = fill('राहुल के लिए 10 नवंबर से 14 नवंबर तक श्रीनगर')
  assert.deepEqual([c.clientName, c.startDate, c.nights], ['Rahul', '2026-11-10', 4])
  c = fill('راہل کے لیے 10 نومبر سے دو رات سرینگر للت')
  assert.deepEqual(c.stays.map((s) => [s.nights, s.hotelId]), [[2, 4]])
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
