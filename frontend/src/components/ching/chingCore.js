// Ching's non-UI logic, loaded on demand (dynamic import from ChingWidget) so
// the parsers never weigh on the first paint of any dashboard page.
//
// Live mode: the Trip Builder's editor (editorBridge.js → editor.live.*) does
// the parsing and filling while the agent speaks. This module only answers the
// questions the widget has to decide *before* there is an editor to ask: is
// this a new-trip request (→ open a fresh draft and fill it), an edit with no
// trip open, or nothing at all.
import { loadBuilderInit, peekBuilderInit, prefetchBuilderInit } from "../../api/builderInit";
import { prepareCatalog, cityLookup, matchHotel } from "../../utils/ching/parseCommand";
import { parseChingEdit, isCreateRequest } from "../../utils/ching/parseEdit";
import { namesATrip, parseTripRequest } from "../../utils/ching/brief.js";
import { isNarrative } from "../../utils/ching/narrative.js";

export { soundsLikeAStory } from "../../utils/ching/narrative.js";

export { isCreateRequest };
// Ching's guided trip (Trip Info → Itinerary → Logistics, asked one step at a time).
export { startGuide, startLogistics, guideStep, currentQuestion, wantsHotel, wantsCab, guidePreview, repairTripInfo, isCorrection, correctTripInfo } from "../../utils/ching/guide.js";

// The travel-agent brief: ask what's needed, then plan the whole trip.
export { startBrief, briefStep, briefQuestion, briefWouldPlan, briefHeard, wantsStepByStep } from "../../utils/ching/brief.js";

// /api/builder/init is shared with the Trip Builder (api/builderInit.js): the
// last good copy answers at once and is refreshed in the background.
export function getInit(token) {
  const cached = peekBuilderInit(token);
  if (cached) {
    prefetchBuilderInit(token);
    return Promise.resolve(cached);
  }
  return loadBuilderInit(token);
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
 * A client's own account of the trip they want (a voice note, a pasted
 * message) that holds at least two facts of a trip: always a NEW trip, even
 * with another one open.
 */
export function isClientStory(text, init) {
  if (!isNarrative(text)) return false;
  try {
    const cmd = parseTripRequest(text, { ...catalogOf(init), activities: init?.activities || [] });
    if (!cmd?.story) return false;
    return [!(cmd.missing || []).includes("adults"), !!cmd.startDate, Number(cmd.nights) > 0, (cmd.stays?.length || 0) > 0].filter(Boolean).length >= 2;
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
    cmd = parseTripRequest(text, catalogOf(init));
  } catch {
    return false;
  }
  if (!cmd || cmd.intent !== "create_trip") return false;
  const heardLength = Number(cmd.nights) > 0 || (cmd.stays?.length || 0) > 0;
  // "Kashmir trip for 4 people", "they want to visit Gulmarg in January":
  // a trip that names a place — the brief asks for the rest.
  if (!heardLength) return namesATrip(text, catalogOf(init)) && !readsAsEdit(text, init);
  // "3 adults and 4 kids travelling on 17th October for 4 nights": two or more
  // facts of a trip (guests, date, length) are a trip, with or without a place.
  const facts = [!(cmd.missing || []).includes("adults"), !!cmd.startDate, Number(cmd.nights) > 0].filter(Boolean).length;
  return (
    facts >= 2 ||
    String(cmd.clientName || "").trim() !== "" ||
    (cmd.stays?.length || 0) >= 2 ||
    // "family of 6 wants to visit Srinagar and Gulmarg for a week": a client's
    // request, even though "for a week" alone could be read as an edit.
    namesATrip(text, catalogOf(init)) ||
    !readsAsEdit(text, init)
  );
}

/** With no trip open, a finished utterance is: "trip" | "edit" | "unknown". */
export function classifyWithoutEditor(text, init) {
  if (looksLikeTripRequest(text, init)) return "trip";
  return readsAsEdit(text, init) ? "edit" : "unknown";
}

/**
 * "the vintage" (+ optional city) → the agency's hotel, for "my usual hotel in
 * Gulmarg is the Vintage". Uses the same fuzzy matcher as trip parsing.
 */
export function matchHotelName(hotelText, city, init) {
  try {
    const cat = prepareCatalog(catalogOf(init));
    const words = String(hotelText || "").toLowerCase().split(/\s+/).filter(Boolean);
    const cityName = city ? cityLookup(String(city).toLowerCase().split(/\s+/), cat) || city : "";
    return matchHotel(words, cityName, cat).hotel?.raw || null;
  } catch {
    return null;
  }
}
