// Ching — fuzzy name matching (hotels, cities, vehicles).
// Pure JS: no React, no DOM, no imports outside utils/ching.

import { convertNumberWords } from './text.js'

// Words that carry no identity in a hotel name.
const FILLER = new Set(['hotel', 'hotels', 'resort', 'resorts', 'the', 'and', 'n', 'spa', 'by', 'of', 'at', 'in'])

export function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** 1 - normalised edit distance. */
export function levRatio(a, b) {
  const max = Math.max(a.length, b.length)
  return max ? 1 - levenshtein(a, b) / max : 1
}

/** Sørensen–Dice coefficient over character bigrams. */
export function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const grams = new Map()
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2)
    grams.set(g, (grams.get(g) || 0) + 1)
  }
  let hit = 0
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2)
    const c = grams.get(g)
    if (c) {
      hit++
      grams.set(g, c - 1)
    }
  }
  return (2 * hit) / (a.length - 1 + b.length - 1)
}

/** Lowercase, number words -> digits, punctuation stripped, split into tokens. */
export function normTokens(s) {
  return convertNumberWords(String(s ?? '').toLowerCase().replace(/&/g, ' and '))
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export const normKey = (s) => normTokens(s).join(' ')

/** Tokens minus filler words (falls back to the raw tokens when everything is filler). */
export function significantTokens(tokens) {
  const sig = tokens.filter((t) => !FILLER.has(t))
  if (sig.length) return sig
  const noThe = tokens.filter((t) => t !== 'the')
  return noThe.length ? noThe : tokens
}

function tokenSim(a, b) {
  if (a === b) return 1
  if (a.length < 3 || b.length < 3) return 0
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.9
  if (a.length >= 4 && b.length >= 4) {
    const r = levRatio(a, b)
    if (r >= 0.75) return r
  }
  return 0
}

/**
 * Similarity (0..1) between a heard phrase and a catalog name, both as significant tokens.
 * Max of: token coverage (weighted towards the heard words being found) and
 * whole-string bigram Dice (catches split/merged words like "welcome hotel" vs "welcomhotel").
 */
export function nameScore(heard, cand) {
  if (!heard.length || !cand.length) return 0
  const cover = (xs, ys) => xs.reduce((sum, x) => sum + Math.max(...ys.map((y) => tokenSim(x, y))), 0) / xs.length
  const tokenScore = 0.7 * cover(heard, cand) + 0.3 * cover(cand, heard)
  const d = dice(heard.join(''), cand.join(''))
  return Math.max(tokenScore, d * 0.95)
}

/**
 * Rank items by name similarity. `items` are { tokens, ... }. Returns
 * { best, score, confident, runnersUp } where confident means score >= 0.6 and a clear
 * margin over the second best.
 */
export function bestMatch(heardTokens, items, { threshold = 0.6, margin = 0.1 } = {}) {
  const heard = significantTokens(heardTokens)
  const ranked = items
    .map((item) => ({ item, score: nameScore(heard, item.tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  if (!ranked.length) return { best: null, score: 0, confident: false, runnersUp: [] }
  const [top, second] = ranked
  const s2 = second ? second.score : 0
  const confident = top.score >= threshold && (top.score - s2 >= margin || (top.score >= 0.95 && s2 < 0.95))
  return {
    best: top.item,
    score: top.score,
    confident,
    runnersUp: ranked.filter((r) => r.score >= threshold).slice(0, 3).map((r) => r.item),
  }
}
