// Ching trip-edit helpers: dates, formatting, lookups. Pure JS (no React/DOM).
import { destinationActivityLabels } from '../destinationActivities.js'

const pad = (n) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function realDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${pad(m)}-${pad(d)}`
}

/** "YYYY-MM-DD" | "DD-MM-YYYY" | ISO string | Date -> "YYYY-MM-DD" ("" when unreadable). */
export function normDate(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return realDate(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)
  if (m) return realDate(+m[3], +m[2], +m[1])
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const utc = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** "YYYY-MM-DD" + n calendar days. */
export function addDays(ymd, n) {
  if (!ymd) return ymd
  const dt = new Date(utc(ymd) + n * 86400000)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Whole days from a to b (b - a). NaN when either is missing. */
export function diffDays(a, b) {
  if (!a || !b) return NaN
  return Math.round((utc(b) - utc(a)) / 86400000)
}

const dm = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

/** "12 Nov" (or "12 Nov 2026"). */
export function fmtDay(ymd, withYear = false) {
  if (!ymd) return ''
  const { y, m, d } = dm(ymd)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** "12–14 Nov", "30 Nov–2 Dec", "30 Dec 2026–2 Jan 2027" (optionally with the year). */
export function fmtRange(a, b, withYear = false) {
  if (!a || !b) return ''
  const A = dm(a)
  const B = dm(b)
  const yr = withYear ? ` ${B.y}` : ''
  if (A.y === B.y && A.m === B.m) return `${A.d}–${B.d} ${MONTHS[B.m - 1]}${yr}`
  if (A.y === B.y) return `${A.d} ${MONTHS[A.m - 1]}–${B.d} ${MONTHS[B.m - 1]}${yr}`
  return `${A.d} ${MONTHS[A.m - 1]} ${A.y}–${B.d} ${MONTHS[B.m - 1]} ${B.y}`
}

export const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

let seq = 0
/** Numeric id > 1e9 — the builder treats these as unsaved rows. Unique per process. */
export const newId = () => Date.now() + ++seq

export const sameName = (a, b) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

export const toInt = (v) => {
  if (v === '' || v == null) return NaN
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

export const isCancelled = (acc) => !!(acc?.cancelled || acc?.cancelledAt || acc?.cancelled_at)

export const nightsOf = (acc) => diffDays(acc?.checkIn, acc?.checkOut)

/** Non-cancelled accommodations sorted by check-in (stable) — EditContext stay order. */
export function getStays(accommodations) {
  return (accommodations || [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a && !isCancelled(a))
    .sort((x, y) => {
      const a = normDate(x.a.checkIn)
      const b = normDate(y.a.checkIn)
      if (a === b) return x.i - y.i
      if (!a) return 1
      if (!b) return -1
      return a < b ? -1 : 1
    })
    .map(({ a }) => a)
}

/** Itinerary sorted by day number (stable; unnumbered days keep their place at the end). */
export function sortDays(itinerary) {
  return (itinerary || [])
    .map((d, i) => ({ d, i, n: Number(d?.day) }))
    .sort((x, y) => {
      const a = Number.isFinite(x.n) ? x.n : Infinity
      const b = Number.isFinite(y.n) ? y.n : Infinity
      return a === b ? x.i - y.i : a - b
    })
    .map(({ d }) => d)
}

const DAY_PREFIX = /^\s*Day\s*\d+\s*[:\-–—.]\s*/i
export const hasDayPrefix = (title) => DAY_PREFIX.test(String(title || ''))
export const stripDayPrefix = (title) => String(title || '').replace(DAY_PREFIX, '')

/** A day's plan lines (`activities` is the source of truth; falls back to `description`). */
export function dayLines(day) {
  if (Array.isArray(day?.activities)) return day.activities.map((a) => String(a)).filter((a) => a.trim() !== '')
  return String(day?.description || '')
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean)
}

export function setLines(day, lines) {
  day.activities = lines
  day.description = lines.join('\n')
}

export const LEISURE_LINE = 'Day at leisure'

export const findDestination = (catalog, city) =>
  (catalog?.destinations || []).find((d) => sameName(d.name, city)) || null

/** Default sightseeing lines for a city from the catalog destination (may be empty). */
export const cityLines = (catalog, city) => destinationActivityLabels(findDestination(catalog, city)?.activities)

export const sameLines = (a, b) => a.length === b.length && a.every((x, i) => sameName(x, b[i]))

export function findById(list, id) {
  if (id == null || id === '') return null
  return (list || []).find((x) => String(x.id) === String(id)) || null
}

export function findByName(list, name) {
  if (!name) return null
  const items = list || []
  return (
    items.find((x) => sameName(x.name, name)) ||
    items.find((x) => String(x.name || '').toLowerCase().includes(String(name).trim().toLowerCase())) ||
    null
  )
}

export const MEAL_PLANS = ['Only Room', 'Only Room + Breakfast', 'Breakfast + Dinner', 'Breakfast + Lunch + Dinner']
