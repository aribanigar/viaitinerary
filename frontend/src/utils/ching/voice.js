// Ching's spoken replies — the browser's own speech synthesis (no API keys).
// Prefers an Indian-English voice, then any English one. While Ching speaks,
// the widget pauses hands-free listening so Ching doesn't hear itself.

const KEY = "ching_voice";
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export const voiceSupported = supported;

export function voiceEnabled() {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setVoiceEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Blocked storage — the choice just isn't remembered.
  }
  if (!on) stopSpeaking();
}

let chosen = null;
function pickVoice() {
  if (chosen) return chosen;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const score = (v) =>
    (/en-IN/i.test(v.lang) ? 40 : /^en/i.test(v.lang) ? 20 : 0) +
    (/female|veena|heera|neerja|google|natural|samantha|zira|aria|jenny/i.test(v.name) ? 10 : 0) +
    (v.localService ? 2 : 0);
  chosen = voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
  return chosen;
}
if (supported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    chosen = null;
  };
}

const listeners = new Set();
let speaking = false;
const setSpeaking = (v) => {
  speaking = v;
  listeners.forEach((fn) => fn(v));
};
export const isSpeaking = () => speaking;
export function onSpeakingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Speech reads better without emoji, ₹ signs and markdown-ish quotes.
const spoken = (text) =>
  String(text || "")
    .replace(/₹\s?([\d,]+)/g, (_, n) => `${n.replace(/,/g, "")} rupees`)
    .replace(/[“”"]/g, "")
    .replace(/\s+·\s+/g, ", ")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .trim();

// A voice for Urdu replies: an Urdu one, else a Hindi one (spoken Urdu and
// Hindi are one language — the reply carries its words in Devanagari too).
let speechTurn = 0;
function voiceFor(prefix) {
  const voices = window.speechSynthesis.getVoices() || [];
  const all = voices.filter((v) => new RegExp(`^${prefix}`, "i").test(v.lang));
  const score = (v) => (/google|natural|online/i.test(v.name) ? 10 : 0) + (v.localService ? 1 : 0);
  return all.sort((a, b) => score(b) - score(a))[0] || null;
}

/**
 * Say an Urdu reply (utils/ching/replyUrdu.js `urduReply`): Urdu sentences in
 * an Urdu voice, or a Hindi voice reading the same words, and the bits that
 * stay English (names, change lists) in Ching's English voice. No Urdu or
 * Hindi voice in this browser → the English reply.
 */
function speakUrdu(urdu, english, resolve) {
  // Android Chrome often lists no voices at all (they load late): then ask
  // for Urdu by language and let the phone's own speech engine pick it.
  const listed = (window.speechSynthesis.getVoices() || []).length > 0;
  const ur = voiceFor("ur") || (listed ? null : { lang: "ur-PK", unlisted: true });
  const hi = ur ? null : voiceFor("hi");
  if (!ur && !hi) {
    speakText(english, resolve);
    return;
  }
  const en = pickVoice();
  const synth = window.speechSynthesis;
  synth.cancel();
  const queue = urdu.parts
    .map((p) => (p.ur ? { text: ur ? p.ur : p.hi, voice: ur || hi } : { text: spoken(p.en), voice: en }))
    .filter((q) => q.text);
  if (!queue.length) {
    resolve();
    return;
  }
  let finished = false;
  const turn = ++speechTurn;
  const done = () => {
    if (finished) return;
    finished = true;
    if (turn === speechTurn) setSpeaking(false);
    resolve();
  };
  setSpeaking(true);
  queue.forEach((q, i) => {
    const u = new SpeechSynthesisUtterance(q.text);
    if (q.voice?.unlisted) u.lang = q.voice.lang;
    else if (q.voice) {
      u.voice = q.voice;
      u.lang = q.voice.lang;
    } else u.lang = "en-IN";
    u.rate = q.voice === en ? 1.04 : 0.98;
    if (i === queue.length - 1) {
      u.onend = done;
      u.onerror = done;
    }
    synth.speak(u);
  });
  const chars = queue.reduce((n, q) => n + q.text.length, 0);
  setTimeout(done, Math.min(30000, 3000 + chars * 85));
}

/**
 * Say `text` (replacing anything Ching was saying). Resolves when done.
 * `{ urdu }` — the same reply in Urdu (`urduReply(text)`), when the agent spoke Urdu.
 */
export function speak(text, { urdu = null } = {}) {
  return new Promise((resolve) => {
    if (!supported() || !voiceEnabled() || !String(text || "").trim()) {
      resolve();
      return;
    }
    if (urdu?.parts?.length) speakUrdu(urdu, text, resolve);
    else speakText(text, resolve);
  });
}

function speakText(text, resolve) {
  const say = spoken(text);
  if (!say) {
    resolve();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  speechTurn++;
  const u = new SpeechSynthesisUtterance(say);
  const v = pickVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    u.lang = "en-IN";
  }
  u.rate = 1.04;
  u.pitch = 1.05;
  const done = () => {
    setSpeaking(false);
    resolve();
  };
  u.onend = done;
  u.onerror = done;
  setSpeaking(true);
  synth.speak(u);
  // Some browsers never fire onend for long text; don't block listening forever.
  setTimeout(() => speaking && done(), Math.min(20000, 2500 + say.length * 75));
}

// Phones (iOS Safari above all) only let a page speak once speech has been
// started from a tap. Ching answers a moment after the agent stops talking —
// outside that tap — so the mic tap unlocks it with a silent utterance.
let unlocked = false;
export function unlockSpeech() {
  if (unlocked || !supported()) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    unlocked = false;
  }
}

export function stopSpeaking() {
  if (supported()) window.speechSynthesis.cancel();
  if (speaking) setSpeaking(false);
}

// The language Ching listens in: English (India), Hindi or Urdu. Whatever is
// heard is turned into Ching's English commands (utils/ching/language.js).
const LANG_KEY = "ching_lang";
export const CHING_LANGS = [
  { code: "en-IN", short: "EN", label: "English" },
  { code: "hi-IN", short: "हिं", label: "हिन्दी (Hindi)" },
  { code: "ur-PK", short: "اردو", label: "اردو (Urdu)" },
];
export function chingLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return CHING_LANGS.some((l) => l.code === v) ? v : "en-IN";
  } catch {
    return "en-IN";
  }
}
export function setChingLang(code) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {
    // Blocked storage — the choice just isn't remembered.
  }
}
