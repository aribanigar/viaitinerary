// Ching's non-UI logic, loaded on demand (dynamic import from ChingWidget) so
// the parsers never weigh on the first paint of any dashboard page.
//
// Live mode: the Trip Builder's editor (editorBridge.js → editor.live.*) does
// the parsing and filling while the agent speaks. This module only answers the
// questions the widget has to decide *before* there is an editor to ask: is
// this a new-trip request (→ open a fresh draft and fill it), an edit with no
// trip open, or nothing at all.
import { fetchBuilderInit } from "../../api/trips";
import { parseChingCommand } from "../../utils/ching/parseCommand";
import { parseChingEdit, isCreateRequest } from "../../utils/ching/parseEdit";

export { isCreateRequest };

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

const catalogOf = (init) => ({
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

function readsAsEdit(text, init) {
  if (!init) return false;
  try {
    const catalog = editCatalogOf(init);
    const r = parseChingEdit(text, probeEditContext(catalog), catalog);
    return Boolean(r && r.intent === "edit" && r.actions?.length);
  } catch {
    return false;
  }
}

/**
 * With no trip open: does this (possibly partial) text ask for a new trip?
 * "create a 5 day trip…" always does; otherwise the trip parser must hear
 * nights or stays, and — so "make Gulmarg 2 nights" isn't mistaken for a new
 * trip — a client name, two or more stays, or nothing that reads as an edit.
 */
export function looksLikeTripRequest(text, init) {
  if (isCreateRequest(text)) return true;
  if (!init) return false;
  let cmd;
  try {
    cmd = parseChingCommand(text, catalogOf(init));
  } catch {
    return false;
  }
  if (!cmd || cmd.intent !== "create_trip") return false;
  const heardLength = Number(cmd.nights) > 0 || (cmd.stays?.length || 0) > 0;
  if (!heardLength) return false;
  return (
    String(cmd.clientName || "").trim() !== "" ||
    (cmd.stays?.length || 0) >= 2 ||
    !readsAsEdit(text, init)
  );
}

/** With no trip open, a finished utterance is: "trip" | "edit" | "unknown". */
export function classifyWithoutEditor(text, init) {
  if (looksLikeTripRequest(text, init)) return "trip";
  return readsAsEdit(text, init) ? "edit" : "unknown";
}
