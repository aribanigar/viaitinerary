// Ching — the agency's own words, to help speech recognition hear them.
//
// The browser's recognizer doesn't know "Khaleel Palace" or "Heevan". Two
// things help, both fed from the agency's catalog:
//  1. Re-ranking: we ask for several guesses (maxAlternatives) and keep the
//     one that contains the most catalog words (exactly, or sounding alike).
//  2. Contextual biasing: where the browser supports it (on-device
//     recognition + SpeechRecognitionPhrase), the names are passed as hints.
// Pure JS (the browser parts live in components/ching/useSpeech.js).

import { soundKey } from './fuzzy.js'

const SKIP = new Set(['hotel', 'hotels', 'resort', 'resorts', 'the', 'and', 'spa', 'inn', 'house', 'stay', 'home'])
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !SKIP.has(w))

/** Catalog (/api/builder/init shape) → { words, sounds, phrases }. */
export function vocabularyFrom(init) {
  const names = [
    ...(init?.hotels || []).map((h) => h?.name),
    ...(init?.hotels || []).map((h) => h?.city),
    ...(init?.destinations || []).map((d) => d?.name),
    ...(init?.vehicles || []).map((v) => v?.name),
    ...(init?.activities || []).map((a) => a?.name),
  ].filter(Boolean)
  const set = new Set()
  names.forEach((n) => words(n).forEach((w) => set.add(w)))
  const sounds = new Set([...set].map(soundKey).filter((k) => k.length >= 3))
  const phrases = [...new Set(names.map((n) => String(n).trim()).filter((n) => n.length >= 3))].slice(0, 300)
  return { words: set, sounds, phrases }
}

/** How many catalog words a transcript contains (sound-alikes count half). */
export function vocabularyScore(text, vocab) {
  if (!vocab?.words?.size) return 0
  let score = 0
  for (const w of words(text)) {
    if (vocab.words.has(w)) score += 1
    else if (vocab.sounds.has(soundKey(w))) score += 0.5
  }
  return score
}

/**
 * The recognizer's guesses for one stretch of speech (most confident first)
 * → the one to use: the first, unless a later guess names clearly more of the
 * agency's hotels / cities ("german residency" vs "jarman residency").
 */
export function pickAlternative(alternatives, vocab) {
  const list = (alternatives || []).filter((t) => typeof t === 'string')
  if (list.length <= 1 || !vocab?.words?.size) return list[0] || ''
  let best = list[0]
  let bestScore = vocabularyScore(best, vocab)
  for (const t of list.slice(1)) {
    const sc = vocabularyScore(t, vocab)
    if (sc >= bestScore + 0.5) {
      best = t
      bestScore = sc
    }
  }
  return best
}
