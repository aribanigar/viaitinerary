// Deterministic, no-AI itinerary rules engine. Pure functions only — no
// Prisma/network calls in here, so the whole thing can be unit-traced with
// plain JS objects (see scripts/trace-itinerary.mjs).
//
// Given a destination + traveler count + days + budget + profit, this picks
// a hotel, a vehicle, a day-by-day activity plan, and a set of complementary
// extras from the agency's own catalogs, at three price points (Budget /
// Recommended / Premium), and returns everything needed to create a real,
// fully-editable Trip via /api/trips's existing create contract.

// Heuristic split of the money actually available to spend (after profit is
// carved out) across the components of a trip. Tunable; buffer absorbs
// rounding and (when the agency's costActivities setting is on) activity
// cost, so a plan is more likely to land inside budget rather than over it.
const HOTEL_SHARE = 0.55;
const VEHICLE_SHARE = 0.2;
const COMPLEMENTARY_SHARE = 0.1;
const BUFFER_SHARE = 1 - HOTEL_SHARE - VEHICLE_SHARE - COMPLEMENTARY_SHARE;

const TIER_DEFS = [
  { key: "budget", label: "Budget", hotelCeilingMult: 0.85, vehicleCeilingMult: 0.85, complementaryMult: 0.5 },
  { key: "recommended", label: "Recommended", hotelCeilingMult: 1.0, vehicleCeilingMult: 1.0, complementaryMult: 1.0 },
  { key: "premium", label: "Premium", hotelCeilingMult: 1.4, vehicleCeilingMult: 1.4, complementaryMult: 1.5 },
];

/**
 * Invert TripBuilder.jsx's pricing formula
 * (`total = (netCost + netCost*gst%) * (1 + margin%)`) to find the maximum
 * netCost (hotel+vehicle+activities+complementary) that still lands the
 * client-facing selling price at or under the entered budget, given the
 * chosen profit.
 */
export function computeMaxNetCost({ budget, profitType, profitValue, gstPercent = 0, includeGst = true }) {
  const b = Number(budget) || 0;
  const gst = includeGst ? Number(gstPercent) || 0 : 0;

  let costWithGst;
  if (profitType === "fixed") {
    costWithGst = b - (Number(profitValue) || 0);
  } else {
    const marginPct = Number(profitValue) || 0;
    costWithGst = b / (1 + marginPct / 100);
  }
  costWithGst = Math.max(0, costWithGst);

  const netCost = gst ? costWithGst / (1 + gst / 100) : costWithGst;
  const profitAmount = b - costWithGst;
  const gstAmount = costWithGst - netCost;

  return { maxNetCost: Math.max(0, netCost), profitAmount, gstAmount, costWithGst };
}

/** Reapply the same formula forward, for reporting a tier's actual selling price. */
function priceFromNetCost(netCost, { profitType, profitValue, gstPercent = 0, includeGst = true }) {
  const gst = includeGst ? Number(gstPercent) || 0 : 0;
  const gstAmount = netCost * (gst / 100);
  const costWithGst = netCost + gstAmount;
  const sellingPrice =
    profitType === "fixed"
      ? costWithGst + (Number(profitValue) || 0)
      : costWithGst * (1 + (Number(profitValue) || 0) / 100);
  return { gstAmount, costWithGst, sellingPrice, profitAmount: sellingPrice - costWithGst };
}

const norm = (s) => String(s || "").trim().toLowerCase();
const textOverlap = (a, b) => {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
};

/** Fuzzy destination↔hotel match: no rigid city hierarchy exists yet, so this
 * matches free-text against whatever location fields each side has. */
function hotelMatchesDestination(hotel, destination) {
  return (
    textOverlap(hotel.city, destination.name) ||
    textOverlap(hotel.state, destination.name) ||
    (destination.city && textOverlap(hotel.city, destination.city)) ||
    (destination.state && textOverlap(hotel.state, destination.state))
  );
}

/** Cheapest price_sections row for a hotel, preferring the requested meal plan. */
function cheapestPriceSection(hotel, mealPlan) {
  const sections = (Array.isArray(hotel.price_sections) ? hotel.price_sections : []).filter(
    (s) => Number(s?.price) > 0,
  );
  if (!sections.length) return null;
  const matching = mealPlan ? sections.filter((s) => s.meal_plan === mealPlan) : [];
  const pool = matching.length ? matching : sections;
  return pool.reduce((min, s) => (Number(s.price) < Number(min.price) ? s : min), pool[0]);
}

const starCategory = (h) => Number(h.category) || 0;

/** Hotels serving this destination, each annotated with its cheapest nightly
 * rate and total stay cost — cheapest-first. Hotels with no usable
 * price_sections are dropped (can't be costed, so can't be auto-picked). */
function candidateHotels(hotels, destination, { nights, rooms, mealPlan }) {
  return (hotels || [])
    .filter((h) => h.is_available !== false)
    .filter((h) => hotelMatchesDestination(h, destination))
    .map((h) => {
      const section = cheapestPriceSection(h, mealPlan);
      if (!section) return null;
      const nightlyPrice = Number(section.price) || 0;
      return { hotel: h, section, nightlyPrice, totalCost: nightlyPrice * rooms * nights };
    })
    .filter(Boolean)
    .sort((a, b) => starCategory(a.hotel) - starCategory(b.hotel) || a.totalCost - b.totalCost);
}

/** Vehicles with enough seats — cheapest-first. No destination filter (per
 * design decision — an agency's fleet isn't necessarily location-pinned). */
function candidateVehicles(vehicles, travelerCount) {
  return (vehicles || [])
    .filter((v) => v.is_available !== false)
    .filter((v) => v.seating_capacity == null || v.seating_capacity >= travelerCount)
    .map((v) => ({ vehicle: v, totalCost: Number(v.price) || 0 }))
    .sort((a, b) => a.totalCost - b.totalCost);
}

/** Pick one hotel/vehicle candidate for a tier: the best-fitting option under
 * the tier's ceiling, preferring the highest-cost one that still fits (so
 * Premium genuinely upgrades rather than just picking the cheapest again) —
 * falling back to the cheapest option overall (flagged over-budget by the
 * caller) if nothing fits at all. */
function pickForCeiling(candidates, ceiling) {
  if (!candidates.length) return null;
  const fitting = candidates.filter((c) => c.totalCost <= ceiling);
  if (fitting.length) return fitting[fitting.length - 1];
  return candidates[0]; // cheapest available, even though it's over ceiling
}

const activityCostPerPerson = (a) => (typeof a === "string" ? 0 : Number(a?.cost) || 0);
const activityName = (a) => (typeof a === "string" ? a : a?.name || "");

/** Distribute destination activities across the trip's days. Always fills
 * every non-arrival/departure day with real content (for a complete-looking
 * itinerary) — only the *cost* is conditional on costActivities/budget. */
function buildActivityPlan(activities, days, { costActivities, activityBudget, travelerCount }) {
  const pool = (activities || []).map((a) => activityName(a)).filter(Boolean);
  const costs = (activities || []).reduce((map, a) => {
    const name = activityName(a);
    if (name) map[name] = activityCostPerPerson(a);
    return map;
  }, {});

  const activitiesByDay = [];
  let spent = 0;
  let idx = 0;
  for (let day = 0; day < days; day++) {
    const isFirst = day === 0;
    const isLast = day === days - 1 && days > 1;
    const target = isLast ? 0 : isFirst ? 1 : 3;
    const picked = [];
    for (let n = 0; n < target && pool.length; n++) {
      const name = pool[idx % pool.length];
      idx++;
      const cost = costActivities ? (costs[name] || 0) * travelerCount : 0;
      if (costActivities && picked.length > 0 && spent + cost > activityBudget) break;
      picked.push(name);
      spent += cost;
    }
    activitiesByDay.push(picked);
  }
  return { activitiesByDay, totalCost: spent };
}

/** Pick complementary catalog items (cheapest-first) up to a budget — always
 * includes at least one if the catalog is non-empty and the budget is > 0. */
function pickComplementary(services, budget) {
  const pool = (services || [])
    .filter((s) => s.is_active !== false)
    .map((s) => ({ service: s, price: Number(s.selling_price) || 0 }))
    .sort((a, b) => a.price - b.price);
  const picked = [];
  let spent = 0;
  for (const item of pool) {
    if (picked.length > 0 && spent + item.price > budget) break;
    picked.push(item.service);
    spent += item.price;
  }
  return { picked, totalCost: spent };
}

/**
 * Compute Budget/Recommended/Premium tiers for one set of trip inputs.
 *
 * @param input {destinationId, adults, kids5to12, kidsCnb, days, budget,
 *   profitType, profitValue, mealPlan}
 * @param catalogs {destination, hotels, vehicles, complementaryServices,
 *   gstPercent, includeGst, costActivities}
 */
export function computeItineraryTiers(input, catalogs) {
  const adults = Math.max(1, Number(input.adults) || 1);
  const kids5to12 = Math.max(0, Number(input.kids5to12) || 0);
  const kidsCnb = Math.max(0, Number(input.kidsCnb) || 0);
  const travelerCount = adults + kids5to12 + kidsCnb;
  const days = Math.max(1, Number(input.days) || 1);
  const nights = Math.max(1, days - 1);
  const rooms = Math.max(1, Math.ceil(adults / 2));

  const { maxNetCost } = computeMaxNetCost({
    budget: input.budget,
    profitType: input.profitType,
    profitValue: input.profitValue,
    gstPercent: catalogs.gstPercent,
    includeGst: catalogs.includeGst,
  });

  const hotelBudget = maxNetCost * HOTEL_SHARE;
  const vehicleBudget = maxNetCost * VEHICLE_SHARE;
  const complementaryBudget = maxNetCost * COMPLEMENTARY_SHARE;
  const bufferBudget = maxNetCost * BUFFER_SHARE;
  // Activities (when costed) draw from the buffer rather than their own
  // slice — there's no dedicated allocation for them in the split above.
  const activityBudget = bufferBudget;

  const hotels = candidateHotels(catalogs.hotels, catalogs.destination, {
    nights,
    rooms,
    mealPlan: input.mealPlan,
  });
  const vehicles = candidateVehicles(catalogs.vehicles, travelerCount);

  const tiers = TIER_DEFS.map((tierDef) => {
    const hotelPick = pickForCeiling(hotels, hotelBudget * tierDef.hotelCeilingMult);
    const vehiclePick = pickForCeiling(vehicles, vehicleBudget * tierDef.vehicleCeilingMult);

    const activityPlan = buildActivityPlan(catalogs.destination?.activities, days, {
      costActivities: !!catalogs.costActivities,
      activityBudget,
      travelerCount,
    });

    const complementary = pickComplementary(
      catalogs.complementaryServices,
      complementaryBudget * tierDef.complementaryMult,
    );

    const hotelCost = hotelPick?.totalCost || 0;
    const vehicleCost = vehiclePick?.totalCost || 0;
    const netCost = hotelCost + vehicleCost + activityPlan.totalCost + complementary.totalCost;

    const pricing = priceFromNetCost(netCost, {
      profitType: input.profitType,
      profitValue: input.profitValue,
      gstPercent: catalogs.gstPercent,
      includeGst: catalogs.includeGst,
    });

    const overBy = Math.max(0, pricing.sellingPrice - (Number(input.budget) || 0));
    const budgetFit = overBy > 1 ? "over" : "under";

    return {
      key: tierDef.key,
      label: tierDef.label,
      hotel: hotelPick?.hotel || null,
      hotelNightlyPrice: hotelPick?.nightlyPrice ?? null,
      hotelMealPlan: hotelPick?.section?.meal_plan ?? null,
      hotelRoomType: hotelPick?.section?.room_type ?? null,
      vehicle: vehiclePick?.vehicle || null,
      activitiesByDay: activityPlan.activitiesByDay,
      complementary: complementary.picked,
      nights,
      rooms,
      travelerCount,
      costBreakdown: {
        hotelCost,
        vehicleCost,
        activityCost: activityPlan.totalCost,
        complementaryCost: complementary.totalCost,
        netCost,
        gstAmount: pricing.gstAmount,
        profitAmount: pricing.profitAmount,
        sellingPrice: pricing.sellingPrice,
      },
      budgetFit,
      overBy: budgetFit === "over" ? overBy : 0,
    };
  });

  return { tiers, days, nights, rooms, travelerCount, maxNetCost };
}
