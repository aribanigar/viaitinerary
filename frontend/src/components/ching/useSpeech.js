import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
// Same wake-phrase rules as the parser (parseCommand.js re-exports these).
// Imported from text.js directly so the eager bundle doesn't carry the parser.
import { hasWakePhrase, stripWakePhrase } from "../../utils/ching/text.js";
import { stripFillers, endOfTurnDelay, TURN_MS } from "../../utils/ching/speechClean.js";

// Voice layer for Ching, on the browser's Web Speech API (no keys, no server).
//
// Two modes share ONE recognizer slot — `kill()` runs before every spawn and
// detaches the old instance's handlers, so a late `end`/`error` from a
// recognizer we've replaced can never restart anything:
//   • command — capture one request: live interim text, auto-finish after
//     a silence whose length depends on how the sentence ends (endOfTurnDelay:
//     ~2 s after "open the ledger", ~7 s after "…stay in" / "…and" / "umm"),
//     a second tap, or a trailing "done" / "that's it" / "over". Filler
//     sounds ("umm", "ahh", "emm") are stripped from what Ching sees. Browsers that end the session on their own (Android, iOS, pauses)
//     are transparently restarted and the text stitched together.
//   • wake — hands-free: continuous recognition, restarted on `end` and on
//     recoverable errors while enabled and the tab is visible, listening for
//     "Hello Ching". A match switches the same session into command capture;
//     anything said after the wake phrase in the same breath is kept.

const SR =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

const IS_ANDROID =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const LANG = "en-IN";
const FIRST_WORDS_MS = TURN_MS.silentStart; // before anything was heard
const STOP_GRACE_MS = 1500; // wait this long for `end` after stop()

// Spoken end-of-command markers ("... breakfast and dinner, done").
const END_RE =
  /[\s,.]*\b(?:done|that'?s it|that is it|over(?: and out)?)[\s.!]*$/i;

const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
]);

const ERROR_TEXT = {
  "not-allowed":
    "Microphone access is blocked. Allow the mic for this site (the icon in the address bar), then try again — or type your request below.",
  "service-not-allowed":
    "Speech recognition isn't available here. On iPhone/iPad turn on Dictation (Settings → General → Keyboard). You can type your request below.",
  "audio-capture": "No microphone was found. Plug one in, or type below.",
  network:
    "Couldn't reach the speech service (network). Check your connection, or type below.",
  "language-not-supported":
    "This browser can't recognise English (India) speech. Type your request below.",
  "no-speech":
    "I didn't hear anything. Tap the mic and try again, or type below.",
  // Audio arrived but no words were recognised.
  "no-words":
    "I heard sound but couldn't make out any words. Speak a little closer to the mic, or type below.",
  // The recognizer ran but the mic never delivered audio: muted, the wrong
  // device selected, or another app (Zoom, Meet, WhatsApp) holding it.
  "mic-silent":
    "Your microphone didn't send any sound. Check it isn't muted or in use by another app (Zoom, Meet, WhatsApp), and that the browser is using the right mic (the icon in the address bar → microphone). Or type below.",
  "mic-start":
    "The microphone couldn't start. Close other tabs or apps using the mic and try again, or type below.",
  unsupported:
    "Voice isn't supported in this browser (try Chrome or Safari). Type your request below.",
};

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Join text from two recognition sessions. Some engines (Android Chrome)
// re-send everything so far, so a session that already starts with the
// earlier text replaces it instead of repeating it.
function joinText(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a) return b;
  if (!b) return a;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (lb.startsWith(la)) return b;
  if (la.endsWith(lb)) return a;
  return `${a} ${b}`;
}

// ── Beep (WebAudio oscillator, no asset files) ────────────────────────────
let audioCtx = null;

export function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

export function beep() {
  try {
    const ctx = primeAudio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    [
      [660, 0],
      [990, 0.09],
    ].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.13);
    });
  } catch {
    // Sound is a nicety — never let it break listening.
  }
}

// ── Engine (plain class; the hook below exposes it to React) ─────────────
const freshCommand = (extra = {}) => ({
  committed: "", // text from earlier sessions of this same command
  session: "", // text of the current recognizer session
  baseIndex: 0, // first result index belonging to the command
  fromWake: false, // strip the wake phrase from the session text
  heard: false,
  audio: false, // the mic delivered audio (audiostart)
  sound: false, // some sound was detected (soundstart)
  finishing: false,
  cancelled: false,
  beepOnStart: false,
  restarts: 0,
  ...extra,
});

class SpeechEngine {
  constructor() {
    this.supported = Boolean(SR);
    this.state = {
      supported: this.supported,
      phase: "idle", // "idle" | "wake" | "command"
      interim: "",
      error: "",
      errorCode: "",
      wakeBlocked: false,
    };
    this.listeners = new Set();
    this.handlers = { onCommand: null, onWake: null, onStart: null, onAbort: null };
    this.rec = null;
    this.recMode = null; // mode of this.rec: "wake" | "command" | null
    this.cmd = freshCommand();
    this.wakeEnabled = false;
    this.paused = false;
    this.attached = false;
    this.lang = LANG;
    this.lastError = null;
    this.timers = {};
    this.wakeBackoff = 0;
    this.sessionStartedAt = 0;
    this.onVisibility = this.onVisibility.bind(this);
  }

  // external-store plumbing
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resumeWake(0);
  }

  detach() {
    this.attached = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearTimer("resume");
    this.reset();
    this.set({ phase: "idle", interim: "" });
  }

  hidden() {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  }

  clearTimer(name) {
    if (this.timers[name]) {
      clearTimeout(this.timers[name]);
      this.timers[name] = null;
    }
  }

  // Abort the current recognizer (if any) without letting its events through.
  kill() {
    const rec = this.rec;
    this.rec = null;
    if (!rec) return;
    rec.onstart = rec.onresult = rec.onerror = rec.onend = rec.onaudiostart = rec.onsoundstart = null;
    try {
      rec.abort();
    } catch {
      // already stopped
    }
  }

  // Stop everything belonging to the current command/wake session.
  reset() {
    this.clearTimer("silence");
    this.clearTimer("stopGuard");
    this.clearTimer("respawn");
    this.kill();
    this.recMode = null;
  }

  spawn(mode) {
    if (!this.supported || !this.attached) return false;
    this.kill();
    let rec;
    try {
      rec = new SR();
    } catch {
      return false;
    }
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Android's continuous mode re-sends earlier text in every result; single
    // utterances + our own restart/stitching are more reliable there.
    rec.continuous = !IS_ANDROID;
    rec.onstart = () => {
      if (rec !== this.rec) return;
      this.sessionStartedAt = Date.now();
      if (this.recMode === "command" && this.cmd.beepOnStart) {
        this.cmd.beepOnStart = false;
        beep();
      }
    };
    rec.onaudiostart = () => {
      if (rec === this.rec && this.recMode === "command") this.cmd.audio = true;
    };
    rec.onsoundstart = () => {
      if (rec === this.rec && this.recMode === "command") this.cmd.sound = true;
    };
    rec.onresult = (e) => {
      if (rec !== this.rec) return;
      this.wakeBackoff = 0;
      if (this.recMode === "wake") this.onWakeResult(e);
      else this.onCommandResult(e);
    };
    rec.onerror = (e) => {
      if (rec !== this.rec) return;
      this.onError(e?.error || "unknown");
    };
    rec.onend = () => {
      if (rec !== this.rec) return;
      this.rec = null;
      this.onEnd();
    };
    this.rec = rec;
    this.recMode = mode;
    this.lastError = null;
    try {
      rec.start();
      return true;
    } catch {
      this.rec = null;
      return false;
    }
  }

  // ── command capture ────────────────────────────────────────────────────
  startCommand() {
    if (!this.supported) {
      this.set({ error: ERROR_TEXT.unsupported, errorCode: "unsupported" });
      return;
    }
    if (this.state.phase === "command") return;
    primeAudio();
    this.clearTimer("resume");
    this.cmd = freshCommand({ beepOnStart: true });
    this.set({ phase: "command", interim: "", error: "", errorCode: "" });
    this.handlers.onStart?.();
    if (!this.spawn("command")) {
      // Chrome can refuse while the previous recognizer is still tearing down.
      this.recMode = "command";
      this.timers.respawn = setTimeout(() => {
        this.timers.respawn = null;
        const c = this.cmd;
        if (this.state.phase !== "command" || this.rec || c.finishing || c.cancelled) return;
        if (!this.spawn("command")) {
          this.set({ error: ERROR_TEXT["mic-start"], errorCode: "mic-start" });
          this.deliver();
        }
      }, 300);
    }
    this.armSilence(FIRST_WORDS_MS);
  }

  finishCommand() {
    if (this.state.phase !== "command" || this.cmd.finishing) return;
    this.cmd.finishing = true;
    this.clearTimer("silence");
    if (this.rec) {
      try {
        this.rec.stop(); // flushes pending interim results as final, then `end`
      } catch {
        this.deliver();
        return;
      }
      this.timers.stopGuard = setTimeout(() => this.deliver(), STOP_GRACE_MS);
    } else {
      this.deliver();
    }
  }

  cancelCommand() {
    if (this.state.phase !== "command") return;
    this.cmd.cancelled = true;
    this.reset();
    this.set({ phase: "idle", interim: "" });
    this.handlers.onAbort?.();
    this.resumeWake(400);
  }

  toggleCommand() {
    if (this.state.phase === "command") this.finishCommand();
    else this.startCommand();
  }

  armSilence(ms) {
    this.clearTimer("silence");
    this.timers.silence = setTimeout(() => this.finishCommand(), ms);
  }

  currentText() {
    return joinText(this.cmd.committed, this.cmd.session);
  }

  onCommandResult(e) {
    const parts = [];
    for (let i = this.cmd.baseIndex; i < e.results.length; i += 1) {
      parts.push(e.results[i][0]?.transcript || "");
    }
    let text = norm(parts.join(" "));
    if (this.cmd.fromWake) {
      const stripped = stripWakePhrase(text);
      if (stripped.woke) text = norm(stripped.text);
    }
    this.cmd.session = text;
    const raw = this.currentText();
    const full = stripFillers(raw);
    if (raw) this.cmd.heard = true;
    this.set({ interim: full });
    if (this.cmd.finishing) return;

    if (END_RE.test(full)) {
      this.cmd.session = norm(this.cmd.session.replace(END_RE, ""));
      this.cmd.committed = norm(this.cmd.committed.replace(END_RE, ""));
      this.finishCommand();
      return;
    }
    // Wait longer while the sentence sounds unfinished (judged on the raw
    // text, so a trailing "umm" counts as still thinking).
    this.armSilence(this.cmd.heard ? endOfTurnDelay(raw) : FIRST_WORDS_MS);
  }

  deliver() {
    const text = stripFillers(norm(this.currentText().replace(END_RE, "")));
    const { cancelled } = this.cmd;
    this.reset();
    this.finishWith(cancelled ? null : text);
  }

  finishWith(text) {
    this.set({ phase: "idle", interim: "" });
    if (text) {
      this.handlers.onCommand?.(text);
    } else {
      if (text === "" && this.state.errorCode === "") {
        // Say which of the three it was, so the agent knows what to fix.
        const code = !this.cmd.audio ? "mic-silent" : this.cmd.sound ? "no-words" : "no-speech";
        this.set({ error: ERROR_TEXT[code], errorCode: code });
      }
      this.handlers.onAbort?.();
    }
    this.resumeWake(600);
  }

  // ── wake ("Hello Ching") ────────────────────────────────────────────────
  setWakeEnabled(on) {
    on = Boolean(on) && this.supported;
    if (on === this.wakeEnabled && !(on && this.state.wakeBlocked)) return;
    this.wakeEnabled = on;
    if (on) {
      this.wakeBackoff = 0;
      if (this.state.wakeBlocked) this.set({ wakeBlocked: false });
      this.resumeWake(0);
    } else {
      this.stopWake();
    }
  }

  stopWake() {
    this.clearTimer("resume");
    if (this.recMode === "wake") this.reset();
    if (this.state.phase === "wake") this.set({ phase: "idle" });
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) this.stopWake();
    else this.resumeWake(300);
  }

  canWake() {
    return (
      this.supported &&
      this.attached &&
      this.wakeEnabled &&
      !this.paused &&
      !this.state.wakeBlocked &&
      !this.hidden() &&
      this.state.phase !== "command"
    );
  }

  resumeWake(delay) {
    this.clearTimer("resume");
    if (!this.canWake()) return;
    const run = () => {
      this.timers.resume = null;
      if (this.recMode) return;
      if (!this.canWake()) {
        if (this.state.phase === "wake") this.set({ phase: "idle" });
        return;
      }
      if (this.spawn("wake")) {
        this.set({ phase: "wake" });
      } else {
        this.wakeBackoff = Math.min(8000, (this.wakeBackoff || 500) * 2);
        this.resumeWake(this.wakeBackoff);
      }
    };
    if (!delay) run();
    else this.timers.resume = setTimeout(run, delay);
  }

  onWakeResult(e) {
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const t = e.results[i][0]?.transcript || "";
      if (!hasWakePhrase(t)) continue;
      // Same recognizer carries on as the command capture — no audio gap.
      this.recMode = "command";
      this.cmd = freshCommand({ baseIndex: i, fromWake: true, audio: true, sound: true }); // the mic is already live
      beep();
      this.set({ phase: "command", interim: "", error: "", errorCode: "" });
      this.handlers.onWake?.();
      this.handlers.onStart?.();
      this.onCommandResult(e);
      return;
    }
  }

  onVisibility() {
    if (this.hidden()) {
      this.clearTimer("resume");
      if (this.state.phase === "wake") {
        this.stopWake();
      } else if (this.state.phase === "command") {
        if (this.cmd.heard) this.finishCommand();
        else this.cancelCommand();
      }
    } else {
      this.wakeBackoff = 0;
      this.resumeWake(300);
    }
  }

  // ── errors / end ───────────────────────────────────────────────────────
  onError(code) {
    this.lastError = code;
    if (code === "language-not-supported" && this.lang !== "en-US") {
      this.lang = "en-US"; // retry once with plain English on the next spawn
      this.lastError = "retry-lang";
      return;
    }
    if (FATAL_ERRORS.has(code)) {
      this.set({
        error: ERROR_TEXT[code] || ERROR_TEXT["not-allowed"],
        errorCode: code,
        wakeBlocked: true,
      });
      return;
    }
    if (this.recMode === "command") {
      if (code === "no-speech" && !this.cmd.heard) this.cmd.finishing = true;
      if (code === "network") {
        this.set({ error: ERROR_TEXT.network, errorCode: code });
        this.cmd.finishing = true;
      }
    }
    // "aborted", "no-speech" in wake mode, etc. — `end` follows and decides.
  }

  onEnd() {
    const err = this.lastError;
    this.lastError = null;
    const mode = this.recMode;

    if (err && FATAL_ERRORS.has(err)) {
      this.reset();
      this.set({ phase: "idle", interim: "" });
      if (mode === "command") this.handlers.onAbort?.();
      return;
    }

    if (mode === "command") {
      if (this.cmd.finishing || this.cmd.cancelled) {
        this.deliver();
        return;
      }
      // The browser ended the session by itself (pause, Android single-shot,
      // iOS). Keep what we have and listen on until our silence timer fires.
      this.cmd.committed = this.currentText();
      this.cmd.session = "";
      this.cmd.baseIndex = 0;
      this.cmd.fromWake = false;
      this.cmd.restarts += 1;
      const limit = this.cmd.heard ? 30 : 4;
      if (this.cmd.restarts > limit || !this.spawn("command")) this.deliver();
      return;
    }

    if (mode === "wake") {
      this.recMode = null;
      const quick = Date.now() - this.sessionStartedAt < 1500;
      if (quick || err === "network") {
        this.wakeBackoff = Math.min(8000, (this.wakeBackoff || 250) * 2);
      }
      // Stay in "wake" through the brief restart gap so the UI doesn't flicker.
      if (!this.canWake()) this.set({ phase: "idle" });
      this.resumeWake(this.wakeBackoff || 150);
    }
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  clearError() {
    if (this.state.error) this.set({ error: "", errorCode: "" });
  }
}

/**
 * useSpeech({ handsFree, paused, onCommand, onWake, onStart, onAbort })
 *   handsFree — keep a "Hello Ching" wake listener running
 *   paused    — temporarily stop the wake listener (e.g. while building)
 *   onCommand(text) — a finished command transcript
 *   onWake()  — the wake phrase was heard (command capture has started)
 *   onStart() — command capture started (tap, Alt+C or after the wake phrase)
 *   onAbort() — command capture ended with nothing to deliver (cancelled,
 *               silence, or a mic error); onCommand is not called then
 * `interim` is the running transcript of the current command (every final
 * segment so far + the current interim, wake phrase stripped) while
 * phase === "command"; it resets to "" when the capture ends.
 * Returns { supported, phase, interim, error, errorCode, wakeBlocked,
 *   startCommand, finishCommand, cancelCommand, toggleCommand,
 *   setWakeEnabled, clearError }.
 */
export default function useSpeech({
  handsFree = false,
  paused = false,
  onCommand,
  onWake,
  onStart,
  onAbort,
} = {}) {
  const [engine] = useState(() => new SpeechEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  useEffect(() => {
    engine.setHandlers({ onCommand, onWake, onStart, onAbort });
  }, [engine, onCommand, onWake, onStart, onAbort]);

  useEffect(() => {
    engine.attach();
    return () => engine.detach();
  }, [engine]);

  useEffect(() => {
    engine.setWakeEnabled(handsFree);
  }, [engine, handsFree]);

  useEffect(() => {
    engine.setPaused(paused);
  }, [engine, paused]);

  // Stable identities, so callers can list them as effect dependencies.
  const actions = useMemo(
    () => ({
      startCommand: () => engine.startCommand(),
      finishCommand: () => engine.finishCommand(),
      cancelCommand: () => engine.cancelCommand(),
      toggleCommand: () => engine.toggleCommand(),
      setWakeEnabled: (on) => engine.setWakeEnabled(on),
      clearError: () => engine.clearError(),
    }),
    [engine],
  );

  return { ...state, ...actions };
}
