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

const sectionMatchesSeason = (section, dateStr) => {
  if (!section.valid_from && !section.valid_to) return true;
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (section.valid_from && date < new Date(section.valid_from)) return false;
  if (section.valid_to && date > new Date(section.valid_to)) return false;
  return true;
};

// Matches by room type, then prefers whichever section's season (valid_from/
// valid_to) actually covers the given date — falls back to an always-valid
// (no date range) section, then to any matching-room-type section at all.
export const findRoomTypeSection = (hotel, roomTypeValue, dateStr) => {
  if (!hotel || !roomTypeValue) return {};

  const normalized = normalizeRoomTypeValue(roomTypeValue);
  const sections = hotel.price_sections || [];

  const matching = sections.filter(
    (section) =>
      normalizeRoomTypeValue(section.room_type) === normalized ||
      toRoomTypeSlug(section.room_type) === toRoomTypeSlug(normalized),
  );

  return (
    matching.find((section) => dateStr && sectionMatchesSeason(section, dateStr) && (section.valid_from || section.valid_to)) ||
    matching.find((section) => !section.valid_from && !section.valid_to) ||
    matching[0] ||
    {}
  );
};

// Builder meal-plan labels ↔ rate-sheet meal_plan keys (hotel search, Ching).
export const MEAL_PLAN_LABEL = {
  room_only: "Only Room",
  breakfast_only: "Only Room + Breakfast",
  breakfast_dinner: "Breakfast + Dinner",
  all_meals: "Breakfast + Lunch + Dinner",
};

/**
 * findRoomTypeSection, narrowed to one meal plan when the rate sheet has it
 * ("Deluxe with breakfast" is a different price from "Deluxe room only").
 * Untagged rows still count, so older hand-made rate sheets keep working.
 */
export const findRateSection = (hotel, roomTypeValue, dateStr, mealPlan) => {
  if (!mealPlan) return findRoomTypeSection(hotel, roomTypeValue, dateStr);
  const sections = hotel?.price_sections || [];
  const exact = sections.filter((s) => s.meal_plan === mealPlan);
  const pool = exact.length ? exact : sections.filter((s) => !s.meal_plan);
  return findRoomTypeSection({ ...hotel, price_sections: pool }, roomTypeValue, dateStr);
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
 * The rate-sheet row the Trip Builder prices a stay from: the chosen meal
 * plan's row when the sheet has one, otherwise any row for the room type
 * (sheets that only carry one meal plan, or none, keep pricing as before).
 */
export const rateSectionFor = (hotel, roomTypeValue, dateStr, mealPlan) => {
  const key = mealPlanKey(mealPlan);
  const section = key ? findRateSection(hotel, roomTypeValue, dateStr, key) : {};
  return section.price ? section : findRoomTypeSection(hotel, roomTypeValue, dateStr);
};
