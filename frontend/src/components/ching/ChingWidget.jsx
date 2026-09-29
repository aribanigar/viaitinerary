import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, X } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
  getChingEditor,
  useChingEditor,
} from "../../utils/ching/editorBridge";
import lazyWithReload, {
  reloadOnceForStaleChunks,
} from "../../utils/lazyWithReload";
import useSpeech, { primeAudio } from "./useSpeech";

// Ching — voice trip builder. This file is the always-mounted light part: the
// floating mic, the speech engine (so "Hello Ching" works with the panel
// closed), shortcuts, and state. The panel UI and the parser/builder are
// fetched on first use.
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

const uniq = (list) => [...new Set((list || []).filter(Boolean))];

// Command actions (EXPORT_PDF / EMAIL_ME / SEND_PROPOSAL / SAVE / UNDO) against the open Trip
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
  <div className="fixed z-[90] inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 lg:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+136px)] lg:bottom-[92px] sm:w-[400px] h-48 rounded-t-[28px] sm:rounded-[24px] bg-white border border-black/5 shadow-2xl grid place-items-center">
    <span className="w-6 h-6 rounded-full border-2 border-[#181c22]/15 border-t-[#181c22] animate-spin" />
  </div>
);

export default function ChingWidget() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(readHandsFree);
  const [status, setStatus] = useState("idle"); // idle | thinking | building | running
  const [command, setCommand] = useState(null);
  // The parser's own notes describe the transcript; once the card is edited
  // they can be stale, so the panel hides them.
  const [edited, setEdited] = useState(false);
  const [init, setInit] = useState(null);
  const [notice, setNotice] = useState(null); // { kind, text, unrecognized? }
  // Voice editing of the trip open in the Trip Builder (see editorBridge.js).
  const editor = useChingEditor();
  const [edit, setEdit] = useState(null); // pending edit card
  const [outcome, setOutcome] = useState(null); // { title, lines, warnings }
  const [compact, setCompact] = useState(false); // collapse to the result pill
  const [progress, setProgress] = useState("");
  const [, setUndoTick] = useState(0);
  const seqRef = useRef(0);
  const canUndo = Boolean(editor?.canUndo?.());

  // Warm the parser chunk + catalog as soon as Ching is opened, so the
  // command is parsed instantly when the speaker stops.
  const warmUp = useCallback(() => {
    loadCore()
      .then((core) => core.getInit(token))
      .then((data) => setInit(data))
      .catch(() => {});
  }, [token]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setCompact(false);
    warmUp();
  }, [warmUp]);

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

  const handleText = useCallback(
    async (raw) => {
      const text = String(raw || "").trim();
      if (!text) return;
      const seq = ++seqRef.current;
      setOpen(true);
      setCompact(false);
      setStatus("thinking");
      setNotice(null);
      let res;
      try {
        const core = await loadCore();
        res = await core.interpret(text, token, getChingEditor());
      } catch (err) {
        if (seq !== seqRef.current) return;
        setNotice({
          kind: "error",
          text: err?.message || "Ching couldn't load your hotels and vehicles.",
        });
        setStatus("idle");
        return;
      }
      if (seq !== seqRef.current) return;
      setInit(res.init);

      if (res.kind === "create") {
        setCommand({ ...res.command, transcript: res.command.transcript || text });
        setEdited(false);
        setEdit(null);
        setOutcome(null);
        setStatus("idle");
        return;
      }

      const ed = getChingEditor();
      if (res.kind !== "edit" || !ed) {
        setNotice(
          res.kind === "edit-unknown"
            ? { kind: "edit-unknown", text, unrecognized: res.unrecognized }
            : { kind: res.kind === "unknown" ? "unknown" : "no-editor", text },
        );
        setStatus("idle");
        return;
      }

      // Only commands ("email it to me", "undo", "export"): just do them.
      if (!res.stateActions.length) {
        setEdit(null);
        const lines = await runCommands(res.commands, ed);
        if (lines && seq === seqRef.current) {
          setOutcome({ title: lines.length === 1 ? lines[0] : "Done", lines, warnings: [] });
          setCompact(true);
        }
        return;
      }

      let preview;
      try {
        preview = ed.preview(res.stateActions) || {};
      } catch (err) {
        setNotice({ kind: "error", text: err?.message || "Ching couldn't work out those changes." });
        setStatus("idle");
        return;
      }
      setEdit({
        text,
        tripLabel: ed.tripLabel || "this trip",
        stateActions: res.stateActions,
        commands: res.commands,
        changes: Array.isArray(preview.changes) ? preview.changes : [],
        warnings: uniq([...(res.warnings || []), ...(preview.warnings || [])]),
        unrecognized: res.unrecognized || [],
      });
      setCommand(null);
      setOutcome(null);
      setStatus("idle");
    },
    [token, runCommands],
  );

  const handleApply = useCallback(async () => {
    if (!edit || status !== "idle") return;
    const ed = getChingEditor();
    if (!ed) {
      toast.error("That trip isn't open any more.");
      setEdit(null);
      return;
    }
    let res = { changes: [], warnings: [] };
    try {
      if (edit.stateActions.length) res = ed.apply(edit.stateActions) || res;
    } catch (err) {
      toast.error(err?.message || "Ching couldn't apply those changes.");
      return;
    }
    const pending = edit;
    setEdit(null);
    const changes = Array.isArray(res.changes) ? res.changes : [];
    const lines = pending.commands.length
      ? (await runCommands(pending.commands, ed)) || []
      : [];
    const n = changes.length;
    setOutcome({
      title: n ? `Applied ${n} change${n === 1 ? "" : "s"}` : lines[0] || "Done",
      lines: [...changes, ...lines],
      warnings: Array.isArray(res.warnings) ? res.warnings : [],
    });
    setCompact(true); // let the agent see the updated preview
    setUndoTick((t) => t + 1);
  }, [edit, status, runCommands]);

  const handleUndo = useCallback(() => {
    const ed = getChingEditor();
    if (!ed) return;
    const label = ed.undo();
    toast.info(label ? `Undone: ${label}` : "Nothing to undo");
    if (label) setOutcome((o) => (o ? { ...o, title: `Undone: ${label}` } : o));
    setUndoTick((t) => t + 1);
  }, []);

  const editCommand = useCallback((updater) => {
    setCommand(updater);
    setEdited(true);
  }, []);

  const handleWake = useCallback(() => {
    setNotice(null);
    openPanel();
  }, [openPanel]);

  const speech = useSpeech({
    handsFree,
    paused: status === "building" || status === "running",
    onCommand: handleText,
    onWake: handleWake,
  });
  const {
    supported,
    phase,
    startCommand,
    toggleCommand,
    cancelCommand,
    setWakeEnabled,
  } = speech;
  const listening = phase === "command";

  const closePanel = useCallback(() => {
    cancelCommand();
    setOpen(false);
  }, [cancelCommand]);

  const toggleHandsFree = useCallback(() => {
    const next = !handsFree;
    if (next) primeAudio(); // unlock audio inside the tap, for the beep later
    setHandsFree(next);
    writeHandsFree(next);
    setWakeEnabled(next); // start inside the tap too (iOS wants a gesture)
  }, [handsFree, setWakeEnabled]);

  const handleConfirm = useCallback(async () => {
    if (!command || status === "building") return;
    setStatus("building");
    try {
      const core = await loadCore();
      const data = init || (await core.getInit(token));
      const { ok, problems } = core.validateChingCommand(command, core.catalogOf(data));
      if (!ok) {
        toast.error(problems?.[0] || "Please fix the highlighted details first.");
        return;
      }
      const nights = Number(command.nights) || 0;
      const { tripId } = await core.createChingTrip({
        token,
        command: { ...command, days: nights + 1 },
        init: data,
      });
      setCommand(null);
      setNotice(null);
      setOpen(false);
      navigate(`/trip-builder/${tripId}?ching=deliver`);
    } catch (err) {
      toast.error(err?.message || "Ching couldn't build the trip. Please try again.");
    } finally {
      setStatus("idle");
    }
  }, [command, init, navigate, status, token]);

  const handleFab = () => {
    if (open) {
      closePanel();
      return;
    }
    openPanel();
    if (supported && !command && !edit && status === "idle") startCommand();
  };

  // Alt+C / ⌥C toggles listening, Esc stops listening / closes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        e.preventDefault();
        if (!open) openPanel();
        if (supported && status !== "building" && status !== "running") toggleCommand();
        return;
      }
      if (e.key === "Escape" && (open || listening)) {
        if (listening) cancelCommand();
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, listening, supported, status, openPanel, toggleCommand, cancelCommand]);

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
              ? "Ching — edit this trip by voice (Alt+C)"
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
            status={status}
            command={command}
            setCommand={editCommand}
            edited={edited}
            init={init}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onSubmitText={handleText}
            onConfirm={handleConfirm}
            onDiscard={() => {
              setCommand(null);
              setNotice(null);
            }}
            onClose={closePanel}
            editor={editor}
            edit={edit}
            outcome={outcome}
            compact={compact}
            canUndo={canUndo}
            progress={progress}
            onApply={handleApply}
            onDiscardEdit={() => setEdit(null)}
            onUndo={handleUndo}
            onExpand={() => setCompact(false)}
          />
        </Suspense>
      )}
    </>
  );
}
