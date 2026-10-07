import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, X } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
  getChingEditor,
  subscribeChingEditor,
  useChingEditor,
} from "../../utils/ching/editorBridge";
import lazyWithReload, {
  reloadOnceForStaleChunks,
} from "../../utils/lazyWithReload";
import { stripFillers } from "../../utils/ching/speechClean.js";
import { toEnglishCommand, scriptOf } from "../../utils/ching/language.js";
import { urduReply } from "../../utils/ching/replyUrdu.js";
import useSpeech, { primeAudio } from "./useSpeech";
import { fetchTrips } from "../../api/trips";
import {
  understandAssistant,
  replyAfter,
  notUnderstood,
  navigatingTo,
  pendingReply,
  pendingLine,
} from "../../utils/ching/assistant";
import { handleAssist } from "./assistActions";
import { loadChingMemory, getChingMemory } from "../../utils/ching/memoryStore";
import { draftSpeech } from "../../utils/ching/tripDraft";
import { vocabularyFrom } from "../../utils/ching/vocabulary";
import { chingSaid, setChingListening, setChingStage, setChingUnderstanding } from "../../utils/ching/chingBus";
import {
  speak,
  stopSpeaking,
  voiceEnabled,
  setVoiceEnabled,
  onSpeakingChange,
  chingLang,
  setChingLang,
  CHING_LANGS,
} from "../../utils/ching/voice";

// Ching — voice trip builder, always mounted on portal routes (App.jsx), so it
// survives route changes mid-sentence.
//
// LIVE MODE: while the agent speaks, the running transcript is streamed to the
// open Trip Builder's editor (editorBridge.js → editor.live.begin / update /
// finish / cancel), which fills or edits the form as the words arrive. There
// are no confirmation cards: at the end of the utterance the result collapses
// to a small "Filled the trip · Undo" pill and the agent saves/exports as
// usual. A new-trip request heard anywhere else (or over a trip that already
// has content) opens a fresh draft Trip Builder and fills that instead.
//
// Other code can open Ching with:
//   window.dispatchEvent(new CustomEvent("ching:open", { detail: { listen: true } }))

const ChingPanel = lazyWithReload(() => import("./ChingPanel"));

const loadCore = () =>
  import("./chingCore").catch((err) => {
    if (reloadOnceForStaleChunks()) return new Promise(() => {});
    throw err;
  });

const HANDSFREE_KEY = "ching_handsfree";
const LIVE_THROTTLE_MS = 250;
const DRAFT_TIMEOUT_MS = 15000;

const readHandsFree = () => {
  try {
    return localStorage.getItem(HANDSFREE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeHandsFree = (on) => {
  try {
    localStorage.setItem(HANDSFREE_KEY, on ? "1" : "0");
  } catch {
    // Blocked storage — the toggle just won't be remembered.
  }
};

const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
// A fresh draft opens where the agent is working: the AI Assistant's own live
// builder when they're there, else the Trip Builder.
const newDraftPath = () => {
  const d = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const onAssistant = typeof window !== "undefined" && window.location.pathname.startsWith("/assistant");
  return onAssistant ? `/assistant?d=${d}` : `/trip-builder?d=${d}`;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The order a trip is built in, shown tab by tab after Confirm & Build.
const BUILD_STEPS = ["Trip Info", "Itinerary", "Logistics", "Pricing"];

// Command actions (EXPORT_PDF / EXPORT_EXCEL / EMAIL_ME / SEND_PROPOSAL / SEND_PAYMENT_LINK /
// SEND_REMINDER / SAVE / UNDO) against the open Trip
// Builder, in order. Resolves to the result lines; throws on the first failure.
async function runEditorCommands(commands, editor, setProgress) {
  const lines = [];
  for (const c of commands) {
    if (c.type === "UNDO") {
      const label = editor.undo();
      const line = label ? `Undone: ${label}` : "Nothing to undo";
      toast.info(line);
      lines.push(line);
    } else if (c.type === "EXPORT_PDF") {
      setProgress("Preparing the PDF…");
      await editor.exportPdf();
      toast.success("PDF downloaded");
      lines.push("PDF downloaded");
    } else if (c.type === "EMAIL_ME") {
      setProgress("Emailing the PDF…");
      const res = await editor.emailMe();
      const line = `PDF emailed to ${res?.to || "you"}`;
      toast.success(line);
      lines.push(line);
    } else if (c.type === "SEND_PROPOSAL") {
      setProgress(c.channel === "email" ? "Emailing the proposal to the client…" : "Preparing the approval link…");
      const res = await editor.sendProposal(c.channel);
      toast.success(res.message);
      lines.push(res.message);
    } else if (c.type === "EXPORT_EXCEL") {
      setProgress("Preparing the Excel quotation…");
      await editor.exportExcel();
      toast.success("Excel quotation downloaded");
      lines.push("Excel quotation downloaded");
    } else if (c.type === "SEND_PAYMENT_LINK") {
      setProgress(c.channel === "email" ? "Emailing the payment link…" : "Preparing the payment link…");
      const res = await editor.sendPaymentLink(c.channel);
      toast.success(res.message);
      lines.push(res.message);
    } else if (c.type === "SEND_REMINDER") {
      setProgress("Sending the reminder…");
      const res = await editor.sendReminder(c.kind, c.channel);
      toast.success(res.message);
      lines.push(res.message);
    } else if (c.type === "SAVE") {
      setProgress("Saving the trip…");
      const ok = await editor.save();
      if (ok === false) throw new Error("Couldn't save the trip.");
      toast.success("Trip saved");
      lines.push("Trip saved");
    }
  }
  return lines;
}

const PanelFallback = () => (
  <div className="fixed z-[90] inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 lg:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+136px)] lg:bottom-[92px] sm:w-[400px] h-40 rounded-t-[28px] sm:rounded-[24px] bg-white border border-black/5 shadow-2xl grid place-items-center">
    <span className="w-6 h-6 rounded-full border-2 border-[#181c22]/15 border-t-[#181c22] animate-spin" />
  </div>
);

const CLIENT_EMAIL_COMMANDS = new Set(["SEND_PROPOSAL", "SEND_PAYMENT_LINK", "SEND_REMINDER"]);
const CLIENT_EMAIL_LABEL = {
  SEND_PROPOSAL: "proposal",
  SEND_PAYMENT_LINK: "payment link",
  "SEND_REMINDER:payment": "payment reminder",
  "SEND_REMINDER:proposal": "proposal reminder",
};

const EMPTY_LIVE = { phase: "listening", mode: null, changes: [], warnings: [], unrecognized: [] };

export default function ChingWidget() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const editor = useChingEditor();
  const [open, setOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(readHandsFree);
  // The language Ching listens in (English / Hindi / Urdu) — remembered.
  const [listenLang, setListenLang] = useState(chingLang);
  const listenLangRef = useRef(listenLang);
  listenLangRef.current = listenLang;
  const changeLang = useCallback((code) => {
    setChingLang(code);
    setListenLang(code);
    listenLangRef.current = code;
  }, []);
  // Spoken (or typed) in Urdu → Ching answers in Urdu, on screen and aloud.
  const urduTurn = useRef(false);
  const lastPendingSaid = useRef("");
  const chatTopic = useRef(null);
  const noteLanguage = useCallback((raw) => {
    urduTurn.current = scriptOf(raw) === "urdu" || listenLangRef.current === "ur-PK";
  }, []);
  const localized = useCallback((text) => (urduTurn.current && text ? urduReply(text) : null), []);
  const [status, setStatus] = useState("idle"); // idle | running (commands)
  const [init, setInit] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: unknown|no-editor|error, text, unrecognized? }
  // The live session shown in the panel: phase "listening" | "opening" | "finishing".
  const [live, setLive] = useState(null);
  const [outcome, setOutcome] = useState(null); // { title, lines, warnings, unrecognized }
  // A voice-filled new trip waiting on Confirm & Build: { draft, commands }.
  const [tripDraft, setTripDraft] = useState(null);
  const [compact, setCompact] = useState(false); // collapse to the result pill
  const [progress, setProgress] = useState("");
  const [, setUndoTick] = useState(0);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => onSpeakingChange(setSpeaking), []);

  // Ching talks back (when voice replies are on) and shows the same words.
  const say = useCallback(
    (text) => {
      if (!text) return;
      const urdu = localized(text);
      speak(text, { urdu });
      chingSaid("ching", urdu?.text || text);
    },
    [localized],
  );
  const respond = useCallback(
    (text, extra = {}) => {
      setOutcome(null);
      setNotice({ kind: "reply", text: localized(text)?.text || text, ...extra });
      say(text);
    },
    [say, localized],
  );

  // A question Ching asked before doing something that moves money or cancels
  // ("Record ₹20,000 from Rahul by UPI? Say yes or no."): { run }.
  const confirmRef = useRef(null);
  const askConfirm = useCallback(
    (question, run) => {
      confirmRef.current = { run };
      respond(question, { confirm: true });
    },
    [respond],
  );
  const answerConfirm = useCallback(
    async (yes) => {
      const pending = confirmRef.current;
      confirmRef.current = null;
      if (!pending) return;
      if (!yes) {
        if (pending.cancel) pending.cancel();
        else respond("Okay, I won't do that.");
        return;
      }
      try {
        await pending.run();
      } catch (err) {
        respond(`Hmm, that didn't work: ${err?.message || "something went wrong"}.`);
      }
    },
    [respond],
  );

  // The current utterance. Plain object in a ref: speech events, the throttle
  // timer and the draft-opening watcher all mutate it outside React renders.
  //   { text, ended, finalText, editor, baseBlank, navigating, skip, finishing, stopWatch }
  const sessionRef = useRef(null);
  const coreRef = useRef(null);
  const initRef = useRef(null);
  const latestTextRef = useRef("");
  const throttleRef = useRef(null);
  const canUndo = Boolean(safe(() => editor?.canUndo?.(), false));

  const ensureCore = useCallback(
    () =>
      loadCore().then(async (core) => {
        coreRef.current = core;
        loadChingMemory(token); // what Ching has learned / been told (cached, refreshed when stale)
        if (!initRef.current) {
          const data = await core.getInit(token);
          initRef.current = data;
          setInit(data);
        }
        return core;
      }),
    [token],
  );

  // Names Hindi/Urdu speech is matched against: the agency's catalog (and past clients).
  const catalogForLanguage = useCallback(() => ({ ...(initRef.current || {}), memory: getChingMemory() }), []);

  const openPanel = useCallback(() => {
    setOpen(true);
    setCompact(false);
    ensureCore().catch(() => {});
  }, [ensureCore]);

  const runCommands = useCallback(async (commands, ed) => {
    setStatus("running");
    try {
      return await runEditorCommands(commands, ed, setProgress);
    } catch (err) {
      toast.error(err?.message || "Ching couldn't finish that.");
      return null;
    } finally {
      setStatus("idle");
      setProgress("");
      setUndoTick((t) => t + 1);
    }
  }, []);

  // ── live session plumbing ──────────────────────────────────────────────
  const showLive = useCallback((res, phase = "listening") => {
    setLive({
      phase,
      mode: res?.mode || null,
      changes: list(res?.changes),
      warnings: list(res?.warnings),
      unrecognized: list(res?.unrecognized),
      pending: list(res?.pending),
    });
  }, []);

  // Pages like the AI Assistant show what Ching is picking up as it happens.
  useEffect(() => {
    if (live) {
      setChingUnderstanding({ phase: live.phase, changes: live.changes, warnings: live.warnings, unrecognized: live.unrecognized, pending: live.pending });
    } else if (outcome) {
      setChingUnderstanding({ phase: "done", changes: list(outcome.lines), warnings: list(outcome.warnings), unrecognized: list(outcome.unrecognized), pending: [] });
    }
  }, [live, outcome]);

  const endSession = useCallback(() => {
    const S = sessionRef.current;
    S?.stopWatch?.();
    sessionRef.current = null;
    setLive(null);
  }, []);

  const cancelSession = useCallback(() => {
    const S = sessionRef.current;
    if (!S) return;
    if (S.editor && safe(() => S.editor.live.active(), false)) {
      safe(() => S.editor.live.cancel());
    }
    endSession();
  }, [endSession]);

  // Refs to the two mutually recursive steps, so either can call the other.
  const attachRef = useRef(null);
  const finishRef = useRef(null);

  const liveUpdate = useCallback(
    (S, text) => {
      const res = safe(() => S.editor.live.update(text), null);
      if (res) showLive(res);
    },
    [showLive],
  );

  // Open a fresh draft Trip Builder (keeping the recognizer running) and fill
  // it once its editor registers.
  const openDraft = useCallback(
    (S) => {
      const previous = S.editor || getChingEditor();
      if (S.editor && safe(() => S.editor.live.active(), false)) {
        safe(() => S.editor.live.cancel()); // never overwrite the open trip
      }
      S.editor = null;
      S.skip = previous;
      S.navigating = true;
      S.finishing = false;
      const started = Date.now();
      showLive(null, "opening");
      navigate(newDraftPath());

      let iv = null;
      let unsub = null;
      const stop = () => {
        if (iv) clearInterval(iv);
        if (unsub) unsub();
        iv = null;
        unsub = null;
      };
      const tryAttach = () => {
        if (sessionRef.current !== S || !S.navigating) {
          stop();
          return;
        }
        const ed = getChingEditor();
        // A fresh draft is blank. A different editor that isn't blank yet
        // (still loading / restoring) gets 2.5 s before we take it anyway —
        // the editor itself fills the whole form for a full trip request.
        const ready =
          ed &&
          (safe(() => ed.isBlank(), false) ||
            (ed !== S.skip && Date.now() - started > 2500));
        if (ready) {
          stop();
          attachRef.current?.(S, ed);
        } else if (Date.now() - started > DRAFT_TIMEOUT_MS) {
          stop();
          endSession();
          setNotice({ kind: "error", text: "The new trip didn't open in time. Please try again." });
        }
      };
      S.stopWatch = stop;
      unsub = subscribeChingEditor(tryAttach);
      iv = setInterval(tryAttach, 250);
    },
    [endSession, navigate, showLive],
  );

  const attach = useCallback(
    (S, ed) => {
      S.editor = ed;
      S.navigating = false;
      S.baseBlank = safe(() => ed.isBlank(), true);
      safe(() => ed.live.begin());
      if (S.text) liveUpdate(S, S.text);
      else showLive(null);
      if (S.ended) finishRef.current?.(S);
    },
    [liveUpdate, showLive],
  );

  // A new running transcript (throttled while speaking).
  const pump = useCallback(
    (text) => {
      const S = sessionRef.current;
      if (!S || S.ended || !text) return;
      noteLanguage(text);
      text = toEnglishCommand(text, catalogForLanguage()) || text;
      S.text = text;
      if (S.navigating) return;
      const core = coreRef.current;
      if (!S.editor) {
        const ed = getChingEditor();
        if (ed) {
          attach(S, ed);
          return;
        }
        if (core && core.looksLikeTripRequest(text, initRef.current)) openDraft(S);
        return;
      }
      if (!S.baseBlank && core && core.isCreateRequest(text)) {
        openDraft(S);
        return;
      }
      liveUpdate(S, text);
    },
    [attach, liveUpdate, openDraft, catalogForLanguage, noteLanguage],
  );

  // The utterance is over: commit (or decide there was nothing to do).
  const finish = useCallback(
    async (S) => {
      if (S.finishing || S.navigating || sessionRef.current !== S) return;
      S.finishing = true;
      const text = S.finalText || S.text;
      let core = coreRef.current;
      if (!core) core = await ensureCore().catch(() => null);
      if (sessionRef.current !== S) return;

      // The answer to a "yes or no?" Ching just asked.
      if (confirmRef.current) {
        const t = String(text || "").toLowerCase().replace(/^\s*(?:hello |hey )?ching[\s,]*/, "").trim();
        const yes = /^(?:yes|yeah|yep|yup|haan|han|ha|ji|ok|okay|sure|confirm|confirmed|do it|go ahead|correct|right|please do|build(?: it)?|looks good)\b/.test(t);
        const no = /^(?:no|nope|nah|cancel|don't|do not|stop|nahi|na|leave it|never ?mind|forget (?:it|that|about it))\b/.test(t);
        if (yes || no) {
          if (S.editor && safe(() => S.editor.live.active(), false)) safe(() => S.editor.live.cancel());
          endSession();
          await answerConfirm(yes);
          return;
        }
        // Moved on to something else. A pending trip draft stays open: what
        // they said is most likely a correction to it.
        if (!confirmRef.current.draft) confirmRef.current = null;
      }

      // Not a trip at all? ("open the ledger", "what's pending", "tell me a joke")
      const ask = safe(() => understandAssistant(text, { inBuilder: Boolean(S.editor || getChingEditor()), chat: chatTopic.current }), null);
      // Small talk remembers what Ching just asked ("How about you?") for one turn.
      chatTopic.current = ask?.type === "smalltalk" ? ask.topic || null : null;
      if (ask) {
        if (S.editor && safe(() => S.editor.live.active(), false)) safe(() => S.editor.live.cancel());
        endSession();
        await assistRef.current?.(ask);
        return;
      }

      if (!S.editor) {
        const ed = getChingEditor();
        if (ed) {
          S.finishing = false;
          attach(S, ed); // calls finish again
          return;
        }
        if (!core) {
          endSession();
          setNotice({ kind: "error", text: "Ching couldn't load. Check your connection and try again." });
          return;
        }
        const kind = core.classifyWithoutEditor(text, initRef.current);
        if (kind === "trip") {
          openDraft(S); // finishes once the draft's editor appears
          return;
        }
        endSession();
        setNotice({ kind: kind === "edit" ? "no-editor" : "unknown", text });
        say(kind === "edit" ? "Open a trip in the Trip Builder and I'll change it for you." : notUnderstood());
        return;
      }

      if (!S.baseBlank && core && core.isCreateRequest(text)) {
        openDraft(S);
        return;
      }

      const ed = S.editor;
      showLive(null, "finishing");
      let res;
      try {
        res = ed.live.finish(text) || {};
      } catch (err) {
        safe(() => ed.live.cancel());
        endSession();
        toast.error(err?.message || "Ching couldn't update the trip.");
        return;
      }
      endSession();

      const changes = list(res.changes);
      const commands = list(res.commands);
      // A new trip filled by voice: show the draft and wait for Confirm & Build.
      // Commands said with it ("… then export the PDF") run after the confirm.
      if (res.mode === "fill" && res.draft) {
        setUndoTick((t) => t + 1);
        safe(() => ed.setTab("Trip Info")); // step 1, while the agent checks the draft
        setTripDraft({ draft: res.draft, commands });
        setOutcome(null);
        setNotice(null);
        setCompact(false);
        confirmRef.current = { run: () => confirmDraftRef.current?.(), cancel: () => cancelDraftRef.current?.(), draft: true };
        // Read the draft back, with what's still pending once the builder
        // has taken it in ("Still need client phone and client email.").
        const draft = res.draft;
        setTimeout(() => {
          const speech = draftSpeech(draft);
          const left = draft.ok ? pendingLine(list(safe(() => ed.summary().pending, []))) : "";
          say(left ? speech.replace(/ Say “confirm”/, ` ${left} Say “confirm”`) : speech);
        }, 700);
        return;
      }
      // An edit while a draft waits: refresh the card with the corrected trip.
      const pendingDraft = safe(() => ed.draft?.(), null);
      if (pendingDraft) setTripDraft((d) => (d ? { ...d, draft: pendingDraft } : { draft: pendingDraft, commands: [] }));
      // "… no stop", "cancel", "never mind": the trip is left as it was.
      if (res.cancelled) {
        respond("Okay, stopped — nothing was changed.");
        return;
      }
      if (!changes.length && !commands.length) {
        // Understood but nothing to change ("already in the inclusions", "no such hotel"):
        // say why instead of pretending not to understand.
        const why = list(res.warnings);
        if (why.length && !list(res.unrecognized).length) {
          respond(why.slice(0, 2).join(". "));
          return;
        }
        setNotice({ kind: "unknown", text, editing: true, unrecognized: list(res.unrecognized) });
        say(notUnderstood());
        return;
      }
      // An email to the client (proposal, payment link, reminder) goes out only
      // after a "yes" — a misheard sentence must not reach the client's inbox.
      // WhatsApp / copy-link commands only open a link, so they don't ask.
      const emailsClient = commands.filter((c) => CLIENT_EMAIL_COMMANDS.has(c.type) && c.channel === "email");
      if (emailsClient.length) {
        const who = safe(() => ed.summary().clientName, "") || "the client";
        const what = emailsClient.map((c) => CLIENT_EMAIL_LABEL[c.type === "SEND_REMINDER" ? `${c.type}:${c.kind}` : c.type]);
        if (changes.length) {
          setOutcome({ title: res.mode === "fill" ? "Filled the trip" : `Applied ${changes.length} change${changes.length === 1 ? "" : "s"}`, lines: changes, warnings: list(res.warnings), unrecognized: list(res.unrecognized) });
          setUndoTick((t) => t + 1);
        }
        askConfirm(`Email ${who} the ${what.join(" and ")}? Say yes or no.`, async () => {
          const lines = (await runCommands(commands, ed)) || [];
          if (lines.length) respond(`${lines.join(". ")}.`);
        });
        return;
      }
      const lines = commands.length ? (await runCommands(commands, ed)) || [] : [];
      const n = changes.length;
      setOutcome({
        title:
          res.mode === "fill" && n
            ? "Filled the trip"
            : n
              ? `Applied ${n} change${n === 1 ? "" : "s"}`
              : lines[0] || "Done",
        lines: [...changes, ...lines],
        warnings: list(res.warnings),
        unrecognized: list(res.unrecognized),
      });
      setCompact(true); // let the agent see the filled form / preview
      setUndoTick((t) => t + 1);
      // Show where the change landed: hotels / cabs → Logistics, day routes →
      // Itinerary, inclusions / client → Trip Info, margin / GST → Pricing.
      if (changes.length) {
        const all = changes.join("\n");
        const tab =
          res.mode === "fill" || /hotel|stay|night|cab|vehicle|picked for you|room/i.test(all)
            ? "Logistics"
            : /^Day \d+/m.test(all)
              ? "Itinerary"
              : /inclusion|exclusion|client|phone|email/i.test(all)
                ? "Trip Info"
                : /margin|gst/i.test(all)
                  ? "Pricing"
                  : null;
        if (tab) safe(() => ed.setTab(tab));
      }
      // Speak once the builder has re-priced the trip (the total follows the commit).
      setTimeout(() => {
        const sum = safe(() => ed.summary(), null) || {};
        // What's still pending is said after every fill, and after an edit
        // or a save / export / send whenever the list has changed since Ching
        // last read it out (not on every small edit).
        const pendingNow = list(sum.pending);
        const pendingKey = pendingNow.map((p) => p.key).join("|");
        const outgoing = commands.some((c) => /^(?:SAVE|EXPORT_PDF|EXPORT_EXCEL|EMAIL_ME|SEND_PROPOSAL|SEND_PAYMENT_LINK)$/.test(c.type));
        const remind = res.mode === "fill" || (pendingNow.length > 0 && (outgoing || pendingKey !== lastPendingSaid.current));
        if (remind) lastPendingSaid.current = pendingKey;
        const reply = replyAfter({
          mode: res.mode,
          changes,
          pending: pendingNow,
          total: sum.total,
          clientName: sum.clientName,
          commandLines: lines,
          remind,
          outgoing,
        });
        // After a fill, one add-on idea from the catalog (upselling, gently).
        let tip = "";
        if (res.mode === "fill") {
          const first = list(safe(() => ed.addOns(), []))[0];
          if (first?.activities?.[0]) tip = ` Tip: in ${first.city}, ${first.activities[0].name} is a popular add-on — say “add ${first.activities[0].name} on day ${first.day}”.`;
        }
        setOutcome((o) => (o ? { ...o, reply: localized(reply + tip)?.text || reply + tip, pending: list(sum.pending) } : o));
        say(reply + tip);
      }, 700);
    },
    [answerConfirm, askConfirm, attach, endSession, ensureCore, openDraft, runCommands, showLive, say, respond, localized],
  );

  // ── Confirm & Build ─────────────────────────────────────────────────────
  const confirmDraftRef = useRef(null);
  const cancelDraftRef = useRef(null);
  const confirmDraft = useCallback(async () => {
    const ed = getChingEditor();
    const pending = tripDraft;
    if (!ed?.confirmDraft || !pending) return;
    const r = await ed.confirmDraft();
    if (r?.blocked?.length) {
      // Still doesn't add up: say what's wrong, keep the card and the question open.
      setTripDraft((d) => (d ? { ...d, draft: safe(() => ed.draft(), d.draft) || d.draft } : d));
      confirmRef.current = { run: () => confirmDraftRef.current?.(), cancel: () => cancelDraftRef.current?.(), draft: true };
      respond(`I can't build it yet: ${r.blocked[0].text}.`);
      return;
    }
    setTripDraft(null);
    confirmRef.current = null;
    // Build it in the agent's order: Trip Info → Itinerary (a destination a
    // day) → Logistics (hotels, then cabs, by date) → Pricing → the PDF.
    setOutcome({ title: "Building the trip…", lines: [] });
    setCompact(true);
    for (const tab of BUILD_STEPS) {
      setChingStage(tab);
      safe(() => getChingEditor()?.setTab(tab));
      await wait(1300);
    }
    setChingStage("PDF");
    let pdfLine = "";
    try {
      await getChingEditor()?.exportPdf();
      setChingStage("PDF:done");
      pdfLine = " The PDF is in your downloads.";
    } catch {
      setChingStage(null);
      pdfLine = " I couldn't make the PDF — try Export.";
    }
    // The walkthrough already made the PDF; don't make it twice.
    const commands = list(pending.commands).filter((c) => c.type !== "EXPORT_PDF");
    const emailsClient = commands.some((c) => CLIENT_EMAIL_COMMANDS.has(c.type) && c.channel === "email");
    const built =
      (r?.saved
        ? "Built and saved."
        : `Built. Add the client's phone and email so I can save it${commands.length ? ", then ask me again for the rest" : ""}.`) + pdfLine;
    if (commands.length && !emailsClient && r?.saved) {
      const lines = (await runCommands(commands, ed)) || [];
      respond([built, ...lines].join(" "));
    } else {
      respond(built);
      if (emailsClient && r?.saved) {
        const who = safe(() => ed.summary().clientName, "") || "the client";
        askConfirm(`Email ${who} now? Say yes or no.`, async () => {
          const lines = (await runCommands(commands, ed)) || [];
          if (lines.length) respond(`${lines.join(". ")}.`);
        });
      }
    }
    setOutcome({ title: r?.saved ? "Trip built and saved" : "Trip built — add phone & email to save", lines: [] });
    setCompact(true);
    setUndoTick((t) => t + 1);
  }, [askConfirm, respond, runCommands, tripDraft]);
  const cancelDraft = useCallback(() => {
    const ed = getChingEditor();
    safe(() => ed?.cancelDraft?.());
    setTripDraft(null);
    confirmRef.current = null;
    setOutcome(null);
    respond("Cancelled — the trip is back to how it was.");
    setUndoTick((t) => t + 1);
  }, [respond]);
  // "Edit": keep the filled form, tuck Ching away; the draft stays unsaved.
  const editDraft = useCallback(() => {
    setOutcome({ title: "Draft — not saved yet. Tap to review", lines: [] });
    setCompact(true);
  }, []);
  useEffect(() => {
    confirmDraftRef.current = confirmDraft;
    cancelDraftRef.current = cancelDraft;
  }, [confirmDraft, cancelDraft]);
  // Saved by hand (the builder's Save button) or undone: the draft is settled.
  useEffect(() => {
    const settle = () => {
      setTripDraft(null);
      if (confirmRef.current?.draft) confirmRef.current = null;
    };
    window.addEventListener("ching:draft-settled", settle);
    return () => window.removeEventListener("ching:draft-settled", settle);
  }, []);
  // The builder closed or switched trips under a pending draft: drop the card.
  useEffect(() => {
    if (tripDraft && !safe(() => editor?.draft?.(), null)) {
      setTripDraft(null);
      if (confirmRef.current?.draft) confirmRef.current = null;
    }
  }, [editor, tripDraft]);


  // Requests that aren't about building a trip (see utils/ching/assistant.js).
  const assist = useCallback(
    async (ask) => {
      const ed = getChingEditor();
      const handled = await handleAssist(ask, {
        token,
        navigate,
        respond,
        confirm: askConfirm,
        editor: ed,
        init: initRef.current,
        core: () => ensureCore().catch(() => null),
      });
      // An action that changed the trip (a hotel picked by search, a cheaper
      // plan…) — keep a waiting Confirm & Build card in step with it.
      const fresh = safe(() => getChingEditor()?.draft?.(), null);
      if (fresh) setTripDraft((d) => (d ? { ...d, draft: fresh } : d));
      setUndoTick((t) => t + 1);
      if (handled) return;
      if (ask.type === "navigate") {
        navigate(ask.path === "/trip-builder" ? newDraftPath() : ask.path);
        respond(navigatingTo(ask.label));
      } else if (ask.type === "back") {
        navigate(-1);
        respond("Going back.");
      } else if (ask.type === "tab") {
        if (ed) safe(() => ed.setTab(ask.tab));
        const n = list(safe(() => ed?.summary().pending, [])).filter((p) => p.tab === ask.tab).length;
        respond(`Here's ${ask.tab}.${n ? ` ${n} thing${n > 1 ? "s" : ""} still to fill here.` : ""}`);
      } else if (ask.type === "open-trip") {
        try {
          const res = await fetchTrips(token, { search: ask.query, per_page: 5 });
          const trip = list(res?.data)[0];
          if (!trip) {
            respond(`I couldn't find a trip for ${ask.query}. Check the name or trip ID?`);
            return;
          }
          navigate(`/trip-builder/${trip.trip_id}`);
          respond(`Opening ${trip.client_name ? `${trip.client_name}'s ` : ""}${trip.trip_title || trip.trip_id}.`);
        } catch {
          respond("I couldn't search your trips just now. Try again in a moment?");
        }
      } else if (ask.type === "pending") {
        if (!ed) {
          respond("Open a trip and I'll tell you exactly what's missing.");
          return;
        }
        const pending = list(safe(() => ed.summary().pending, []));
        respond(pendingReply(pending), { pending });
      } else if (ask.type === "lang") {
        changeLang(ask.code);
        const name = CHING_LANGS.find((l) => l.code === ask.code)?.label || "English";
        respond(`Okay — I'm listening in ${name} now. Tap the mic and speak.`);
      } else if (ask.type === "profit") {
        const p = ed ? safe(() => ed.summary().profit, null) : null;
        if (!ed) {
          navigate("/accounting-summary");
          respond("Here's your profit and loss. Open a trip and ask again for that trip's profit.");
        } else if (!p) {
          respond("No cost on this trip yet — add hotels, a cab or activities and I'll work out your profit.");
        } else {
          respond(
            `This trip costs you ${p.cost}. At ${p.margin}% margin you make ${p.profit}` +
              (p.gst ? `, plus ${p.gst} GST` : "") +
              ` — the client pays ${p.total}.`,
          );
        }
      } else if (ask.type === "total") {
        const total = ed ? safe(() => ed.summary().total, null) : null;
        respond(total ? `The total is ${total}.` : "No price yet — add hotels or a cab and I'll do the maths.");
      } else if (ask.type === "voice") {
        setVoiceEnabled(ask.on);
        setVoiceOn(ask.on);
        respond(ask.on ? "I'm back! I'll talk again." : "Okay, I'll keep quiet. Say “talk to me” when you miss me.");
      } else if (ask.type === "smalltalk") {
        // Greet by the name the agent asked to be called ("call me Arif").
        const name = getChingMemory()?.callMe;
        respond(name ? ask.reply.replace(/^(Hello|Hi there|Hi|Namaste|Hey|Aadab|Wa alaikum assalam|Good (?:morning|afternoon|evening))!/, `$1, ${name}!`) : ask.reply);
      }
    },
    [askConfirm, changeLang, ensureCore, navigate, respond, token],
  );
  const assistRef = useRef(null);

  useEffect(() => {
    attachRef.current = attach;
    finishRef.current = finish;
    assistRef.current = assist;
  }, [attach, finish, assist]);

  const startSession = useCallback(() => {
    const prev = sessionRef.current;
    if (prev && !prev.finishing) cancelSession();
    const S = { text: "", ended: false, finalText: "", editor: null, baseBlank: true };
    sessionRef.current = S;
    setNotice(null);
    setOutcome(null);
    setCompact(false);
    showLive(null);
    ensureCore().catch(() => {});
    const ed = getChingEditor();
    if (ed) attach(S, ed);
    return S;
  }, [attach, cancelSession, ensureCore, showLive]);

  // ── speech events ──────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    stopSpeaking();
    setOpen(true);
    startSession();
  }, [startSession]);

  const handleCommand = useCallback(
    (said) => {
      // Typed or spoken, "umm"/"ahh"/stutters never reach the parsers, and
      // Hindi / Urdu become Ching's English commands.
      const clean = stripFillers(said) || said;
      noteLanguage(clean);
      const text = toEnglishCommand(clean, catalogForLanguage()) || clean;
      chingSaid("you", clean);
      const S = sessionRef.current || startSession();
      S.ended = true;
      S.text = text;
      S.finalText = text;
      finish(S);
    },
    [finish, startSession, catalogForLanguage, noteLanguage],
  );

  const handleWake = useCallback(() => {
    setNotice(null);
    openPanel();
  }, [openPanel]);

  // The agency's hotel / city / cab names, to help the recognizer hear them.
  const vocabulary = useMemo(() => (init ? vocabularyFrom(init) : null), [init]);
  const speech = useSpeech({
    vocabulary,
    handsFree,
    lang: listenLang,
    paused: status === "running" || speaking, // don't hear our own voice
    onCommand: handleCommand,
    onWake: handleWake,
    onStart: handleStart,
    onAbort: cancelSession,
  });
  const {
    supported,
    phase,
    interim,
    startCommand,
    toggleCommand,
    cancelCommand,
    setWakeEnabled,
  } = speech;
  const listening = phase === "command";
  // Pages that show Ching (the AI Assistant) follow the mic and transcript.
  useEffect(() => {
    setChingListening(listening, listening ? interim || "" : "");
  }, [listening, interim]);

  // Stream the running transcript to the editor, at most every 250 ms.
  useEffect(() => {
    if (phase !== "command" || !interim) return;
    latestTextRef.current = interim;
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      pump(latestTextRef.current);
    }, LIVE_THROTTLE_MS);
  }, [phase, interim, pump]);

  useEffect(
    () => () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
    },
    [],
  );

  // Typed input = one finished utterance.
  const handleTyped = useCallback(
    (raw) => {
      const text = String(raw || "").trim();
      if (!text || status === "running") return;
      primeAudio(); // the send tap lets a phone speak the reply
      if (listening) cancelCommand();
      startSession();
      handleCommand(text);
    },
    [cancelCommand, handleCommand, listening, startSession, status],
  );

  const closePanel = useCallback(() => {
    stopSpeaking();
    cancelCommand();
    cancelSession();
    setOpen(false);
  }, [cancelCommand, cancelSession]);

  const toggleHandsFree = useCallback(() => {
    const next = !handsFree;
    if (next) primeAudio(); // unlock audio inside the tap, for the beep later
    setHandsFree(next);
    writeHandsFree(next);
    setWakeEnabled(next); // start inside the tap too (iOS wants a gesture)
  }, [handsFree, setWakeEnabled]);

  const handleUndo = useCallback(() => {
    const ed = getChingEditor();
    if (!ed) return;
    const label = safe(() => ed.undo(), null);
    toast.info(label ? `Undone: ${label}` : "Nothing to undo");
    if (!safe(() => ed.draft?.(), null)) {
      setTripDraft(null);
      if (confirmRef.current?.draft) confirmRef.current = null;
    }
    if (label) setOutcome((o) => (o ? { ...o, title: `Undone: ${label}` } : o));
    setUndoTick((t) => t + 1);
  }, []);

  const handleFab = () => {
    if (open) {
      closePanel();
      return;
    }
    openPanel();
    if (supported && status === "idle") startCommand();
  };

  // Alt+C / ⌥C toggles listening; Esc stops listening (restoring the trip), then closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        e.preventDefault();
        if (!open) openPanel();
        if (supported && status !== "running") toggleCommand();
        return;
      }
      if (e.key === "Escape" && (open || listening)) {
        if (listening) cancelCommand();
        else if (sessionRef.current) cancelSession();
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, listening, supported, status, openPanel, toggleCommand, cancelCommand, cancelSession]);

  // The AI Assistant page's own message box sends typed requests here.
  useEffect(() => {
    const onSubmit = (e) => {
      const text = String(e?.detail?.text || "").trim();
      if (!text) return;
      openPanel();
      handleTyped(text);
    };
    window.addEventListener("ching:submit", onSubmit);
    return () => window.removeEventListener("ching:submit", onSubmit);
  }, [handleTyped, openPanel]);

  // Anything in the app can open Ching (e.g. the Assistant page's mic).
  useEffect(() => {
    const onOpen = (e) => {
      openPanel();
      if (e?.detail?.listen && supported && status === "idle") startCommand();
    };
    window.addEventListener("ching:open", onOpen);
    return () => window.removeEventListener("ching:open", onOpen);
  }, [openPanel, startCommand, supported, status]);

  return (
    <>
      <button
        type="button"
        onClick={handleFab}
        aria-label={open ? "Close Ching" : "Talk to Ching (Alt+C)"}
        title={
          open
            ? "Close Ching"
            : editor
              ? "Ching — fill or edit this trip by voice (Alt+C)"
              : "Ching — build a trip by voice (Alt+C)"
        }
        className={`fixed z-[45] right-4 lg:right-6 bottom-[calc(env(safe-area-inset-bottom)+68px)] lg:bottom-6 grid place-items-center w-14 h-14 rounded-full border border-black/5 shadow-[0_14px_34px_-10px_rgba(16,24,42,0.6)] transition-all duration-200 hover:scale-105 active:scale-95 ${
          listening
            ? "bg-[#e7f63c] text-[#181c22]"
            : "bg-[#181c22] text-white"
        } ${open ? "max-sm:hidden" : ""}`}
      >
        {listening && (
          <span className="absolute inset-0 rounded-full bg-[#e7f63c] opacity-50 animate-ping" />
        )}
        {open ? (
          <X className="relative w-5 h-5" strokeWidth={2.2} />
        ) : (
          <Mic className="relative w-[22px] h-[22px]" strokeWidth={2.1} />
        )}
        {phase === "wake" && !open && (
          <span
            className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-[#e7f63c] ring-2 ring-[#181c22] animate-pulse"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <Suspense fallback={<PanelFallback />}>
          <ChingPanel
            speech={speech}
            handsFree={handsFree}
            onToggleHandsFree={toggleHandsFree}
            lang={listenLang}
            langs={CHING_LANGS}
            onChangeLang={changeLang}
            status={status}
            init={init}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onSubmitText={handleTyped}
            onClose={closePanel}
            editor={editor}
            live={live}
            outcome={outcome}
            compact={compact}
            canUndo={canUndo}
            progress={progress}
            onUndo={handleUndo}
            onExpand={() => setCompact(false)}
            voiceOn={voiceOn}
            speaking={speaking}
            onToggleVoice={() => {
              const next = !voiceOn;
              setVoiceEnabled(next);
              setVoiceOn(next);
              if (next) speak("Voice on. Hi, I'm Ching!");
            }}
            onOpenTab={(tab) => safe(() => getChingEditor()?.setTab(tab))}
            onConfirm={answerConfirm}
            tripDraft={tripDraft}
            onConfirmDraft={confirmDraft}
            onEditDraft={editDraft}
            onCancelDraft={cancelDraft}
            onUseHotel={(n) => assistRef.current?.({ type: "hotel-pick", n })}
          />
        </Suspense>
      )}
    </>
  );
}
