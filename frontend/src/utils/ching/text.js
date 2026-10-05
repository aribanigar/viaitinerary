// Ching — text helpers shared by the rule-based parser.
// Pure JS: no React, no DOM, no imports outside utils/ching.

export const MONTH_ALT =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec'

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
}
const NINE_ALT = 'one|two|three|four|five|six|seven|eight|nine'
const SMALL_ORD_ALT = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth'
// Longest alternatives first so "seventeen" wins over "seven" etc.
const byLength = (obj) => Object.keys(obj).sort((a, b) => b.length - a.length).join('|')
const UNIT_ALT = byLength(UNITS)
const TENS_ALT = byLength(TENS)
const ORD_ALT = byLength(ORDINALS)
const ORD_EXPR = `(?:(?:twenty|thirty)[\\s-]+(?:${SMALL_ORD_ALT})|${ORD_ALT})`

export function ordinalSuffix(n) {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  if (n % 10 === 1) return 'st'
  if (n % 10 === 2) return 'nd'
  if (n % 10 === 3) return 'rd'
  return 'th'
}

function ordinalWordToNumber(word) {
  const parts = word.split(/[\s-]+/)
  if (parts.length === 2) return TENS[parts[0]] + ORDINALS[parts[1]]
  return ORDINALS[parts[0]]
}

const ordToStr = (word) => {
  const n = ordinalWordToNumber(word)
  return `${n}${ordinalSuffix(n)}`
}

/**
 * Convert spoken numbers to digits: "two nights" -> "2 nights", "twenty one" -> "21",
 * "tenth of november" -> "10th of november", "a child" -> "1 child",
 * "twenty twenty six" -> "2026". Ordinal words are only converted next to a month
 * (or after "on the"/"from the") so phrases like "second hotel" are left alone.
 */
export function convertNumberWords(input) {
  let s = String(input ?? '')
  // Spoken years: "twenty twenty six", "two thousand twenty six".
  s = s.replace(
    new RegExp(`\\b(?:two thousand(?:\\s+and)?|twenty)\\s+twenty[\\s-]+(${NINE_ALT})\\b`, 'g'),
    (m, u) => String(2020 + UNITS[u]),
  )
  s = s.replace(/\b(?:two thousand(?:\s+and)?|twenty)\s+twenty\b/g, '2020')
  // Ordinals next to month names.
  s = s.replace(
    new RegExp(`\\b(${ORD_EXPR})(?=\\s+(?:of\\s+)?(?:the\\s+)?(?:${MONTH_ALT})\\b)`, 'g'),
    (m) => ordToStr(m),
  )
  s = s.replace(
    new RegExp(`\\b((?:${MONTH_ALT})\\s+(?:the\\s+)?)(${ORD_EXPR})\\b`, 'g'),
    (m, pre, o) => pre + ordToStr(o),
  )
  s = s.replace(
    new RegExp(`\\b((?:on|from)\\s+the\\s+)(${ORD_EXPR})\\b`, 'g'),
    (m, pre, o) => pre + ordToStr(o),
  )
  // Cardinals.
  s = s.replace(
    new RegExp(`\\b(${TENS_ALT})(?:[\\s-]+(${NINE_ALT}))?\\b`, 'g'),
    (m, t, u) => String(TENS[t] + (u ? UNITS[u] : 0)),
  )
  s = s.replace(new RegExp(`\\b(${UNIT_ALT})\\b`, 'g'), (m) => String(UNITS[m]))
  // "a couple of nights" -> "2 nights"; "a night", "an adult", "a child" -> 1.
  s = s.replace(/\b(?:a\s+)?couple\s+of\s+(?=(?:nights?|days?)\b)/g, '2 ')
  s = s.replace(
    /\b(?:a|an|single)\s+(?=(?:nights?|days?|adults?|child|children|kids?|infants?|babies|baby|toddlers?|persons?|guests?|people)\b)/g,
    '1 ',
  )
  return s
}

// Wake phrase. At the start of the text the greeting is optional ("ching, create ...");
// anywhere else a greeting is required so words like "chin" aren't mistaken for it.
const WAKE_NAME = "(?:ching(?:'s|s)?|chink?|jing|jin|cheng|chang|cheeng|chingu)"
const GREETING = '(?:hello|hallo|helo|hey|hi|ok|okay|oye)'
const WAKE_START_RE = new RegExp(`^\\s*(?:${GREETING}[\\s,.!-]+)?${WAKE_NAME}\\b[\\s,.!:?-]*`, 'i')
const WAKE_ANY_RE = new RegExp(`\\b${GREETING}[\\s,.!-]+${WAKE_NAME}\\b[\\s,.!:?-]*`, 'i')
// "हेलो चिंग" / "ہیلو چنگ" — Hindi and Urdu speech recognition writes it in script.
const WAKE_SCRIPT_RE = /(?:^|\s)(?:हेलो|हैलो|हलो|हाय|हे|ہیلو|ہائے|ہیلوو)[\s,.!।-]*(?:चिंग|चींग|छिंग|चिन|जिंग|चंग|چنگ|چینگ|جنگ|چِنگ)(?=$|[\s,.!?।:])[\s,.!?।:-]*/

/**
 * Strip the wake phrase ("hello ching", "hey ching", misheard "hello chin"/"hello jing").
 * Returns { text, woke } where text is what follows the wake phrase (or the input
 * unchanged when there is none).
 */
export function stripWakePhrase(input) {
  const s = String(input ?? '')
  const start = s.match(WAKE_START_RE)
  if (start) return { text: s.slice(start[0].length).trim(), woke: true }
  const any = WAKE_ANY_RE.exec(s)
  if (any) return { text: s.slice(any.index + any[0].length).trim(), woke: true }
  const script = WAKE_SCRIPT_RE.exec(s)
  if (script) return { text: s.slice(script.index + script[0].length).trim(), woke: true }
  return { text: s.trim(), woke: false }
}

/**
 * True when the text contains the wake phrase (for hands-free listening).
 * Needs the greeting ("hello/hey … ching"): a bare "ching"/"chin"/"jin" at the
 * start of an overheard sentence is too easy to hit by accident.
 */
export function hasWakePhrase(input) {
  const s = String(input ?? '')
  return WAKE_ANY_RE.test(s) || WAKE_SCRIPT_RE.test(s)
}

export function titleCase(s) {
  return String(s ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Everyday ways of saying trip terms, after number words became digits:
 * "1 week" → "7 nights", Hinglish "2 raat" → "2 nights", "4 din" → "4 days",
 * "Rahul ke liye" → "for Rahul". Lower-case input.
 */
export function normalizeTripWords(s) {
  return String(s || '')
    .replace(/\b(?:a|1)\s+week(?:'s)?\b/g, '7 nights')
    .replace(/\b([2-4])\s+weeks\b/g, (m, n) => `${n * 7} nights`)
    .replace(/\b(\d{1,2})\s+(?:raat|raatein|raaten|rath|nite)\b/g, '$1 nights')
    .replace(/\b(\d{1,2})\s+(?:din|dino)\b/g, '$1 days')
    .replace(/\b([a-z]+(?:\s+[a-z]+)?)\s+(?:ke|ki|ka)\s+(?:liye|liya|lie)\b/g, 'for $1')
    // "day trip to sonamarg on day 2" → "day 2 day trip to sonamarg" (the day-plan form).
    .replace(/\b((?:a\s+)?day\s+(?:trip|excursion)\s+to\s+[a-z]+(?:\s+[a-z]+)?)\s+on\s+(?:the\s+)?day\s+(\d{1,2})\b/g, 'day $2 $1')
}
