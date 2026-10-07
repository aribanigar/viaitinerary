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
import { applyCorrections } from "./corrections.js";
import { buildChingTripParts } from "./buildTrip.js";
import { startingInclusions } from "./inclusions.js";
import { placeKey } from "./places.js";
import { bestStayOrder } from "./route.js";

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
  "INCLUSION",
  "SET_TARGET_TOTAL",
  "SET_MARGIN_AMOUNT",
  "SET_HOTEL_RATE",
  "SORT_STAYS",
]);
// Price goals ("quote 45000", "margin ₹10,000") are worked out on the whole
// trip, so they run after everything else said in the same breath.
const PRICE_GOALS = new Set(["SET_TARGET_TOTAL", "SET_MARGIN_AMOUNT"]);
const goalsLast = (actions) => [
  ...actions.filter((a) => !PRICE_GOALS.has(a?.type)),
  ...actions.filter((a) => PRICE_GOALS.has(a?.type)),
];

/**
 * The agent's own words for things ("when I say Heaven I mean Heevan Resort"),
 * learned through Ching's memory: whole-word replacements before parsing.
 */
export function applyAliases(text, memory) {
  const aliases = memory?.aliases || {};
  let out = String(text || "");
  for (const [said, meant] of Object.entries(aliases)) {
    if (!said || !meant) continue;
    const esc = said.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // A function, so a "$" in what the agent said isn't read as a replacement pattern.
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), () => meant);
  }
  return out;
}

const AUTO_TITLE = /\d+\s*N\s*\/\s*\d+\s*D\s*$/i;

/**
 * A trip with no plan yet: no hotels, cabs or activities. Client details and a
 * few hand-made days don't count — a full trip request fills such a trip in
 * place (keeping what's there) instead of opening a new draft.
 */
/**
 * "add 2 nights at grand mumtaz", "book an innova", "put highlands park for
 * the gulmarg nights": adding to the trip on screen, never a new trip — even
 * though the words would also parse as one ("2 nights at X").
 */
export function isAddRequest(text) {
  const t = String(text || "").toLowerCase().trim();
  if (/\b(?:create|new|make|plan|build|prepare)\b[^.]*\b(?:trip|itinerary|package|tour|quotation|quote)\b/.test(t)) return false;
  if (/\b(?:trip|itinerary|package|tour|quotation)\s+for\b/.test(t)) return false;
  return /^(?:(?:please|pls|now|also|and|then|ok|okay|ching|hey|can you|could you|i want to|let's|lets)\s+)*(?:add|book|put|include|assign|select|choose|pick|use|give|fill)\b/.test(t);
}

export function isBlankTrip(snapshot) {
  const s = snapshot || {};
  return !(s.accommodations || []).length && !(s.transportation || []).length && !(s.tripActivities || []).length;
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

function planFill(base, rawText, { catalog, settings, today }) {
  // Aliases apply to the whole sentence — the fill and the extras riding along.
  const text = applyAliases(rawText, catalog.memory);
  const createCatalog = { hotels: catalog.hotels, destinations: catalog.destinations, vehicles: catalog.vehicles };
  const command = parseChingCommand(text, createCatalog, { today });
  // Day 1 is the trip's start date: when none was said, use the one already on the trip.
  const baseStart = String(base.tripInfo?.startDate || "").slice(0, 10);
  if (!command.startDate && /^\d{4}-\d{2}-\d{2}$/.test(baseStart)) command.startDate = baseStart;
  const parts = buildChingTripParts(command, { ...createCatalog, memory: catalog.memory });

  const tripInfo = { ...base.tripInfo, ...parts.tripInfo };
  // Guests nobody mentioned stay as the trip already had them.
  if (command.missing?.includes("adults") && !command.children && !command.infants && base.tripInfo?.adults) {
    tripInfo.adults = base.tripInfo.adults;
    tripInfo.kids5to12 = base.tripInfo.kids5to12 ?? tripInfo.kids5to12;
    tripInfo.kidsUpto5 = base.tripInfo.kidsUpto5 ?? tripInfo.kidsUpto5;
  }
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
  // Inclusions / exclusions: a blank list starts from the agency's standard
  // lines, else lines written from this trip (nights, meals, cab).
  const start = startingInclusions(snapshot, catalog.standard);
  const incBlank = !(base.inclusions || []).length;
  const excBlank = !(base.exclusions || []).length;
  if (incBlank) snapshot.inclusions = start.inclusions;
  if (excBlank) snapshot.exclusions = start.exclusions;

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
  const autoHotel = new Map(parts.autoPicked.filter((p) => p.hotel).map((p) => [p.hotel, p]));
  const autoCab = parts.autoPicked.find((p) => p.cab);
  parts.accommodations.forEach((a) => {
    const n = Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000);
    const pick = autoHotel.get(a.name);
    const how = !pick ? "" : pick.favourite ? " (your usual)" : pick.overBudget ? " (nothing under budget — cheapest)" : " (picked for you)";
    changes.push(`${a.city}: ${a.name} · ${plural(n, "night")}${how}`);
  });
  if (parts.itinerary.length) {
    const route = parts.itinerary.map((d) => d.location).filter((c, i, a) => c && c !== a[i - 1]);
    changes.push(`Day-wise plan: ${plural(parts.itinerary.length, "day")}${route.length > 1 ? ` · ${route.join(" → ")}` : ""}`);
  }
  if (parts.transportation.length) {
    const how = !autoCab ? "" : autoCab.favourite ? " (your usual)" : ` (picked for ${autoCab.guests} guests)`;
    changes.push(`Cab: ${parts.vehicle.name} · ${plural(parts.transportation.length, "day")}${how}`);
  }
  const meal = parts.remembered.find((r) => r.meal);
  if (command.mealPlan) changes.push(`Meals: ${command.mealPlan}`);
  else if (meal) changes.push(`Meals: ${meal.meal} (your usual)`);
  const rememberedPhone = parts.remembered.find((r) => r.phone);
  const rememberedEmail = parts.remembered.find((r) => r.email);
  if (command.clientPhone) changes.push(`Phone: ${command.clientPhone}`);
  else if (rememberedPhone) changes.push(`Phone: ${rememberedPhone.phone} (from ${rememberedPhone.client}'s last trip)`);
  if (command.clientEmail) changes.push(`Email: ${command.clientEmail}`);
  else if (rememberedEmail) changes.push(`Email: ${rememberedEmail.email} (remembered)`);
  if (incBlank && snapshot.inclusions.length) changes.push(`Inclusions: ${plural(snapshot.inclusions.length, "line")}`);
  if (excBlank && snapshot.exclusions.length) changes.push(`Exclusions: ${plural(snapshot.exclusions.length, "line")}`);

  // A city-only stay that got a hotel picked isn't a problem any more.
  // (and "Couldn't find "pahalgam" in your hotels" when it was a city after all).
  const pickedCities = parts.autoPicked.filter((p) => p.city).map((p) => placeKey(p.city));
  const stayCities = parts.accommodations.map((a) => placeKey(a.city));
  const builtNights = parts.accommodations.reduce((n, a) => n + Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000), 0);
  const warnings = (command.warnings || []).filter((w) => {
    // The builder topped up the stays ("Gulmarg 1 night" in a 4-night trip).
    if (/^Hotel nights add up to/.test(w) && command.nights && builtNights === command.nights) return false;
    const lw = ` ${placeKey(w)} `;
    if (/^No hotel named/.test(w)) return !pickedCities.some((c) => c && lw.includes(` ${c} `));
    const m = /^Couldn't find "(.+?)" in your hotels/.exec(w);
    return !(m && stayCities.includes(placeKey(m[1])));
  });
  (parts.missingHotels || []).forEach((city) =>
    warnings.push(`No hotel in ${city} in your catalog — add one in Logistics (or to Accommodation)`),
  );
  if (command.intent === "create_trip") {
    const v = validateChingCommand(command, createCatalog);
    // Missing pieces are normal mid-sentence; only flag what's actually wrong.
    v.problems
      .filter((p) => !/client name|start date|nights|adult/i.test(p))
      // A stay that got a hotel picked for its city isn't missing one.
      .filter((p) => {
        const m = /^Pick a hotel for stay \d+ \((.+)\)$/.exec(p);
        return !(m && stayCities.includes(placeKey(m[1])));
      })
      .forEach((p) => warnings.push(p));
  }

  // Extras riding along ("… Shikara ride on day 2, 20% margin, then email it to me").
  let commands = [];
  let extraChanges = [];
  try {
    const r = parseChingEdit(text, buildEditContext(snapshot), catalog, { today, force: true }) || {};
    const actions = Array.isArray(r.actions) ? r.actions : [];
    commands = actions.filter((a) => COMMAND_TYPES.has(a?.type));
    // A single "day N …" route rides along; several were already planned by the fill.
    const extras = actions.filter((a) => FILL_EXTRAS.has(a?.type) || (a?.type === "SET_DAY_ROUTES" && !command.dayPlan));
    // Not asked to sort, but the hotels were said in a roundabout order: say so.
    if (!extras.some((a) => a.type === "SORT_STAYS") && !command.dayPlan && parts.accommodations.length > 1) {
      const route = bestStayOrder(parts.accommodations, { hotels: catalog.hotels });
      if (route.ok && route.changed && route.spokenKm - route.km >= Math.max(30, route.km * 0.1)) {
        warnings.push(`Shorter route: ${route.path.join(" → ")} saves ~${route.spokenKm - route.km} km — say "sort the hotels"`);
      }
    }
    if (extras.length) {
      const res = applyEditActions(snapshot, goalsLast(extras), { catalog, settings });
      snapshot = res.snapshot;
      extraChanges = res.changes;
      warnings.push(...res.warnings);
    }
  } catch {
    // Extras are best effort; the fill itself stands.
  }

  // For the Trip Draft card: what Ching chose itself, nobody said — the
  // cities it planned and the hotels it picked — shown as "suggested".
  const said = ` ${placeKey(text)} `;
  const draftMeta = {
    suggestedCities: [...new Set(parts.accommodations.map((a) => a.city))].filter((c) => {
      const k = placeKey(c);
      return k && !said.includes(` ${k} `);
    }),
    pickedHotels: parts.autoPicked.filter((p) => p.hotel).map((p) => p.hotel),
    // Asked back in the draft until answered: "day 2 Gulmarg — day trip or transfer?",
    // and hotels the agent named that aren't in the catalog.
    dayQuestions: command.dayPlan?.questions || [],
    unmatchedHotels: command.unmatchedHotels || [],
  };

  return {
    mode: "fill",
    command,
    draftMeta,
    snapshot,
    changes: [...changes, ...extraChanges],
    warnings: [...new Set(warnings)],
    unrecognized: [],
    commands,
  };
}

function planEdit(base, text, { catalog, settings, today }) {
  text = applyAliases(text, catalog.memory);
  const r = parseChingEdit(text, buildEditContext(base), catalog, { today, force: true }) || {};
  const actions = Array.isArray(r.actions) ? r.actions : [];
  const stateActions = actions.filter((a) => !COMMAND_TYPES.has(a?.type));
  const res = stateActions.length
    ? applyEditActions(base, goalsLast(stateActions), { catalog, settings })
    : { snapshot: base, changes: [], warnings: [] };
  return {
    mode: "edit",
    snapshot: res.snapshot,
    changes: res.changes,
    warnings: [...new Set([...(r.warnings || []), ...res.warnings])],
    unrecognized: r.unrecognized || [],
    commands: actions.filter((a) => COMMAND_TYPES.has(a?.type)),
    // What this edit answered, for the pending Trip Draft's questions.
    answered: {
      days: stateActions.filter((a) => a.type === "SET_DAY_ROUTES").flatMap((a) => Object.keys(a.entries || {}).map(Number)),
      hotels: stateActions.some((a) => ["REPLACE_HOTEL", "ADD_STAY", "ADD_HOTEL", "SET_HOTEL"].includes(a.type)),
    },
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
    memory: catalog?.memory || null,
    standard: catalog?.standard || {},
  };
  const opts = { catalog: cat, settings: settings || {}, today };
  // "3 nights no sorry 4 nights", "grand mumtaz actually make it lalit".
  text = applyCorrections(text, cat);
  if (!String(text || "").trim()) {
    return { mode: isBlankTrip(base) ? "fill" : "edit", snapshot: base, changes: [], warnings: [], unrecognized: [], commands: [] };
  }
  if (!isBlankTrip(base)) return planEdit(base, text, opts);
  const fill = planFill(base, text, opts);
  // A trip with days but no hotels yet: only a real trip request refills it —
  // "day 3 Gulmarg to Pahalgam" or "add Shikara on day 2" edit those days.
  const c = fill.command || {};
  const isRequest = c.intent === "create_trip" && (Number(c.nights) > 0 || (c.stays || []).length > 0 || !!c.dayPlan);
  if ((base.itinerary || []).length && (!isRequest || isAddRequest(text))) return planEdit(base, text, opts);
  const { command, ...rest } = fill; // eslint-disable-line no-unused-vars
  return rest;
}
