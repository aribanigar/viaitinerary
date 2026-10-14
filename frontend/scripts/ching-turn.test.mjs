// How fast Ching takes its turn (components/ching/useSpeech.js), timed with a
// fake recognizer: from the moment the recognizer closes the phrase to the
// moment the command is handed over.
//   node frontend/scripts/ching-turn.test.mjs
import assert from 'node:assert/strict'

// A stand-in for the browser's SpeechRecognition.
class FakeSR {
  static last = null
  constructor() { FakeSR.last = this; this.stopped = false }
  start() { queueMicrotask(() => this.onstart?.()) }
  stop() { this.stopped = true; setTimeout(() => this.onend?.(), 400) } // browsers take a moment to wind down
  abort() {}
  say(text, isFinal) {
    const r = [{ transcript: text }]
    r.isFinal = isFinal
    this.onresult?.({ resultIndex: 0, results: [r] })
  }
}
globalThis.window = { SpeechRecognition: FakeSR }
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
const { SpeechEngine } = await import('../src/components/ching/useSpeech.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Speak `text` (interim words, then the final result) → ms until onCommand.
async function turn(text, { isComplete = null, isLongForm = null, finalise = true } = {}) {
  const engine = new SpeechEngine()
  engine.attached = true
  let got = null
  let at = 0
  engine.setHandlers({ onCommand: (t) => { got = t; at = Date.now() }, isComplete, isLongForm })
  engine.startCommand()
  await sleep(5)
  const rec = FakeSR.last
  const words = text.split(' ')
  for (let i = 1; i < words.length; i++) rec.say(words.slice(0, i).join(' '), false)
  const t0 = Date.now()
  rec.say(text, finalise)
  for (let i = 0; i < 500 && got === null; i++) await sleep(10)
  engine.detach()
  return { got, ms: at - t0 }
}

let pass = 0
let fail = 0
async function test(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (err) {
    fail++
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`)
  }
}
const within = (ms, lo, hi, what) => assert.ok(ms >= lo && ms <= hi, `${what}: ${ms} ms (expected ${lo}–${hi})`)

console.log('Ching turn-taking tests')

await test('a command Ching understands is taken ~0.3 s after the phrase closes', async () => {
  const r = await turn('open the ledger', { isComplete: () => true })
  assert.equal(r.got, 'open the ledger')
  within(r.ms, 250, 450, 'understood command')
})
await test('a finished sentence it cannot judge yet: under a second', async () => {
  const r = await turn('there will be 3 adults and 4 kids travelling on 17th of October for 4 nights 5 days', { isComplete: () => false })
  within(r.ms, 800, 1050, 'finished sentence')
})
await test('a short finished request: about half a second', async () => {
  const r = await turn('make it cheaper')
  within(r.ms, 450, 650, 'short request')
})
await test('an unfinished sentence still gets time to finish', async () => {
  const r = await turn('book 2 nights in', { isComplete: () => true })
  within(r.ms, 2400, 2700, 'dangling sentence')
})
await test('interim text (phrase not closed yet) waits for the recognizer, then hands over', async () => {
  const r = await turn('open the ledger', { finalise: false })
  assert.equal(r.got, 'open the ledger')
  within(r.ms, 1300, 1300 + 450 + 80, 'interim only')
})

await test('a client story (voice note) is not cut in on at a breath', async () => {
  const r = await turn("Hi, so I'm planning to be in Kashmir from the 26th of November until the 30th of November", { isComplete: () => true, isLongForm: () => true })
  within(r.ms, 4400, 4750, 'story pause')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
