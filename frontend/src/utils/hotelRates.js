// Hotel rate-sheet helpers shared by the Trip Builder's hotel picker and Ching,
// so a hotel added by voice is priced exactly like one picked in the modal.

export const normalizeRoomTypeValue = (value) => String(value || "").trim();

export const toRoomTypeSlug = (value) =>
  normalizeRoomTypeValue(value).toLowerCase().replace(/\s+/g, "_");

// The Hotel catalog stores star rating as a bare digit ("5"); the trip
// builder's Hotel Category field stores it as "5 Star" — convert when
// pulling a category over from the master hotel record.
export const hotelCategoryLabel = (digit) => {
  const n = String(digit || "").trim();
  return n ? `${n} Star` : "";
};

/** Distinct room types on a hotel's rate sheet, in sheet order. */
export const hotelRoomTypes = (hotel) =>
  (hotel?.price_sections || [])
    .map((section) => normalizeRoomTypeValue(section.room_type))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Any date the app holds → "YYYY-MM-DD" (or "" when unreadable). The Trip
 * Builder's date pickers give "DD-MM-YYYY", which new Date() reads as
 * month-first ("10-05-2026" became 5 October), so a stay got the wrong
 * season's rate. Rate sheets store "YYYY-MM-DD" (or a full ISO time).
 */
export const isoDay = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return isoDay(new Date(s));
};

const isDated = (section) => !!(section.valid_from || section.valid_to);

const sectionMatchesSeason = (section, dateStr) => {
  if (!isDated(section)) return true;
  const day = isoDay(dateStr);
  if (!day) return false;
  if (section.valid_from && day < isoDay(section.valid_from)) return false;
  if (section.valid_to && day > isoDay(section.valid_to)) return false;
  return true;
};

const roomTypeRows = (hotel, roomTypeValue) => {
  if (!hotel || !roomTypeValue) return [];
  const normalized = normalizeRoomTypeValue(roomTypeValue);
  return (hotel.price_sections || []).filter(
    (section) =>
      normalizeRoomTypeValue(section.room_type) === normalized ||
      toRoomTypeSlug(section.room_type) === toRoomTypeSlug(normalized),
  );
};

// The row for the date: the season (valid_from/valid_to) that covers it, else
// an always-valid row. With a date, a season that doesn't cover it is never
// used (that silently priced May stays at the winter rate). Without a date,
// any row will do.
const pickForDate = (rows, dateStr) =>
  rows.find((section) => isDated(section) && isoDay(dateStr) && sectionMatchesSeason(section, dateStr)) ||
  rows.find((section) => !isDated(section)) ||
  (isoDay(dateStr) ? undefined : rows[0]) ||
  {};

/** A room type's rate row for a date, whatever its meal plan. */
export const findRoomTypeSection = (hotel, roomTypeValue, dateStr) =>
  pickForDate(roomTypeRows(hotel, roomTypeValue), dateStr);

// Builder meal-plan labels ↔ rate-sheet meal_plan keys (hotel search, Ching).
export const MEAL_PLAN_LABEL = {
  room_only: "Only Room",
  breakfast_only: "Only Room + Breakfast",
  breakfast_dinner: "Breakfast + Dinner",
  all_meals: "Breakfast + Lunch + Dinner",
};

/**
 * The rate row for a room type AND meal plan on a date ("Deluxe with
 * breakfast" is a different price from "Deluxe, breakfast and dinner").
 * Rows with no meal plan still count, so older hand-made sheets keep working,
 * but another meal plan's row never stands in: no row → {} (no rate).
 * mealPlan: rate-sheet key ("breakfast_only") or builder label.
 */
export const findRateSection = (hotel, roomTypeValue, dateStr, mealPlan) => {
  const key = mealPlanKey(mealPlan);
  if (!key) return findRoomTypeSection(hotel, roomTypeValue, dateStr);
  const rows = roomTypeRows(hotel, roomTypeValue);
  const exact = pickForDate(rows.filter((s) => s.meal_plan === key), dateStr);
  if (exact.price) return exact;
  return pickForDate(rows.filter((s) => !s.meal_plan), dateStr);
};

/** Extra-bed / child prices from a rate-sheet section, in the builder's bedPrices shape. */
export const bedPricesFromSection = (section = {}) =>
  [
    { category: "cnb", price: section.cnb || 0 },
    { category: "5_to_12", price: section.upto_5 || 0 },
    { category: "above_12", price: section.above_12 || 0 },
    { category: "extra_adult", price: section.extra_adult || 0 },
  ].filter((bp) => bp.price > 0);

/** "Breakfast + Dinner" (builder label) or "breakfast_dinner" → "breakfast_dinner"; unknown → "". */
export const mealPlanKey = (value) =>
  MEAL_PLAN_LABEL[value]
    ? value
    : Object.keys(MEAL_PLAN_LABEL).find((k) => MEAL_PLAN_LABEL[k] === value) || "";

/**
 * The rate-sheet row the Trip Builder prices a stay from: room type + meal
 * plan + date. {} when the sheet has no rate for that combination; the
 * builder then says so instead of quoting another meal plan's price.
 */
export const rateSectionFor = (hotel, roomTypeValue, dateStr, mealPlan) =>
  findRateSection(hotel, roomTypeValue, dateStr, mealPlan);

/** Builder label of a rate row's meal plan ("Breakfast + Dinner"), or "". */
export const mealPlanLabelOf = (section) => MEAL_PLAN_LABEL[section?.meal_plan] || "";

// The nights of a stay as "YYYY-MM-DD": check-in up to the night before
// check-out. No (or a bad) check-out → just the check-in night.
export const stayNights = (checkIn, checkOut) => {
  const a = isoDay(checkIn);
  if (!a) return [];
  const b = isoDay(checkOut);
  if (!b || b <= a) return [a];
  const out = [];
  const end = Date.parse(`${b}T00:00:00Z`);
  for (let t = Date.parse(`${a}T00:00:00Z`); t < end && out.length < 90; t += 864e5) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

const RATE_KEYS = ["price", "cnb", "upto_5", "above_12", "extra_adult"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The rate for a whole stay, night by night: each night is priced from the
 * season that covers it (room type + meal plan). Returns a rate-row-shaped
 * object (so bedPricesFromSection works) plus:
 *   nights:  [{ date, price }] — each night's room rate,
 *   missing: dates with no rate (then price is unset),
 *   mixed:   true when the nights fall in different seasons; price and the
 *            extra-bed rates are then the average per night, so
 *            price × nights is exactly the night-by-night total.
 */
export const stayRateFor = (hotel, roomTypeValue, checkIn, checkOut, mealPlan) => {
  const dates = stayNights(checkIn, checkOut);
  if (!dates.length) {
    const row = rateSectionFor(hotel, roomTypeValue, checkIn, mealPlan);
    return { ...row, nights: [], missing: [], mixed: false };
  }
  const rows = dates.map((d) => rateSectionFor(hotel, roomTypeValue, d, mealPlan));
  const nights = dates.map((date, i) => ({ date, price: Number(rows[i].price) || 0 }));
  const missing = dates.filter((_, i) => !rows[i].price);
  if (missing.length) return { nights, missing, mixed: false };
  if (rows.every((r) => r === rows[0])) return { ...rows[0], nights, missing: [], mixed: false };
  const avg = {};
  for (const key of RATE_KEYS) avg[key] = round2(rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0) / rows.length);
  return { ...rows[0], ...avg, valid_from: null, valid_to: null, nights, missing: [], mixed: true };
};
