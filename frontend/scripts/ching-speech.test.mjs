// Filler words and end-of-turn timing (utils/ching/speechClean.js):
//   node frontend/scripts/ching-speech.test.mjs
import assert from 'node:assert/strict'
import { stripFillers, endOfTurnDelay, TURN_MS } from '../src/utils/ching/speechClean.js'

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

console.log('Ching speech clean-up tests')

test('hesitation sounds are dropped', () => {
  assert.equal(stripFillers('umm create a trip for uh Rahul, emm 2 adults'), 'create a trip for Rahul, 2 adults')
  assert.equal(stripFillers('ahh book a hotel in Gulmarg ehe for 2 nights hmmm'), 'book a hotel in Gulmarg for 2 nights')
  assert.equal(stripFillers('Errr make it cheaper'), 'make it cheaper')
  assert.equal(stripFillers('ummmm aaah eheh mhm'), '')
})
test('stutters collapse, numbers are kept', () => {
  assert.equal(stripFillers('in in Gulmarg at the the Highlands'), 'in Gulmarg at the Highlands')
  assert.equal(stripFillers('2 2 rooms'), '2 2 rooms')
})
test('"you know" goes; real words and names stay', () => {
  assert.equal(stripFillers('hmm, you know, the cab is Innova'), 'the cab is Innova')
  assert.equal(stripFillers('Pahalgam with Ahmed at Emm Resort, I am here'), 'Pahalgam with Ahmed at Emm Resort, I am here')
  assert.equal(stripFillers('when I say Heaven I mean Heevan Resort'), 'when I say Heaven I mean Heevan Resort')
})
test('an unfinished sentence waits longer than a finished one', () => {
  assert.equal(endOfTurnDelay('create a trip for Rahul and'), TURN_MS.thinking)
  assert.equal(endOfTurnDelay('2 nights in'), TURN_MS.thinking)
  assert.equal(endOfTurnDelay('book the cab umm'), TURN_MS.thinking)
  assert.equal(endOfTurnDelay('starting 5th November,'), TURN_MS.thinking)
  assert.equal(endOfTurnDelay('for 2'), TURN_MS.number)
  assert.equal(endOfTurnDelay('3 nights in Gulmarg at Heevan Resort'), TURN_MS.normal)
  assert.equal(endOfTurnDelay('open the ledger'), TURN_MS.short)
  assert.equal(endOfTurnDelay(''), TURN_MS.silentStart)
  assert.ok(TURN_MS.thinking > TURN_MS.normal && TURN_MS.normal > TURN_MS.short)
})

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
