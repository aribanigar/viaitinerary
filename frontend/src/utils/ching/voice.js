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

/** Say `text` (replacing anything Ching was saying). Resolves when done. */
export function speak(text) {
  return new Promise((resolve) => {
    const say = spoken(text);
    if (!supported() || !voiceEnabled() || !say) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
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
  });
}

export function stopSpeaking() {
  if (supported()) window.speechSynthesis.cancel();
  if (speaking) setSpeaking(false);
}
