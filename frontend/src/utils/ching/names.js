// Ching — cleaning a spoken client name. Pure JS.
//
// People don't say a name cleanly. They frame it ("for the customer Shah",
// "client Atif Aslam client"), pad it ("Atif Aslam sahab", "um Atif uh
// Aslam") and correct themselves. Speech research models a self-correction
// as  reparandum + editing term + repair:  "Atif  [sorry]  Aamir Khan".
//   - "A, not B" / "A and not B"      → A  (B is what it is NOT)
//   - "A sorry/no/I mean/rather B"    → B  (the speaker replaced A)
// Fillers and role words are never part of the name; a name is at most
// three words (first, middle, last).

// Hesitations and discourse markers.
export const DISFLUENCY = new Set([
  'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'ah', 'ahh', 'hmm', 'mm', 'like', 'basically', 'actually',
  'literally', 'so', 'okay', 'ok', 'well', 'right', 'yeah', 'yes', 'please', 'just', 'haan', 'acha', 'achha',
])
// Who the person is, not what they're called.
export const ROLE_WORDS = new Set([
  'customer', 'customers', "customer's", 'client', 'clients', "client's", 'guest', 'guests', 'name', 'named',
  'called', 'is', 'the', 'a', 'an', 'my', 'our', 'his', 'her', 'their', 'whose', 'of', 'person', 'party',
  'passenger', 'traveller', 'traveler', 'lead',
])
// Titles and honorifics (before or after the name).
export const HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mister', 'missus', 'dr', 'doctor', 'prof', 'shri', 'sri', 'smt', 'shrimati',
  'kumari', 'master', 'sir', 'madam', 'maam', "ma'am", 'ji', 'sahab', 'saab', 'saheb', 'sahib', 'bhai',
  'bhaiya', 'didi', 'janab', 'begum', 'mohtarma',
])
// Editing terms: what comes after replaces what came before.
const REPLACE_AFTER = new Set(['sorry', 'no', 'rather', 'correction', 'instead'])
const REPLACE_PHRASES = [['i', 'mean'], ['i', 'meant'], ['no', 'no'], ['sorry', 'i', 'mean'], ['let', 'me', 'correct']]

const strip = (w) => String(w || '').toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/'s$/, '')
const isFiller = (w) => DISFLUENCY.has(w) || ROLE_WORDS.has(w) || HONORIFICS.has(w)

/**
 * Spoken words around a name → the name's words (lower case), or [].
 * cleanNameWords(['shah', 'not', 'customer'])              → ['shah']
 * cleanNameWords(['atif', 'sorry', 'aamir', 'khan'])       → ['aamir', 'khan']
 * cleanNameWords(['client', 'atif', 'aslam', 'client'])    → ['atif', 'aslam']
 */
export function cleanNameWords(input) {
  let words = (Array.isArray(input) ? input : String(input || '').split(/\s+/)).map(strip).filter(Boolean)

  // "A not B": B is what it isn't — keep A.
  const not = words.indexOf('not')
  if (not > 0 && words.slice(0, not).some((w) => !isFiller(w))) words = words.slice(0, not)

  // "A sorry B", "A I mean B", "A no B": the last repair wins.
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const phrase = REPLACE_PHRASES.find((p) => p.every((w, k) => words[i + k] === w))
    const len = phrase ? phrase.length : REPLACE_AFTER.has(words[i]) ? 1 : 0
    if (!len) continue
    const after = words.slice(i + len)
    if (after.some((w) => !isFiller(w) && !REPLACE_AFTER.has(w))) {
      words = after
      break
    }
  }

  const name = words.filter((w) => !isFiller(w) && !REPLACE_AFTER.has(w) && w !== 'not' && /^[a-z][a-z'.-]*$/.test(w) && w.length >= 2)
  return name.slice(0, 3)
}

/** Same, as a display name ("Atif Aslam") or ''. */
export function cleanSpokenName(input) {
  return cleanNameWords(input)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
