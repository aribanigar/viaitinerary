// Ching — what the agent takes back while speaking. Pure JS.
//
// Speech research models a self-correction as
//     reparandum  +  editing term  +  repair
//     "3 nights"     "no wait"        "4 nights"
// The repair replaces the reparandum IN PLACE (so "3 nights in Srinagar, no
// wait, 4 nights" still means 4 nights in Srinagar). We only replace when the
// repair is clearly the same kind of detail as something said before it —
// nights, a date, guests, a name, a hotel — otherwise the words are left alone
// (a bare "no" is usually "no meals", not a correction).
//
//   repairSpeech(text) → { text, cancelled, restarted, ask }
//     cancelled — ended with "stop" / "cancel" / "never mind": apply nothing
//     restarted — "scratch that" / "start over": only what follows counts
//     ask       — something taken back with nothing in its place ("the name
//                 is wrong") → what Ching should ask for: 'clientName' | …

const CANCEL_END = /(?:^|[\s,.;!])(?:(?:no\s+)?(?:stop|cancel)(?:\s+(?:it|that|this|everything))?|never\s*mind|nevermind|forget\s+(?:it|that|about\s+it)|leave\s+it|don'?t\s+do\s+(?:it|that|anything)|abort|ruko|rehne\s+do|chhodo|chodo)[\s.!]*$/i
const RESTART = /\b(?:scratch\s+that|start\s+(?:over|again)|let\s+me\s+start\s+again|from\s+the\s+(?:start|beginning)|reset\s+(?:it|that|everything))\b[\s,.:;-]*/gi
const EDIT_TERM = /\s*,?\s*\b(?:no\s+sorry|no\s+wait|no\s+no|wait\s+no|sorry\s+i\s+mean|sorry|i\s+mean|i\s+meant|actually|rather|correction|make\s+(?:that|it)|change\s+(?:that|it)\s+to|not\s+that|no)\b\s*,?\s*/gi
const NAME_WRONG = /\b(?:(?:the|his|her|my|client'?s?|customer'?s?)\s+)?name\s+(?:is\s+)?(?:wrong|different|incorrect|not\s+(?:right|correct))\b[\s,.]*/i

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const NUM = '(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)'
// Kinds of detail a repair can be, each a pattern matching one mention of it.
const SLOTS = [
  ['nights', new RegExp(`\\b${NUM}\\s+(?:nights?|nites?)\\b`, 'i')],
  ['days', new RegExp(`\\b${NUM}\\s+days?\\b(?!\\s+trip)`, 'i')],
  ['date', new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?|tomorrow|today|day\\s+after\\s+tomorrow|next\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\\b`, 'i')],
  ['adults', new RegExp(`\\b${NUM}\\s+(?:adults?|people|persons?|pax|guests?)\\b`, 'i')],
  ['kids', new RegExp(`\\b${NUM}\\s+(?:kids?|child(?:ren)?|infants?|babies)\\b`, 'i')],
  ['hotel', /\b(?:hotel|resort|stay\s+at)\s+[a-z][a-z']*(?:\s+[a-z][a-z']*){0,3}/i],
  ['name', /\b(?:(?:client|customer)(?:'s)?\s+)?(?:name\s+is|named|called|for\s+(?:mr|mrs|ms|miss)?\.?\s*)\s*[a-z][a-z']*(?:\s+[a-z][a-z']*)?/i],
]

const slotOf = (phrase) => {
  for (const [kind, re] of SLOTS) {
    const m = re.exec(phrase)
    if (m && m.index <= 3) return { kind, text: m[0], re }
  }
  return null
}

/** Last match of `re` in `s` before `limit`. */
function lastBefore(s, re, limit) {
  const g = new RegExp(re.source, 'gi')
  let found = null
  let m
  while ((m = g.exec(s)) && m.index < limit) {
    found = { index: m.index, text: m[0] }
    if (m[0].length === 0) g.lastIndex += 1
  }
  return found
}

export function repairSpeech(input) {
  let text = String(input ?? '').replace(/\s+/g, ' ').trim()
  const out = { text, cancelled: false, restarted: false, ask: null }
  if (!text) return out

  if (CANCEL_END.test(text)) return { ...out, text: '', cancelled: true }

  // "… scratch that, …": only what follows counts.
  let restart = null
  RESTART.lastIndex = 0
  let r
  while ((r = RESTART.exec(text))) restart = r
  if (restart) {
    text = text.slice(restart.index + restart[0].length).trim()
    out.restarted = true
  }

  // "the name is wrong[, it's Amit]".
  const nw = NAME_WRONG.exec(text)
  if (nw) {
    const after = text.slice(nw.index + nw[0].length).replace(/^(?:it'?s|it\s+is|its|the\s+name\s+is|name\s+is|it\s+should\s+be)\s+/i, '')
    const before = text.slice(0, nw.index)
    const word = /^[a-z][a-z']*(?:\s+[a-z][a-z']*)?/i.exec(after)
    if (word && !/^(?:and|then|also|please|ok|okay)$/i.test(word[0])) {
      // Swap the name said earlier for the new one (or add it).
      const old = lastBefore(before, SLOTS.find(([k]) => k === 'name')[1], before.length)
      const fresh = `for ${word[0]}`
      text = old
        ? `${before.slice(0, old.index)}${fresh}${before.slice(old.index + old.text.length)} ${after.slice(word[0].length)}`
        : `${before} ${fresh} ${after.slice(word[0].length)}`
    } else {
      const old = lastBefore(before, SLOTS.find(([k]) => k === 'name')[1], before.length)
      text = old ? `${before.slice(0, old.index)}${before.slice(old.index + old.text.length)} ${after}` : `${before} ${after}`
      out.ask = 'clientName'
    }
  }

  // Inline repairs, one at a time (each changes the text), the latest first.
  for (let guard = 0; guard < 8; guard += 1) {
    const terms = []
    EDIT_TERM.lastIndex = 0
    let t
    while ((t = EDIT_TERM.exec(text))) terms.push({ index: t.index, end: t.index + t[0].length })
    let applied = false
    for (const term of terms.reverse()) {
      const after = text.slice(term.end)
      const slot = slotOf(after)
      if (!slot) continue
      const prev = lastBefore(text, slot.re, term.index)
      if (!prev) continue
      // "no" alone is a correction only when what follows is the same kind of thing.
      text = `${text.slice(0, prev.index)}${slot.text}${text.slice(prev.index + prev.text.length, term.index)} ${after.slice(slot.text.length)}`
      applied = true
      break
    }
    if (!applied) break
  }
  out.text = text.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim()
  return out
}
