// node frontend/scripts/plan-window.test.mjs
import assert from 'node:assert/strict'
import { getPlanWindow, isWithinPlanWindow, describeOutOfWindow, warnIfOutsidePlan } from '../src/utils/planWindow.js'
const w = getPlanWindow('2026-10-10', '5')
assert.deepEqual(w, { start: '2026-10-10', end: '2026-10-15' })
assert.equal(isWithinPlanWindow('2026-10-10', w), true)
assert.equal(isWithinPlanWindow('2026-10-15', w), true)
assert.equal(isWithinPlanWindow('2026-10-16', w), false)
assert.equal(isWithinPlanWindow('2026-10-09', w), false)
assert.equal(isWithinPlanWindow('', w), true)
assert.equal(getPlanWindow('', '3'), null)
assert.equal(describeOutOfWindow('2026-10-16', w), '16 Oct is after your 6-day plan (10 Oct - 15 Oct). You can still save it, but check the date.')
assert.match(describeOutOfWindow('2026-10-09', w), /^9 Oct is before/)
const said = []
warnIfOutsidePlan('2026-10-20', { startDate: '2026-10-10', duration: '5' }, (m) => said.push(m))
warnIfOutsidePlan('2026-10-12', { startDate: '2026-10-10', duration: '5' }, (m) => said.push(m))
warnIfOutsidePlan('2026-10-20', { startDate: '', duration: '5' }, (m) => said.push(m))
assert.equal(said.length, 1)
console.log('plan-window: all checks passed')
