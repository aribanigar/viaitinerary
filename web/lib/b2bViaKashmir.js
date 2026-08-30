// Import bridge for the Via Kashmir B2B rate portal (a separate Next.js +
// Supabase app — see https://github.com/viakashmir/b2bviakashmir). Its
// GET /api/hotels endpoint is public (no key) and returns approved, in-tariff
// hotels with nested rooms; this module fetches that feed and maps it onto
// this app's Hotel + price_sections shape for prisma.hotel.upsert.

const DEFAULT_BASE_URL = "https://b2b.viakashmiritinerary.in";
export const B2B_SOURCE = "b2b_viakashmir";

const MEAL_PLAN_BY_FIELD = {
  ep: "room_only",
  cp: "breakfast_only",
  map: "breakfast_dinner",
  ap: "all_meals",
};

const STATE_BY_LOCATION = {
  leh: "Ladakh",
};
const DEFAULT_STATE = "Jammu and Kashmir";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "room";

/** Explode a B2B room's per-meal-plan rates into this app's price_sections rows. */
function roomToPriceSections(room, tariffStart, tariffEnd) {
  const roomType = slugify(room.category || room.type);
  const cnb = Number(room.childWob ?? room.cnb ?? 0) || 0;
  const sections = [];
  for (const [field, mealPlan] of Object.entries(MEAL_PLAN_BY_FIELD)) {
    const price = Number(room[field] ?? 0);
    if (!price) continue;
    sections.push({
      room_type: roomType,
      meal_plan: mealPlan,
      price,
      cnb,
      valid_from: tariffStart || null,
      valid_to: tariffEnd || null,
    });
  }
  return sections;
}

/** Map one B2B `Hotel` (with nested `rooms`) onto this app's Hotel fields. */
export function mapB2BHotel(hotel) {
  const priceSections = (hotel.rooms || []).flatMap((room) =>
    roomToPriceSections(room, hotel.tariffStart, hotel.tariffEnd),
  );
  const totalRooms = (hotel.rooms || []).reduce(
    (sum, r) => sum + (Number(r.inventory) || 0),
    0,
  );

  return {
    name: hotel.name,
    address: hotel.address || null,
    city: hotel.locationLabel || null,
    state: STATE_BY_LOCATION[hotel.location] || DEFAULT_STATE,
    country: "India",
    category: hotel.stars ? String(hotel.stars) : null,
    email: hotel.email || null,
    phone: hotel.whatsapp || hotel.phone || null,
    isAvailable: true,
    totalRooms: totalRooms || null,
    priceSections,
    externalSource: B2B_SOURCE,
    externalId: hotel.id,
    lastSyncedAt: new Date(),
  };
}

/** Fetch the live, public "approved & in-tariff" hotel feed. */
export async function fetchB2BHotels() {
  const baseUrl = (process.env.B2B_VIAKASHMIR_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}/api/hotels`, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Via Kashmir B2B feed responded ${resp.status}`);
  }
  const json = await resp.json();
  if (!Array.isArray(json.hotels)) {
    throw new Error("Via Kashmir B2B feed returned an unexpected shape");
  }
  return json.hotels;
}
