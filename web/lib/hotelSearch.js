// Hotel search engine for Ching ("a 4-star in Srinagar under ₹6,000 with
// breakfast", "Hotel ABC if available, otherwise the best under ₹7,000").
//
// Pure: plain objects in, plain objects out — no Prisma, no network — so every
// rule here is testable (scripts/hotel-search.test.mjs). The route
// /api/hotels/search loads the agency's own hotels, blackouts and bookings
// and hands them in. Nothing is invented: a rate comes from the hotel's own
// rate sheet for those exact nights, availability from its stop-sale /
// blackout dates and the rooms already booked against its room count. When a
// fact isn't on file (no rate for the dates, no room count) the result says
// so instead of guessing.
//
// Rate sheet sections (Hotel.priceSections) look like
//   { room_type, meal_plan?, price, valid_from?, valid_to?, cnb, extra_adult, … }
// meal_plan ∈ room_only | breakfast_only | breakfast_dinner | all_meals.
// Season matching mirrors frontend/src/utils/hotelRates.js (a dated section
// covering the night wins, then an undated one).

export const MEAL_PLANS = ["room_only", "breakfast_only", "breakfast_dinner", "all_meals"];
export const MEAL_LABEL = {
  room_only: "Room only",
  breakfast_only: "Breakfast",
  breakfast_dinner: "Breakfast + Dinner",
  all_meals: "All meals",
};

const DAY = 86400000;
const list = (v) => (Array.isArray(v) ? v : []);
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const utc = (s) => Date.parse(`${String(s).slice(0, 10)}T00:00:00Z`);
const addDays = (s, n) => new Date(utc(s) + n * DAY).toISOString().slice(0, 10);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const human = (d) => {
  const [y, m, day] = String(ymd(d) || "").split("-").map(Number);
  return y ? `${day} ${MON[m - 1]} ${y}` : "";
};
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
export const nightsBetween = (a, b) => (a && b ? Math.max(0, Math.round((utc(b) - utc(a)) / DAY)) : 0);
const starsOf = (h) => {
  const n = parseInt(String(h?.category ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : null;
};

/** "Srinagar City", "Pahalgam, Kashmir" → "srinagar" / "pahalgam" (same idea as lib/chingMemory placeKey). */
const NOISE = new Set(["city", "town", "district", "valley", "the", "kashmir", "jk", "j", "k", "india", "and", "of"]);
export function cityKey(s) {
  const words = String(s ?? "").toLowerCase().split(",")[0].replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const sig = words.filter((w) => !NOISE.has(w));
  return (sig.length ? sig : words).join(" ");
}

const covers = (sec, date) => {
  if (!sec.valid_from && !sec.valid_to) return true;
  if (sec.valid_from && date < String(sec.valid_from).slice(0, 10)) return false;
  if (sec.valid_to && date > String(sec.valid_to).slice(0, 10)) return false;
  return true;
};

/**
 * The rate-sheet section for one night: room type and meal plan matched when
 * asked for, a dated season covering the night preferred over an undated rate.
 * → section or null (nothing on the sheet covers that night).
 */
export function sectionFor(hotel, { roomType = "", mealPlan = "", date }) {
  let pool = list(hotel?.priceSections ?? hotel?.price_sections).filter((s) => Number(s?.price) > 0);
  if (roomType) pool = pool.filter((s) => norm(s.room_type) === norm(roomType));
  if (mealPlan) pool = pool.filter((s) => !s.meal_plan || s.meal_plan === mealPlan);
  const dated = pool.filter((s) => (s.valid_from || s.valid_to) && date && covers(s, date));
  const undated = pool.filter((s) => !s.valid_from && !s.valid_to);
  const pick = (arr) => {
    if (!arr.length) return null;
    // An exact meal-plan row beats an untagged one; then the lower price.
    return [...arr].sort((a, b) => (mealPlan ? (b.meal_plan === mealPlan) - (a.meal_plan === mealPlan) : 0) || Number(a.price) - Number(b.price))[0];
  };
  return pick(dated) || pick(undated);
}

/**
 * The cost of staying: each night priced from its own season. Without dates,
 * tonight's rate stands in (marked `dated: false`). With no room type asked
 * for, the cheapest room type that has a rate for every night.
 * → { roomType, mealPlan, mealPlanOnSheet, perNight[], total, avg, missingNights } | null
 */
export function rateFor(hotel, { checkIn, nights = 1, roomType = "", mealPlan = "", today }) {
  const n = Math.max(1, Number(nights) || 1);
  const start = checkIn || today || ymd(new Date());
  const dates = Array.from({ length: n }, (_, i) => addDays(start, i));
  const types = roomType
    ? [roomType]
    : [...new Set(list(hotel?.priceSections ?? hotel?.price_sections).map((s) => s.room_type).filter(Boolean))];
  let best = null;
  for (const t of types) {
    const secs = dates.map((date) => sectionFor(hotel, { roomType: t, mealPlan, date }));
    const missing = secs.filter((s) => !s).length;
    const perNight = secs.map((s) => (s ? Number(s.price) : null));
    const total = perNight.reduce((a, b) => a + (b || 0), 0);
    const priced = perNight.filter((p) => p != null);
    const cand = {
      roomType: t,
      mealPlan: mealPlan || secs.find((s) => s?.meal_plan)?.meal_plan || "",
      // false when the asked-for meal plan only matched untagged rows
      mealPlanOnSheet: !mealPlan || secs.every((s) => !s || s.meal_plan === mealPlan),
      perNight,
      total,
      avg: priced.length ? Math.round(total / priced.length) : null,
      missingNights: missing,
      dated: !!checkIn,
    };
    const better =
      !best ||
      cand.missingNights < best.missingNights ||
      (cand.missingNights === best.missingNights && (cand.avg ?? Infinity) < (best.avg ?? Infinity));
    if (better) best = cand;
  }
  return best && best.avg != null ? best : null;
}

/**
 * Can the rooms be had on those nights? From the hotel's own records only:
 *  unavailable — switched off in the catalog
 *  stop_sale   — a stop-sale covers a night (for this room type or hotel-wide)
 *  full        — rooms already booked + rooms needed > the hotel's room count
 *  blackout    — a blackout date (bookable, but confirm with the hotel)
 *  available   — none of the above (room count known: free rooms are given)
 *  unchecked   — no dates to check against
 * bookedByDate: { "YYYY-MM-DD": rooms already booked that night }.
 */
export function availabilityFor(hotel, { checkIn, checkOut, rooms = 1, roomType = "", blackouts = [], bookedByDate = {} }) {
  if (hotel?.isAvailable === false || hotel?.is_available === false) return { status: "unavailable", note: "Marked unavailable in your catalog" };
  if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) < 1) return { status: "unchecked", note: "No dates to check" };
  const nights = Array.from({ length: nightsBetween(checkIn, checkOut) }, (_, i) => addDays(checkIn, i));
  const hits = (type) =>
    list(blackouts).filter(
      (b) =>
        (b.type || "blackout") === type &&
        (!b.roomType && !b.room_type ? true : !roomType || norm(b.roomType || b.room_type) === norm(roomType)) &&
        nights.some((d) => d >= ymd(b.startDate || b.start_date) && d <= ymd(b.endDate || b.end_date)),
    );
  const stop = hits("stop_sale");
  if (stop.length) {
    const from = stop[0].startDate || stop[0].start_date;
    const to = stop[0].endDate || stop[0].end_date;
    const when = ymd(from) === ymd(to) ? `on ${human(from)}` : `${human(from)} – ${human(to)}`;
    return { status: "stop_sale", note: `Stop sale ${when}${stop[0].note ? ` (${stop[0].note})` : ""}` };
  }
  const total = Number(hotel?.totalRooms ?? hotel?.total_rooms) || 0;
  let free = null;
  if (total > 0) {
    free = Math.min(...nights.map((d) => total - (Number(bookedByDate[d]) || 0)));
    if (free < rooms) return { status: "full", freeRooms: Math.max(0, free), note: `Only ${Math.max(0, free)} of ${total} rooms free on those dates` };
  }
  const black = hits("blackout");
  if (black.length) return { status: "blackout", freeRooms: free, note: "Blackout date — confirm with the hotel" };
  return { status: "available", freeRooms: free, note: free == null ? "No stop-sale; room count not on file" : `${free} room${free === 1 ? "" : "s"} free` };
}

const BOOKABLE = new Set(["available", "blackout", "unchecked"]);
export const isBookable = (availability) => BOOKABLE.has(availability?.status);

/** Loose hotel-name match: every significant word of the query in the name. */
export function nameMatches(hotel, query) {
  const words = norm(query).split(" ").filter((w) => w.length >= 3 && !["hotel", "resort", "the", "and", "spa"].includes(w));
  if (!words.length) return false;
  const name = norm(hotel?.name);
  return words.every((w) => name.includes(w));
}

/**
 * criteria = { city, minStars, maxStars, maxRate, minRate, mealPlan, roomType,
 *              sort: "cheapest" | "best", prefer (hotel name), limit }
 * ctx = { checkIn, checkOut, nights, rooms, today, blackoutsByHotel: {id: []},
 *         bookedByHotel: {id: {date: rooms}} }
 * → { results, preferred, near, checked, excluded }
 *   results   — bookable matches, best first
 *   preferred — the named hotel's own result (and why not, when it isn't usable)
 *   near      — the closest hotel that missed only on price (for an honest "nothing under …")
 */
export function searchHotels(hotels, criteria = {}, ctx = {}) {
  const c = criteria;
  const nights = ctx.checkIn && ctx.checkOut ? nightsBetween(ctx.checkIn, ctx.checkOut) : Math.max(1, Number(ctx.nights) || 1);
  const rooms = Math.max(1, Number(ctx.rooms) || 1);
  const excluded = { city: 0, stars: 0, rate: 0, meal: 0, availability: 0, noRate: 0 };
  const evaluate = (h) => {
    const rate = rateFor(h, { checkIn: ctx.checkIn, nights, roomType: c.roomType, mealPlan: c.mealPlan, today: ctx.today });
    const availability = availabilityFor(h, {
      checkIn: ctx.checkIn,
      checkOut: ctx.checkOut || (ctx.checkIn ? addDays(ctx.checkIn, nights) : null),
      rooms,
      roomType: rate?.roomType || c.roomType,
      blackouts: ctx.blackoutsByHotel?.[h.id] || [],
      bookedByDate: ctx.bookedByHotel?.[h.id] || {},
    });
    return {
      id: h.id,
      name: h.name,
      city: h.city || "",
      stars: starsOf(h),
      roomType: rate?.roomType || "",
      mealPlan: rate?.mealPlan || "",
      mealPlanOnSheet: rate ? rate.mealPlanOnSheet : false,
      rate: rate?.avg ?? null,
      total: rate ? rate.total * rooms : null,
      nights,
      rooms,
      missingNights: rate?.missingNights ?? nights,
      dated: !!ctx.checkIn,
      availability,
    };
  };

  const inCity = list(hotels).filter((h) => !c.city || cityKey(h.city) === cityKey(c.city));
  excluded.city = list(hotels).length - inCity.length;

  let preferred = null;
  if (c.prefer) {
    const h = inCity.find((x) => nameMatches(x, c.prefer)) || list(hotels).find((x) => nameMatches(x, c.prefer));
    if (h) {
      const r = evaluate(h);
      const why = !isBookable(r.availability)
        ? r.availability.note
        : r.rate == null
          ? "No rate on file for those dates"
          : r.missingNights
            ? `No rate for ${r.missingNights} of the nights`
            : "";
      preferred = { ...r, usable: !why, why };
    } else {
      preferred = { name: c.prefer, usable: false, why: "Not in your hotel list" };
    }
  }

  const scored = [];
  let near = null;
  for (const h of inCity) {
    const r = evaluate(h);
    if (c.minStars && !(r.stars >= c.minStars)) { excluded.stars++; continue; }
    if (c.maxStars && !(r.stars != null && r.stars <= c.maxStars)) { excluded.stars++; continue; }
    if (r.rate == null || r.missingNights) {
      if (c.mealPlan && rateFor(h, { checkIn: ctx.checkIn, nights, roomType: c.roomType, today: ctx.today })) excluded.meal++;
      else excluded.noRate++;
      continue;
    }
    if (!isBookable(r.availability)) { excluded.availability++; continue; }
    if ((c.maxRate && r.rate > c.maxRate) || (c.minRate && r.rate < c.minRate)) {
      excluded.rate++;
      if (c.maxRate && r.rate > c.maxRate && (!near || r.rate < near.rate)) near = r;
      continue;
    }
    scored.push(r);
  }

  // Ranking: bookable without caveats first; then the asked-for order.
  const caveat = (r) => (r.availability.status === "available" ? 0 : 1) + (r.mealPlanOnSheet ? 0 : 1);
  const sort = c.sort === "cheapest" ? "cheapest" : "best";
  scored.sort((a, b) => {
    if (caveat(a) !== caveat(b)) return caveat(a) - caveat(b);
    if (sort === "best") return (b.stars || 0) - (a.stars || 0) || a.rate - b.rate;
    return a.rate - b.rate || (b.stars || 0) - (a.stars || 0);
  });
  return {
    results: scored.slice(0, Math.max(1, Number(c.limit) || 5)),
    total: scored.length,
    preferred,
    near,
    checked: inCity.length,
    excluded,
  };
}

/** Rooms booked per night per hotel, from accommodation rows ({hotelId, checkIn, checkOut, rooms, cancelledAt}). */
export function bookedByHotel(accommodations) {
  const out = {};
  for (const a of list(accommodations)) {
    if (!a?.hotelId || a.cancelledAt || !a.checkIn || !a.checkOut) continue;
    const n = nightsBetween(ymd(a.checkIn), ymd(a.checkOut));
    const rooms = parseInt(a.rooms, 10) || 1;
    const by = (out[a.hotelId] = out[a.hotelId] || {});
    for (let i = 0; i < n; i++) {
      const d = addDays(ymd(a.checkIn), i);
      by[d] = (by[d] || 0) + rooms;
    }
  }
  return out;
}
