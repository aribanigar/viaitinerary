// Lets the global Ching widget talk to whichever Trip Builder is open.
//
// The Trip Builder registers an "editor" while a trip is on screen; Ching
// reads it to decide between creating a new trip and editing this one, and
// to preview / apply / undo voice edits against the builder's live state.
//
// editor = {
//   tripLabel: string,                          // "Rahul Sharma · TRP123456"
//   getContext(): EditContext,                  // editTrip.js buildEditContext
//   preview(actions): { changes, warnings },    // dry run, nothing changes
//   apply(actions): { changes, warnings },      // commits (undoable)
//   undo(): string | null,                      // label of what was undone
//   canUndo(): boolean,
//   exportPdf(): Promise<void>,                 // same as the Export button
//   emailMe(): Promise<{ to: string }>,         // PDF to the signed-in user
//   save(): Promise<boolean>,
// }
import { useSyncExternalStore } from "react";

let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

/** Register the open Trip Builder. Returns the unregister function. */
export function registerChingEditor(editor) {
  current = editor;
  emit();
  return () => {
    if (current === editor) {
      current = null;
      emit();
    }
  };
}

export const getChingEditor = () => current;

export function subscribeChingEditor(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React hook: the registered editor (or null), re-rendering when it changes. */
export const useChingEditor = () =>
  useSyncExternalStore(subscribeChingEditor, getChingEditor, getChingEditor);
