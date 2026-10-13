// What people say vs. what they mean. Pure, no imports — the speech layer
// (components/ching/useSpeech.js) runs every transcript through this before
// Ching parses it or shows it.
//
// stripFillers(text) drops hesitation sounds ("umm", "emm", "ahh", "ehe",
// "uh", "hmm", "er"), "you know", and stutters ("the the hotel" → "the
// hotel", "in in Gulmarg" → "in Gulmarg"). It never touches real words, so
// "Pahalgam", "Ahmed" or "Emm Resort" survive (the match is whole-word only,
// and a filler right before a capitalised name the agent typed is kept).
//
// endOfTurnDelay(text) — how long to wait in silence before deciding the
// agent has finished, the rule-based version of the "semantic endpointing"
// real voice agents use: a sentence that sounds unfinished ("…stay in",
// "…and", "…for 2", "…umm") gets a long wait; a finished one a short wait.

// Hesitation sounds, including stretched spellings the recogniser produces
// ("ummmm", "ahhh", "hmmm", "errr", "eheh").
const FILLER_WORD =
  /^(?:u+h*m+|u+h+|a+h+|a+h+m+|e+h+(?:e+h*)?|e+h*m+|e+r+m*|h+m+|m+h*m+|mhm+|uh-?huh|huh)$/i;

const FILLER_PHRASES = [/\byou know\b,?/gi];

// Hindi / Urdu hesitation sounds as the recogniser writes them.
const SCRIPT_FILLER = /^(?:अं+|उ+म+्?म*|हम्+|ह्म+|आ+ह?|एह|उह|अह|ام+|اں+|ہمم+|آں+|اہ)$/
const isFiller = (w) => {
  const t = w.replace(/[.,!?…।]+$/g, "");
  return FILLER_WORD.test(t) || SCRIPT_FILLER.test(t);
};

export function stripFillers(text) {
  let s = String(text || "");
  for (const re of FILLER_PHRASES) s = s.replace(re, " ");
  const words = s.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i += 1) {
    const raw = words[i];
    // "Emm Resort": a capitalised filler-like word inside a name is a name.
    const inName = i > 0 && /^[A-Z]/.test(raw) && /^[A-Z]/.test(words[i + 1] || "") && !/[.,!?]$/.test(raw);
    if (isFiller(raw) && !inName) {
      // Keep the sentence punctuation the filler carried ("umm," → ",").
      const punct = raw.match(/[.,!?]+$/);
      if (punct && out.length && !/[.,!?]$/.test(out[out.length - 1])) out[out.length - 1] += punct[0][0];
      continue;
    }
    const prev = out[out.length - 1];
    // Stutter: the same word twice in a row (not numbers — "2 2" can be real).
    if (prev && !/\d/.test(raw) && prev.replace(/[.,!?]+$/, "").toLowerCase() === raw.replace(/[.,!?]+$/, "").toLowerCase() && !/[.,!?]$/.test(prev)) {
      out[out.length - 1] = raw;
      continue;
    }
    out.push(raw);
  }
  return out
    .join(" ")
    .replace(/^[\s,.]+/, "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,{2,}/g, ",")
    .trim();
}

// Words a sentence can't end on: the agent is still thinking. Only words that
// need something after them — "4 nights", "3 adults", "5 days", "the hotel"
// are finished sentences, and waiting on them made every trip request lag.
const DANGLING =
  /\b(?:and|or|with|in|at|to|for|from|of|the|a|an|then|also|but|because|plus|by|on|after|before|until|till|via|is|are|will|would|should|want|need|named|called|under|around|about|between|like|my|his|her|their|our|this|that|some|per|each|starting|arriving|staying|book|add|make|set|change|replace|put|use|include|excluding|including)\s*[,]?$/i;
const ENDS_WITH_NUMBER = /(?:\b\d+|[\u0966-\u096F\u06F0-\u06F9]+)\s*[,]?$/;
// Hindi / Urdu sentences end on the verb; one ending on "and / of / in / from /
// to / for" (और, के, में, से, तक, लिए / اور، کے، میں، سے، تک، لیے) isn't finished.
const SCRIPT_DANGLING = /(?:^|\s)(?:और|के|की|का|में|से|तक|लिए|लिये|को|पर|फिर|साथ|اور|کے|کی|کا|میں|سے|تک|لیے|لئے|کو|پر|پھر|ساتھ|aur|ke|ki|ka|mein|se|tak|liye|ko|par|phir|saath)\s*[,،]?$/;
const ENDS_WITH_COMMA = /,\s*$/;
const TRAILING_FILLER = /\b(?:u+h*m+|u+h+|a+h+|e+h+|e+h*m+|e+r+m*|h+m+)[\s.,…]*$/i;

// How long Ching waits after the last thing it heard before taking the turn.
// TURN_MS: the recognizer is still working on the phrase (interim text).
// TURN_FINAL_MS: the recognizer itself has closed the phrase — it already
// heard a pause — so only a short beat more is needed, like a person would.
export const TURN_MS = {
  thinking: 3500, // trailing "umm" / "and" / "in" — clearly mid-thought
  number: 2200, // "for 2" … "nights" probably follows
  normal: 1800, // looks complete
  short: 1300, // a short complete request ("open the ledger")
  complete: 1100, // Ching already knows what to do with it
  silentStart: 8000, // before anything was heard
};
export const TURN_FINAL_MS = {
  thinking: 2500,
  number: 1400,
  normal: 900,
  short: 500,
  complete: 300,
};

/**
 * @param {string} text  what was heard so far (raw, fillers included)
 * @param {{ final?: boolean, complete?: boolean }} [opts]
 *   final — the recognizer has finalised everything heard (a pause was detected)
 *   complete — the caller can already act on the sentence
 */
export function endOfTurnDelay(text, { final = false, complete = false } = {}) {
  const ms = final ? TURN_FINAL_MS : TURN_MS;
  const raw = String(text || "").trim();
  if (!raw) return TURN_MS.silentStart;
  if (TRAILING_FILLER.test(raw)) return ms.thinking;
  const s = stripFillers(raw);
  if (!s) return ms.thinking;
  if (DANGLING.test(s) || ENDS_WITH_COMMA.test(s) || SCRIPT_DANGLING.test(s)) return ms.thinking;
  if (complete) return ms.complete;
  if (ENDS_WITH_NUMBER.test(s)) return ms.number;
  const words = s.split(/\s+/).length;
  return words <= 4 ? ms.short : ms.normal;
}
