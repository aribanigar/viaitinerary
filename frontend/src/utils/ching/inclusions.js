// Inclusions / exclusions for Ching.
//
// Fill: a new trip starts with the agency's standard lists (Policies page);
// with none set up, sensible lines are written from the trip itself (nights
// and cities, meal plan, cab, activities) so the PDF never goes out with an
// empty "What's included".
//
// Voice: "add airport pickup to inclusions", "flights are not included",
// "remove lunch from inclusions", "move dinner to exclusions", "standard
// inclusions", "clear the exclusions" → INCLUSION actions applied here.
import { MEAL_PLANS } from './parseCommand.js'

const cap = (s) => {
  const t = String(s || '').trim().replace(/\s+/g, ' ').replace(/[.]+$/, '')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const listOf = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '')
const nightsBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000))

/** Meal-plan line for the inclusions (and what that leaves excluded). */
function mealLines(plans) {
  const set = new Set(plans.filter(Boolean))
  const has = (p) => set.has(p)
  if (has(MEAL_PLANS[3])) return { inc: 'All meals daily: breakfast, lunch and dinner', exc: null }
  if (has(MEAL_PLANS[2])) return { inc: 'Daily breakfast and dinner at the hotels', exc: 'Lunch' }
  if (has(MEAL_PLANS[1])) return { inc: 'Daily breakfast at the hotels', exc: 'Lunch and dinner' }
  return { inc: null, exc: set.size ? 'Meals' : null }
}

/**
 * The trip's own lines → { inclusions: [{content}], exclusions: [{content}] }.
 * snapshot: builder state (accommodations, transportation, tripActivities, tripInfo).
 */
export function deriveInclusions(snapshot) {
  const s = snapshot || {}
  const stays = (s.accommodations || []).filter((a) => !a.cancelled)
  const cabs = s.transportation || []
  const acts = s.tripActivities || []
  const inc = []
  const exc = []

  if (stays.length) {
    const nights = stays.reduce((n, a) => n + nightsBetween(a.checkIn, a.checkOut), 0)
    const cities = [...new Set(stays.map((a) => a.city).filter(Boolean))]
    inc.push(`Accommodation for ${nights} night${nights === 1 ? '' : 's'}${cities.length ? ` in ${listOf(cities)}` : ''} on twin sharing`)
  }
  const meals = mealLines(stays.map((a) => a.mealPlan))
  if (meals.inc) inc.push(meals.inc)
  if (cabs.length) {
    const vehicle = cabs.find((t) => t.vehicleType)?.vehicleType
    inc.push(`All transfers and sightseeing by private ${vehicle || 'cab'} as per the itinerary`)
    inc.push('Airport / railway station pickup and drop')
    inc.push('Driver allowance, fuel, tolls and parking')
  }
  acts.forEach((a) => inc.push(`${cap(a.name)}${a.dayNumber ? ` (Day ${a.dayNumber})` : ''}`))
  if (stays.length || cabs.length) inc.push('All applicable taxes on the above services')

  exc.push('Airfare / train fare')
  if (meals.exc) exc.push(meals.exc)
  exc.push('Entry tickets, gondola, pony rides and activities not mentioned in the inclusions')
  exc.push('Personal expenses such as laundry, phone calls, tips and porterage')
  exc.push('Travel insurance')
  exc.push('Anything not mentioned under inclusions')

  return { inclusions: inc.map((content) => ({ content })), exclusions: exc.map((content) => ({ content })) }
}

/** Starting lists for a filled trip: the agency's standard ones, else derived ones. */
export function startingInclusions(snapshot, standard = {}) {
  const std = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : [])
  const derived = deriveInclusions(snapshot)
  const si = std(standard.inclusions)
  const se = std(standard.exclusions)
  return {
    inclusions: si.length ? si.map((content) => ({ content })) : derived.inclusions,
    exclusions: se.length ? se.map((content) => ({ content })) : derived.exclusions,
  }
}

// ---------- voice parsing ----------

const INC = '(?:inclusions?|included|includes|what(?:\'s| is) included)'
const EXC = '(?:exclusions?|excluded|excludes|not included)'

/**
 * One clause → INCLUSION actions or null. Only clauses that name the lists
 * ("inclusion", "exclusion", "is included", "not included") are taken, so
 * "remove the gondola" stays an activity edit.
 */
export function parseInclusionClause(c) {
  const t = String(c || '').toLowerCase().trim()
  if (!/inclu|exclu/.test(t)) return null
  const kindOf = (w) => (/exclu|not included/.test(w) ? 'exclusion' : 'inclusion')
  let m

  // "standard inclusions" / "add the default exclusions" / "reset inclusions"
  if ((m = t.match(new RegExp(`\\b(?:standard|default|usual|normal)\\s+(${INC}|${EXC})|\\breset\\s+(?:the\\s+)?(${INC}|${EXC})`)))) {
    return [{ type: 'INCLUSION', op: 'standard', kind: kindOf(m[1] || m[2]) }]
  }
  // "clear / remove all inclusions"
  if ((m = t.match(/\b(?:clear|empty|remove\s+all|delete\s+all|wipe)\s+(?:the\s+)?(?:all\s+)?(inclusions?|exclusions?)\b/))) {
    return [{ type: 'INCLUSION', op: 'clear', kind: kindOf(m[1]) }]
  }
  // "move X to exclusions"
  if ((m = t.match(/\b(?:move|shift|put)\s+(.+?)\s+(?:to|in|into|under)\s+(?:the\s+)?(inclusions?|exclusions?)\b/))) {
    return [{ type: 'INCLUSION', op: 'add', kind: kindOf(m[2]), text: m[1], move: true }]
  }
  // "remove X from inclusions" / "remove inclusion X"
  if ((m = t.match(/\b(?:remove|delete|drop|take\s+out|take\s+off)\s+(.+?)\s+(?:from|in|out\s+of)\s+(?:the\s+)?(inclusions?|exclusions?)\b/))) {
    return [{ type: 'INCLUSION', op: 'remove', kind: kindOf(m[2]), text: m[1] }]
  }
  if ((m = t.match(/\b(?:remove|delete|drop)\s+(?:the\s+)?(inclusion|exclusion)\s+(?:of\s+|for\s+)?(.+)$/))) {
    return [{ type: 'INCLUSION', op: 'remove', kind: kindOf(m[1]), text: m[2] }]
  }
  // "add X to inclusions" / "add inclusion X" / "inclusion: X"
  if ((m = t.match(/\b(?:add|put|write|include)\s+(.+?)\s+(?:to|in|into|under|as)\s+(?:the\s+)?(?:an?\s+)?(inclusions?|exclusions?)\b/))) {
    return [{ type: 'INCLUSION', op: 'add', kind: kindOf(m[2]), text: m[1] }]
  }
  if ((m = t.match(/\b(?:add\s+(?:an?\s+)?)?(inclusion|exclusion)s?\s*(?::|-|of|for|that says)?\s+(.+)$/))) {
    if (!/^(?:list|lists|section)\b/.test(m[2])) return [{ type: 'INCLUSION', op: 'add', kind: kindOf(m[1]), text: m[2] }]
  }
  // "flights are not included" / "airport pickup is included"
  if ((m = t.match(/^(?:and\s+|also\s+)?(.+?)\s+(?:is|are|will be|should be)\s+(not\s+included|excluded|included)\b/))) {
    return [{ type: 'INCLUSION', op: 'add', kind: kindOf(m[2]), text: m[1], move: true }]
  }
  // "exclude flights" (only with list words around — plain "exclude X" is an activity edit)
  return null
}

const clean = (text) =>
  cap(
    String(text || '')
      .replace(/^(?:the|a|an|that|this)\s+/i, '')
      .replace(/\s+(?:please|also|too)$/i, ''),
  )

/** Best line in `list` for a spoken phrase (share of its words found in the line ≥ min), or -1. */
function findLine(list, phrase, min = 0.5) {
  const want = key(phrase).split(' ').filter((w) => w.length > 2 && !['the', 'and', 'for', 'all'].includes(w))
  if (!want.length) return -1
  let best = -1
  let bestScore = 0
  list.forEach((it, i) => {
    const words = new Set(key(it.content).split(' '))
    const hit = want.filter((w) => words.has(w) || [...words].some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))).length
    const score = hit / want.length
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  return bestScore >= min ? best : -1
}

/** "Lunch and dinner" minus "lunch" → "Dinner" (null when nothing sensible is left). */
function without(line, phrase) {
  const esc = key(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!esc) return null
  const rest = key(line)
    .replace(new RegExp(`\\b${esc}\\b`), ' ')
    .replace(/^\s*(?:and|or)\b|\b(?:and|or)\s*$/g, ' ')
    .replace(/\s+(?:and|or)\s+(?=(?:and|or)\b)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return rest && rest !== key(line) ? cap(rest) : null
}

/** Apply one INCLUSION action to a snapshot (mutates s) → { change?, warning? }. */
export function applyInclusion(s, a, standard = {}) {
  const field = a.kind === 'exclusion' ? 'exclusions' : 'inclusions'
  const other = a.kind === 'exclusion' ? 'inclusions' : 'exclusions'
  const label = a.kind === 'exclusion' ? 'Exclusions' : 'Inclusions'
  s[field] = Array.isArray(s[field]) ? s[field].slice() : []
  s[other] = Array.isArray(s[other]) ? s[other].slice() : []

  if (a.op === 'standard') {
    const std = (a.kind === 'exclusion' ? standard.exclusions : standard.inclusions) || []
    const lines = std.length ? std.map(String) : deriveInclusions(s)[field].map((x) => x.content)
    const have = new Set(s[field].map((x) => key(x.content)))
    const add = lines.filter((l) => l.trim() && !have.has(key(l)))
    s[field].push(...add.map((content) => ({ content })))
    return add.length
      ? { change: `${label}: ${add.length} ${std.length ? 'standard' : 'suggested'} line${add.length === 1 ? '' : 's'} added` }
      : { warning: `${label} already have the standard lines` }
  }
  if (a.op === 'clear') {
    const n = s[field].length
    s[field] = []
    return n ? { change: `${label}: cleared (${n} removed)` } : { warning: `${label} were already empty` }
  }
  if (a.op === 'remove') {
    const i = findLine(s[field], a.text)
    if (i < 0) return { warning: `Couldn't find "${clean(a.text)}" in the ${field}` }
    const [gone] = s[field].splice(i, 1)
    return { change: `${label}: removed “${gone.content}”` }
  }
  // add (optionally moving it out of the other list)
  const text = clean(a.text)
  if (!text) return { warning: `What should I add to the ${field}?` }
  // Already in this list (every word of it)?
  if (findLine(s[field], text, 1) >= 0) return { warning: `“${text}” is already in the ${field}` }
  // Said as "X is included" / "move X": take it out of the other list —
  // the whole line when it is X, else just X out of it ("Lunch and dinner" → "Dinner").
  let moved = ''
  const j = findLine(s[other], text, a.move ? 1 : 2)
  if (j >= 0) {
    const line = s[other][j].content
    const rest = key(line) === key(text) ? null : without(line, text)
    if (rest) s[other][j] = { content: rest }
    else s[other].splice(j, 1)
    moved = line
  }
  s[field].push({ content: text })
  return { change: moved ? `${label}: “${text}” (moved from ${other})` : `${label}: added “${text}”` }
}
