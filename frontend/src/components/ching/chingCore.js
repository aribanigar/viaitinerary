// Ching's non-UI logic, loaded on demand (dynamic import from ChingWidget) so
// the parsers/builder never weigh on the first paint of any dashboard page.
import { fetchBuilderInit } from "../../api/trips";
import {
  parseChingCommand,
  validateChingCommand,
} from "../../utils/ching/parseCommand";
import { parseChingEdit, isCreateRequest } from "../../utils/ching/parseEdit";
import { createChingTrip } from "../../utils/ching/buildTrip";

export { validateChingCommand, createChingTrip };

// /api/builder/init is cached for the rest of the page session (per token);
// a failed load is forgotten so the next request retries.
let initCache = null;

export function getInit(token) {
  if (initCache && initCache.token === token) return initCache.promise;
  const promise = fetchBuilderInit(token).catch((err) => {
    if (initCache?.promise === promise) initCache = null;
    throw err;
  });
  initCache = { token, promise };
  return promise;
}

export const catalogOf = (init) => ({
  hotels: init?.hotels || [],
  destinations: init?.destinations || [],
  vehicles: init?.vehicles || [],
});

const editCatalogOf = (init) => ({
  ...catalogOf(init),
  activities: init?.activities || [],
});

// What the edit parser sees when no trip is open — only used to tell "that
// was an edit" apart from "that was nothing". An empty trip makes the parser
// reject "make Gulmarg 2 nights" (no such stay), so give it one stay per
// catalog city and a month of days to resolve against.
function probeEditContext(catalog) {
  const seen = new Set();
  const stays = [];
  catalog.hotels.forEach((h) => {
    const city = String(h?.city || "").trim();
    if (!city || seen.has(city.toLowerCase())) return;
    seen.add(city.toLowerCase());
    stays.push({
      index: stays.length,
      hotelId: h.id,
      hotelName: h.name || "",
      city,
      nights: 1,
      mealPlan: "",
      checkIn: "",
      checkOut: "",
    });
  });
  return {
    tripId: null,
    clientName: "",
    startDate: "",
    nights: stays.length,
    adults: 2,
    children: 0,
    infants: 0,
    stays,
    days: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      location: "",
      activities: [],
    })),
    activities: [],
    vehicle: null,
    marginPercent: 0,
    gstPercent: 0,
    includeGst: false,
  };
}

// Actions the Trip Builder runs as commands rather than state edits.
export const COMMAND_TYPES = new Set(["EXPORT_PDF", "EMAIL_ME", "SAVE", "UNDO"]);

/**
 * Decide what a finished transcript is and parse it.
 * Resolves to one of
 *   { kind: "edit", stateActions, commands, unrecognized, warnings }
 *   { kind: "edit-unknown", unrecognized, warnings }
 *   { kind: "no-editor" }
 *   { kind: "create", command }
 *   { kind: "unknown" }
 * each with `init` (the cached builder init).
 */
export async function interpret(text, token, editor) {
  const init = await getInit(token);
  const creating = isCreateRequest(text);

  if (editor && !creating) {
    const r = parseChingEdit(text, editor.getContext(), editCatalogOf(init)) || {};
    if (r.intent !== "create") {
      const actions = Array.isArray(r.actions) ? r.actions : [];
      const unrecognized = Array.isArray(r.unrecognized) ? r.unrecognized : [];
      const warnings = Array.isArray(r.warnings) ? r.warnings : [];
      if (!actions.length) return { init, kind: "edit-unknown", unrecognized, warnings };
      return {
        init,
        kind: "edit",
        stateActions: actions.filter((a) => !COMMAND_TYPES.has(a?.type)),
        commands: actions.filter((a) => COMMAND_TYPES.has(a?.type)),
        unrecognized,
        warnings,
      };
    }
  }

  const command = parseChingCommand(text, catalogOf(init));
  const looksLikeNewTrip =
    command?.intent === "create_trip" && String(command.clientName || "").trim() !== "";

  // No trip open and it reads as an edit ("make Gulmarg 2 nights") — unless
  // the create parser also heard a client name ("trip for Rahul, 4 nights…").
  if (!editor && !creating && !looksLikeNewTrip) {
    try {
      const catalog = editCatalogOf(init);
      const r = parseChingEdit(text, probeEditContext(catalog), catalog);
      if (r && r.intent !== "unknown" && r.intent !== "create") {
        return { init, kind: "no-editor" };
      }
    } catch {
      // Fall through to the create parser's verdict.
    }
  }

  if (command?.intent === "create_trip") return { init, kind: "create", command };
  return { init, kind: "unknown" };
}
