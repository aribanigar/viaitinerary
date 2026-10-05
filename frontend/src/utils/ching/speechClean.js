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

// Words a sentence can't end on: the agent is still thinking.
const DANGLING =
  /\b(?:and|or|with|in|at|to|for|from|of|the|a|an|then|also|but|because|plus|by|on|after|before|until|till|via|is|are|will|would|should|want|need|named|called|name|hotel|stay|staying|stays|night|nights|day|days|cab|car|vehicle|meal|plan|budget|under|around|about|between|like|my|his|her|their|our|this|that|some|per|each|price|rate|margin|markup|phone|number|email|client|guest|guests|adults?|kids?|children|child|activity|activities|trip|starting|start|arriving|arrival|departure|book|add|make|set|change|replace|put|use|include|excluding|including)\s*[,]?$/i;
const ENDS_WITH_NUMBER = /(?:\b\d+|[\u0966-\u096F\u06F0-\u06F9]+)\s*[,]?$/;
// Hindi / Urdu sentences end on the verb; one ending on "and / of / in / from /
// to / for" (और, के, में, से, तक, लिए / اور، کے، میں، سے، تک، لیے) isn't finished.
const SCRIPT_DANGLING = /(?:^|\s)(?:और|के|की|का|में|से|तक|लिए|लिये|को|पर|फिर|साथ|اور|کے|کی|کا|میں|سے|تک|لیے|لئے|کو|پر|پھر|ساتھ|aur|ke|ki|ka|mein|se|tak|liye|ko|par|phir|saath)\s*[,،]?$/;
const ENDS_WITH_COMMA = /,\s*$/;
const TRAILING_FILLER = /\b(?:u+h*m+|u+h+|a+h+|e+h+|e+h*m+|e+r+m*|h+m+)[\s.,…]*$/i;

export const TURN_MS = {
  thinking: 7000, // trailing "umm" / "and" / "in" — clearly mid-thought
  number: 4500, // "for 2" … "nights" probably follows
  normal: 3200, // looks complete, but trip requests are long: allow a breath
  short: 2000, // a short complete request ("open the ledger")
  silentStart: 8000, // before anything was heard
};

export function endOfTurnDelay(text) {
  const raw = String(text || "").trim();
  if (!raw) return TURN_MS.silentStart;
  if (TRAILING_FILLER.test(raw)) return TURN_MS.thinking;
  const s = stripFillers(raw);
  if (!s) return TURN_MS.thinking;
  if (DANGLING.test(s) || ENDS_WITH_COMMA.test(s) || SCRIPT_DANGLING.test(s)) return TURN_MS.thinking;
  if (ENDS_WITH_NUMBER.test(s)) return TURN_MS.number;
  const words = s.split(/\s+/).length;
  return words <= 4 ? TURN_MS.short : TURN_MS.normal;
}
