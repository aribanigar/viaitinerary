// Hotel requests in plain words → search criteria for /api/hotels/search
// (web/lib/hotelSearch.js). Pure, no catalog needed: the city comes back as
// the words said ("in srinagar") and the action resolves it against the
// agency's own cities and the open trip's stays.
//
//   "find a 4 star hotel in srinagar under 6000 with breakfast"     → find
//   "show me hotels in gulmarg between 5000 and 8000"               → find
//   "use the cheapest available 4-star hotel in srinagar with breakfast" → apply
//   "use hotel abc if available, otherwise the best under 7000"     → apply (prefer + fallback)
//   "use the first one" / "go with option 2" / "take the second hotel" → pick
import { convertNumberWords } from "./text.js";

// Meal plan said → rate-sheet meal_plan key. A small copy of parseCommand's
// MEAL_RULES (most specific first) so this module — loaded with every page —
// doesn't pull the trip parser into the main bundle.
const MEALS = [
  ["all_meals", /\ball\s+(?:the\s+)?(?:3\s+)?meals\b|\bbreakfast\s*,?\s*(?:and\s+|&\s*|\+\s*)?lunch\s*,?\s*(?:and\s+|&\s*)?dinner\b|\bfull\s+board\b|\bapai\b|\bap\s+plan\b/],
  ["breakfast_dinner", /\bbreakfast\s*(?:and|&|\+|plus|with)\s*dinner\b|\bhalf\s+board\b|\bmap(?:ai)?\b/],
  ["room_only", /\broom\s+only\b|\bonly\s+(?:the\s+)?rooms?\b(?!\s*(?:\+|and|&|with|plus)\s*breakfast)|\bwithout\s+(?:any\s+)?(?:meals?|breakfast|food)\b|\bno\s+meals?\b|\bep(?:ai)?\b/],
  ["breakfast_only", /\bbreakfast\b|\bcp(?:ai)?\b|\bb\s*&\s*b\b|\bbnb\b/],
];
const mealOf = (t) => MEALS.find(([, re]) => re.test(t))?.[0] || "";

const ROOM_TYPES = [
  "super deluxe",
  "deluxe",
  "premium",
  "executive",
  "suite",
  "luxury",
  "standard",
  "superior",
  "family",
  "cottage",
  "houseboat",
];

const HOTEL = /\b(?:hotels?|propert(?:y|ies)|resorts?|stays?|accommodations?|houseboats?|rooms?)\b/;
const FIND = /^(?:please\s+)?(?:can you\s+|could you\s+)?(?:find|search(?: for)?|look(?:ing)? for|show(?: me)?|suggest|recommend|list|give me|any|which|what are (?:the )?(?:hotel |stay )?(?:options|hotels|choices)|options for)\b/;
const APPLY = /\b(?:use|put|book|switch to|change (?:the |it )?(?:hotel )?to|replace (?:it |the hotel )?with|go with|pick|choose|select|give (?:them|him|her|us) )\b/;

const ORD = { first: 1, "1st": 1, one: 1, second: 2, "2nd": 2, two: 2, third: 3, "3rd": 3, three: 3, fourth: 4, "4th": 4, four: 4, fifth: 5, "5th": 5, five: 5, last: -1 };

const money = (n, unit) => {
  const v = Number(String(n).replace(/[, ]/g, ""));
  if (!Number.isFinite(v)) return null;
  return Math.round(/k\b|thousand/.test(unit || "") ? v * 1000 : /lakh|lac/.test(unit || "") ? v * 100000 : v);
};
const AMT = "(?:rs\\.?|₹|inr)?\\s*(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?)\\s*(k|thousand)?\\s*(?:rupees|rs)?";

/** "use the first one", "go with option 2", "book the 3rd hotel" → n (1-based, -1 = last), else null. */
export function hotelPickOf(t) {
  const m =
    /^(?:please\s+)?(?:use|take|pick|choose|select|go with|book|i(?:'ll| will) take|let'?s (?:go with|take))\s+(?:the\s+)?(?:option|number|no\.?)\s*(\d)\b/.exec(t) ||
    /^(?:please\s+)?(?:use|take|pick|choose|select|go with|book|i(?:'ll| will) take|let'?s (?:go with|take))\s+(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)(?:\s+(?:one|1|hotel|option|property))?\s*$/.exec(t);
  if (!m) return null;
  const n = /^\d$/.test(m[1]) ? Number(m[1]) : ORD[m[1]];
  return n ? n : null;
}

/**
 * → { type: "hotel-search", mode: "find" | "apply", criteria, cityWords, nights } |
 *   { type: "hotel-pick", n } | null
 * criteria = { minStars, maxStars, maxRate, minRate, mealPlan, roomType, sort, prefer }
 */
export function understandHotelSearch(text, { inBuilder = false } = {}) {
  let t = convertNumberWords(String(text || "").toLowerCase())
    .replace(/[‘’]/g, "'")
    .replace(/(\d)\s*-\s*star/g, "$1 star")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  const n = hotelPickOf(t);
  if (n) return { type: "hotel-pick", n };

  if (!HOTEL.test(t)) return null;
  const find = FIND.test(t);
  const apply = !find && APPLY.test(t);
  if (!find && !apply) return null;

  // "Hotel ABC if available, otherwise the best under 7000"
  let prefer = "";
  const pm = /\b(?:use|book|put|go with|try)\s+(?:the\s+)?(.+?)\s+if\s+(?:it(?:'s| is)\s+|they(?:'re| are)\s+)?(?:available|free|open|possible)\b[\s,]*(?:otherwise|else|or else|if not)?/.exec(t);
  if (pm) {
    prefer = pm[1].replace(/\b(?:hotel|in [a-z ]+)$/g, "").trim();
    t = t.slice(0, pm.index) + " " + t.slice(pm.index + pm[0].length);
  }

  const criteria = { sort: "best" };
  if (prefer) criteria.prefer = prefer;

  // Stars: "4 star" = exactly 4; "4 star or above / plus / at least 4 star" = 4+.
  let m = /\b(?:at least|minimum|min)\s+(\d)\s*star\b|\b(\d)\s*star\s*(?:or (?:above|more|better|higher)|plus|\+|and above)/.exec(t);
  if (m) criteria.minStars = Number(m[1] || m[2]);
  else if ((m = /\b(\d)\s*star\b/.exec(t))) {
    criteria.minStars = Number(m[1]);
    criteria.maxStars = Number(m[1]);
  } else if (/\b(?:luxury|five star|5star)\b/.test(t)) criteria.minStars = 5;

  // Budget: "under 6000", "below 6k", "within ₹7,000", "between 4000 and 6000", "max 5000".
  if ((m = new RegExp(`\\bbetween\\s+${AMT}\\s+(?:and|to|-)\\s+${AMT}`).exec(t))) {
    criteria.minRate = money(m[1], m[2]);
    criteria.maxRate = money(m[3], m[4]);
  } else if ((m = new RegExp(`\\b(?:under|below|less than|within|max(?:imum)?|up ?to|not more than|budget(?: of)?|no more than|cheaper than)\\s+${AMT}`).exec(t))) {
    criteria.maxRate = money(m[1], m[2]);
  }
  if (criteria.maxRate != null && criteria.maxRate < 300) delete criteria.maxRate; // "under 5 star" etc.

  if (/\b(?:cheapest|lowest|least expensive|most affordable|budget|economical|low cost)\b/.test(t)) criteria.sort = "cheapest";
  else if (/\b(?:best|top|nicest|finest|highest rated|premium)\b/.test(t)) criteria.sort = "best";

  const meal = mealOf(t);
  if (meal) criteria.mealPlan = meal;

  const rt = ROOM_TYPES.find((r) => new RegExp(`\\b${r}\\s+(?:room|rooms|category)\\b`).test(t));
  if (rt) criteria.roomType = rt.replace(/\b[a-z]/g, (c) => c.toUpperCase());

  // Where: "in srinagar", "at gulmarg" (not "in the trip", "at 6000").
  let cityWords = "";
  const cm = /\b(?:in|at|near|around)\s+(?!the trip\b|this trip\b|budget\b|all\b|a\b|an\b|\d)([a-z]+(?: [a-z]+)?)/.exec(t);
  if (cm) cityWords = cm[1].replace(/\s+(?:under|below|with|for|between|within|from|on|if|that|which|and)$/, "");

  const nm = /\bfor\s+(\d{1,2})\s+nights?\b/.exec(t);
  const nights = nm ? Number(nm[1]) : null;

  // A trip request that mentions a hotel ("2 nights in srinagar in a 4 star")
  // is the trip parser's, not a search — unless it starts with "find".
  if (!find && /\b\d+\s*(?:nights?|days?)\b/.test(t) && !prefer) return null;
  // "use heevan in pahalgam" is a plain named swap (the edit parser's) — a
  // search needs something to search BY.
  const hasCriteria =
    prefer ||
    criteria.minStars ||
    criteria.maxRate ||
    criteria.minRate ||
    criteria.mealPlan ||
    criteria.roomType ||
    /\b(?:cheapest|lowest|best|top|nicest|available|affordable|budget|options?)\b/.test(t);
  if (!hasCriteria) return null;
  if (apply && !inBuilder) return { type: "hotel-search", mode: "find", criteria, cityWords, nights };
  return { type: "hotel-search", mode: find ? "find" : "apply", criteria, cityWords, nights };
}

const MEAL_SAY = { room_only: "room only", breakfast_only: "breakfast", breakfast_dinner: "breakfast and dinner", all_meals: "all meals" };

/** "4-star, under ₹6,000, with breakfast" — what was searched for, for replies. */
export function describeCriteria(c = {}) {
  const bits = [];
  if (c.minStars && c.maxStars === c.minStars) bits.push(`${c.minStars}-star`);
  else if (c.minStars) bits.push(`${c.minStars}-star or above`);
  if (c.roomType) bits.push(`${c.roomType} room`);
  if (c.minRate && c.maxRate) bits.push(`₹${c.minRate.toLocaleString("en-IN")}–₹${c.maxRate.toLocaleString("en-IN")}`);
  else if (c.maxRate) bits.push(`under ₹${c.maxRate.toLocaleString("en-IN")}`);
  if (c.mealPlan) bits.push(`with ${MEAL_SAY[c.mealPlan]}`);
  return bits.join(", ");
}

export const mealSay = (k) => MEAL_SAY[k] || "";
