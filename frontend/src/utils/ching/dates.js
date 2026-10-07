// Ching — start-date extraction for the rule-based parser.
// Pure JS: no React, no DOM, no imports outside utils/ching.

import { MONTH_ALT } from './text.js'

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
const START_WORDS =
  /\b(?:start|starting|starts|from|on|date|departure|depart|departing|arrival|arriving|arrive|travel|travelling|traveling|check\s*in|checkin|beginning|begin|commencing)\b/

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar date -> "YYYY-MM-DD". */
export function toIsoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Date | "YYYY-MM-DD" | undefined -> Date at local midnight (invalid/absent -> now). */
export function toLocalMidnight(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate())
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [y, m, d] = v.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

function makeDate(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

/** Strict "YYYY-MM-DD" that is a real calendar date. */
export function isValidIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return !!makeDate(y, m, d)
}

function fullYear(y) {
  if (y == null || y === '') return null
  const n = Number(String(y).replace("'", ''))
  return n < 100 ? 2000 + n : n
}

/** No year given -> next occurrence on/after today. */
function nextOccurrence(m, d, today) {
  const y = today.getFullYear()
  for (let add = 0; add <= 4; add++) {
    const dt = makeDate(y + add, m, d)
    if (dt && dt >= today) return dt
  }
  return null
}

const addDays = (base, n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n)

/**
 * Find the trip start date in (lowercased, number-words-converted) text.
 * Returns { iso, index, length, notes: string[] } or null. When several dates are present
 * the first one preceded by a start-ish word ("starting", "from", "on", "date"...) wins,
 * otherwise the first one in the text.
 */
export function extractDate(s, todayInput) {
  const today = toLocalMidnight(todayInput)
  const cands = []
  const add = (m, dt, notes = []) => {
    if (dt) cands.push({ index: m.index, length: m[0].length, date: dt, notes })
  }
  const each = (re, fn) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(s))) fn(m)
  }

  // ISO: 2026-11-10
  each(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m) => add(m, makeDate(+m[1], +m[2], +m[3])))

  // Numeric, DAY first: 10/11/2026, 10-11-2026, 10.11.26, 10/11 (slash only when no year)
  each(/(?<![\d-])(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\d/.-]*\d)/g, (m) => {
    const [, a, sep, b, y] = m
    if (!y && sep !== '/') return
    const d = +a
    const mo = +b
    if (y) {
      const yr = fullYear(y)
      let dt = makeDate(yr, mo, d)
      const notes = []
      if (!dt && makeDate(yr, d, mo)) {
        dt = makeDate(yr, d, mo)
        notes.push(`Read "${m[0]}" as month/day because ${mo} isn't a month`)
      }
      add(m, dt, notes)
    } else {
      add(m, nextOccurrence(mo, d, today))
    }
  })

  // Spoken all-numeric with a full year: "10 11 2026" (day first)
  each(/\b(\d{1,2})\s+(\d{1,2})\s+(20\d{2})\b/g, (m) => add(m, makeDate(+m[3], +m[2], +m[1])))

  // 10 november 2026 / 10th of nov / 10-nov-26
  each(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s/-]*(?:of\\s+)?(?:the\\s+)?(${MONTH_ALT})\\b\\.?(?:[\\s,/-]*(\\d{4}|'\\d{2})\\b)?`,
      'g',
    ),
    (m) => {
      const mo = MONTHS[m[2].slice(0, 3)]
      const d = +m[1]
      add(m, m[3] ? makeDate(fullYear(m[3]), mo, d) : nextOccurrence(mo, d, today))
    },
  )

  // november 10 2026 / nov 10th, 2026 / november the 10th
  each(
    new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4})\\b)?`, 'g'),
    (m) => {
      const mo = MONTHS[m[1].slice(0, 3)]
      const d = +m[2]
      add(m, m[3] ? makeDate(+m[3], mo, d) : nextOccurrence(mo, d, today))
    },
  )

  // on the 10th / from the 10th (no month) -> next such day of month
  each(new RegExp(`\\b(?:on|from)\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\b(?!\\s+(?:of\\s+)?(?:${MONTH_ALT})\\b)`, 'g'), (m) => {
    const d = +m[1]
    for (let k = 0; k < 13; k++) {
      const base = new Date(today.getFullYear(), today.getMonth() + k, 1)
      const dt = makeDate(base.getFullYear(), base.getMonth() + 1, d)
      if (dt && dt >= today) return add(m, dt)
    }
  })

  // Relative days
  each(/\bday\s+after\s+(?:tomorrow|tommorow|tomorow)\b/g, (m) => add(m, addDays(today, 2)))
  each(/\b(?:tomorrow|tommorow|tomorow|tmrw|tmr)\b/g, (m) => {
    if (/after\s+$/.test(s.slice(Math.max(0, m.index - 7), m.index))) return
    add(m, addDays(today, 1))
  })
  each(/\btoday\b/g, (m) => add(m, today))
  each(/\b(?:(?:next|this|coming)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, (m) => {
    const target = WEEKDAYS[m[1]]
    let diff = (target - today.getDay() + 7) % 7
    if (diff === 0) diff = 7
    add(m, addDays(today, diff))
  })

  if (!cands.length) return null
  // Drop candidates contained in a longer one.
  const kept = cands.filter(
    (c) => !cands.some((o) => o !== c && o.length > c.length && o.index <= c.index && o.index + o.length >= c.index + c.length),
  )
  kept.forEach((c) => {
    c.keyword = START_WORDS.test(s.slice(Math.max(0, c.index - 30), c.index))
  })
  kept.sort((a, b) => (a.keyword === b.keyword ? a.index - b.index : a.keyword ? -1 : 1))
  const best = kept[0]
  const notes = [...best.notes]
  if (best.date < today) notes.push(`Start date ${toIsoDate(best.date)} is in the past`)
  return { iso: toIsoDate(best.date), index: best.index, length: best.length, notes }
}

const ORD = '(?:st|nd|rd|th)?'
const RANGE_TO = '(?:to|till|until|upto|up\\s+to|through|thru|-|–)'
const RANGE_RES = [
  // (from) 10th (of november) to 14th (of) november (2026)
  new RegExp(
    `\\b(?:(?:from|between)\\s+(?:the\\s+)?)?(\\d{1,2})${ORD}(?:\\s+(?:of\\s+)?(${MONTH_ALT}))?\\s*(?:${RANGE_TO}|(?<=between\\s+\\S+(?:\\s+\\S+){0,2}\\s+)and)\\s*(?:the\\s+)?(\\d{1,2})${ORD}\\s+(?:of\\s+)?(${MONTH_ALT})\\b(?:[\\s,]*(\\d{4}))?`,
    'g',
  ),
  // (from) november 10 to (november) 14 (2026)
  new RegExp(
    `\\b(?:(?:from|between)\\s+)?(${MONTH_ALT})\\s+(?:the\\s+)?(\\d{1,2})${ORD}\\s*(?:${RANGE_TO}|and)\\s*(?:(${MONTH_ALT})\\s+)?(?:the\\s+)?(\\d{1,2})${ORD}\\b(?:[\\s,]*(\\d{4}))?`,
    'g',
  ),
]

/**
 * A stay window: "from 10th to 14th november", "10 nov to 14 nov 2026",
 * "november 10 to 14", "between 10 and 14 november". The nights are the gap.
 * Returns { iso, endIso, nights, index, length, notes } or null.
 */
export function extractDateRange(s, todayInput) {
  const today = toLocalMidnight(todayInput)
  for (const [k, re] of RANGE_RES.entries()) {
    re.lastIndex = 0
    const m = re.exec(s)
    if (!m) continue
    let d1, m1, d2, m2, y
    if (k === 0) {
      ;[d1, m1, d2, m2, y] = [+m[1], m[2], +m[3], m[4], m[5]]
      if (/\band\s/.test(m[0]) && !/\bbetween\b/.test(m[0])) continue
    } else {
      ;[m1, d1, m2, d2, y] = [m[1], +m[2], m[3], +m[4], m[5]]
      if (/\band\s/.test(m[0]) && !/\bbetween\b/.test(m[0])) continue
    }
    const mo2 = MONTHS[(m2 || m1).slice(0, 3)]
    let mo1 = m1 ? MONTHS[m1.slice(0, 3)] : mo2
    if (!m1 && d1 > d2) mo1 = mo2 === 1 ? 12 : mo2 - 1 // "28th to 3rd december" → 28 Nov
    let start
    if (y) {
      const yr = fullYear(y)
      start = makeDate(mo1 > mo2 ? yr - 1 : yr, mo1, d1)
    } else {
      start = nextOccurrence(mo1, d1, today)
    }
    if (!start) continue
    let end = makeDate(start.getFullYear(), mo2, d2)
    if (end && end <= start) end = makeDate(start.getFullYear() + 1, mo2, d2)
    if (!end) continue
    const nights = Math.round((end - start) / 86400000)
    if (nights < 1 || nights > 60) continue
    const notes = start < today ? [`Start date ${toIsoDate(start)} is in the past`] : []
    return { iso: toIsoDate(start), endIso: toIsoDate(end), nights, index: m.index, length: m[0].length, notes }
  }
  return null
}
