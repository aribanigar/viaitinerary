// Real-time Ching: turn everything heard so far into the Trip Builder state
// to show right now. Always computed from the `base` snapshot captured when
// the agent started speaking, so a speech engine revising its guess (or the
// agent correcting themselves) just recomputes — nothing piles up.
//
//  - "fill": the open trip is blank → the whole form is filled from the
//    request (client, guests, dates, hotels, day plan, cab, meals), then any
//    extras in the same sentence (activities, leisure days, margin, GST…).
//  - "edit": the trip already has content → the sentence is a list of edits.
import { parseChingCommand, validateChingCommand } from "./parseCommand.js";
import { parseChingEdit } from "./parseEdit.js";
import { buildEditContext, applyEditActions } from "./editTrip.js";
import { buildChingTripParts } from "./buildTrip.js";

// Commands run once, when the agent stops speaking — never live.
export const COMMAND_TYPES = new Set([
  "EXPORT_PDF",
  "EXPORT_EXCEL",
  "EMAIL_ME",
  "SAVE",
  "UNDO",
  "SEND_PROPOSAL",
  "SEND_PAYMENT_LINK",
  "SEND_REMINDER",
]);

// Edits that can ride along with a new-trip request ("… add Shikara ride on
// day 2, 20% margin"). Everything else in such a sentence (client, dates,
// guests, stays, cab, meals) is the fill itself.
const FILL_EXTRAS = new Set([
  "ADD_ACTIVITY",
  "ADD_DAY_ITEM",
  "SET_DAY_LEISURE",
  "CLEAR_DAY_SIGHTSEEING",
  "MOVE_DAY_PLAN",
  "SET_MARGIN",
  "SET_GST",
  "SET_ROOMS",
]);

const AUTO_TITLE = /\d+\s*N\s*\/\s*\d+\s*D\s*$/i;

/** A trip with nothing in it yet (a fresh "New Trip" tab). */
export function isBlankTrip(snapshot) {
  const s = snapshot || {};
  return (
    !String(s.tripInfo?.clientName || "").trim() &&
    !(s.accommodations || []).length &&
    !(s.transportation || []).length &&
    !(s.itinerary || []).length &&
    !(s.tripActivities || []).length
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return { y, m, d };
};
function dateRange(start, nights) {
  const a = ymd(start);
  const end = new Date(a.y, a.m - 1, a.d + nights);
  const b = { y: end.getFullYear(), m: end.getMonth() + 1, d: end.getDate() };
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function planFill(base, text, { catalog, settings, today }) {
  const createCatalog = { hotels: catalog.hotels, destinations: catalog.destinations, vehicles: catalog.vehicles };
  const command = parseChingCommand(text, createCatalog, { today });
  const parts = buildChingTripParts(command, createCatalog);

  const tripInfo = { ...base.tripInfo, ...parts.tripInfo };
  // Keep a title the agent typed; replace only an empty or auto one ("Kashmir 4N/5D").
  if (parts.tripInfo.tripTitle && String(base.tripInfo?.tripTitle || "").trim() && !AUTO_TITLE.test(base.tripInfo.tripTitle)) {
    tripInfo.tripTitle = base.tripInfo.tripTitle;
  }
  let snapshot = {
    ...base,
    tripInfo,
    itinerary: parts.itinerary.length ? parts.itinerary : base.itinerary,
    accommodations: parts.accommodations.length ? parts.accommodations : base.accommodations,
    transportation: parts.transportation.length ? parts.transportation : base.transportation,
  };

  const changes = [];
  if (command.clientName) changes.push(`Client: ${command.clientName}`);
  const guests = [plural(command.adults, "adult")];
  if (command.children) guests.push(plural(command.children, "child").replace("childs", "children"));
  if (command.infants) guests.push(plural(command.infants, "infant"));
  if (!command.missing?.includes("adults") || command.children || command.infants) changes.push(`Guests: ${guests.join(", ")}`);
  if (command.startDate && command.nights) {
    changes.push(`Dates: ${dateRange(command.startDate, command.nights)} · ${command.nights}N/${command.nights + 1}D`);
  } else if (command.nights) {
    changes.push(`Duration: ${command.nights}N/${command.nights + 1}D`);
  } else if (command.startDate) {
    changes.push(`Starts: ${command.startDate}`);
  }
  const autoHotel = new Set(parts.autoPicked.filter((p) => p.hotel).map((p) => p.hotel));
  const autoCab = parts.autoPicked.find((p) => p.cab);
  parts.accommodations.forEach((a) => {
    const n = Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000);
    changes.push(`${a.city}: ${a.name} · ${plural(n, "night")}${autoHotel.has(a.name) ? " (picked for you)" : ""}`);
  });
  if (parts.itinerary.length) changes.push(`Day-wise plan: ${plural(parts.itinerary.length, "day")}`);
  if (parts.transportation.length) {
    changes.push(
      `Cab: ${parts.vehicle.name} · ${plural(parts.transportation.length, "booking")}${autoCab ? ` (picked for ${autoCab.guests} guests)` : ""}`,
    );
  }
  if (command.mealPlan) changes.push(`Meals: ${command.mealPlan}`);
  if (command.clientPhone) changes.push(`Phone: ${command.clientPhone}`);
  if (command.clientEmail) changes.push(`Email: ${command.clientEmail}`);

  // A city-only stay that got a hotel picked isn't a problem any more.
  const pickedCities = parts.autoPicked.filter((p) => p.city).map((p) => String(p.city).toLowerCase());
  const warnings = (command.warnings || []).filter(
    (w) => !(/^No hotel named/.test(w) && pickedCities.some((c) => w.toLowerCase().includes(c))),
  );
  if (command.intent === "create_trip") {
    const v = validateChingCommand(command, createCatalog);
    // Missing pieces are normal mid-sentence; only flag what's actually wrong.
    v.problems
      .filter((p) => !/client name|start date|nights|adult/i.test(p))
      .forEach((p) => warnings.push(p));
  }

  // Extras riding along ("… Shikara ride on day 2, 20% margin, then email it to me").
  let commands = [];
  let extraChanges = [];
  try {
    const r = parseChingEdit(text, buildEditContext(snapshot), catalog, { today, force: true }) || {};
    const actions = Array.isArray(r.actions) ? r.actions : [];
    commands = actions.filter((a) => COMMAND_TYPES.has(a?.type));
    const extras = actions.filter((a) => FILL_EXTRAS.has(a?.type));
    if (extras.length) {
      const res = applyEditActions(snapshot, extras, { catalog, settings });
      snapshot = res.snapshot;
      extraChanges = res.changes;
      warnings.push(...res.warnings);
    }
  } catch {
    // Extras are best effort; the fill itself stands.
  }

  return {
    mode: "fill",
    snapshot,
    changes: [...changes, ...extraChanges],
    warnings: [...new Set(warnings)],
    unrecognized: [],
    commands,
  };
}

function planEdit(base, text, { catalog, settings, today }) {
  const r = parseChingEdit(text, buildEditContext(base), catalog, { today, force: true }) || {};
  const actions = Array.isArray(r.actions) ? r.actions : [];
  const stateActions = actions.filter((a) => !COMMAND_TYPES.has(a?.type));
  const res = stateActions.length
    ? applyEditActions(base, stateActions, { catalog, settings })
    : { snapshot: base, changes: [], warnings: [] };
  return {
    mode: "edit",
    snapshot: res.snapshot,
    changes: res.changes,
    warnings: [...new Set([...(r.warnings || []), ...res.warnings])],
    unrecognized: r.unrecognized || [],
    commands: actions.filter((a) => COMMAND_TYPES.has(a?.type)),
  };
}

/**
 * base + everything heard so far → { mode, snapshot, changes, warnings,
 * unrecognized, commands }. catalog = { hotels, destinations, vehicles,
 * activities }; settings = { gst_percentage, profit_percentage, include_gst }.
 */
export function planLive(base, text, { catalog, settings, today } = {}) {
  const cat = {
    hotels: catalog?.hotels || [],
    destinations: catalog?.destinations || [],
    vehicles: catalog?.vehicles || [],
    activities: catalog?.activities || [],
  };
  const opts = { catalog: cat, settings: settings || {}, today };
  if (!String(text || "").trim()) {
    return { mode: isBlankTrip(base) ? "fill" : "edit", snapshot: base, changes: [], warnings: [], unrecognized: [], commands: [] };
  }
  return isBlankTrip(base) ? planFill(base, text, opts) : planEdit(base, text, opts);
}
