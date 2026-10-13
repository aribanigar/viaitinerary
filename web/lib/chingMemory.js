import prisma from "@/lib/prisma";

// Ching's memory for one agency (tenant), read by the Ching widget and the
// Trip Builder's voice fill.
//
// Two halves:
//  - LEARNED: computed from the agency's own saved trips on every read, so
//    Ching keeps learning as trips are made and edited — the hotel the agents
//    actually book in each city, the cab they use for a group size, the usual
//    meal plan, how they split a destination's nights, and returning clients'
//    phone / email. Nothing is stored for this half.
//  - TOLD: what an agent asked Ching to remember (ChingMemory rows) — aliases
//    ("when I say Heaven I mean Heevan Resort"), a preferred hotel per city,
//    notes, and what to call them. Told preferences win over learned ones.

const LOOKBACK_TRIPS = 300;
const NOISE = new Set(["city", "town", "district", "valley", "the", "kashmir", "jk", "j", "k", "india", "and", "of"]);

/** Same normalisation as the frontend's utils/ching/places.js placeKey. */
export function placeKey(s) {
  const words = String(s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const sig = words.filter((w) => !NOISE.has(w));
  return (sig.length ? sig : words).join(" ");
}

const nightsOf = (a) =>
  a.checkIn && a.checkOut ? Math.max(0, Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000)) : 0;

const top = (counts, min = 1) =>
  [...counts.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]);

/** Habits learned from the agency's recent trips. */
export async function learnedMemory(adminId) {
  const trips = await prisma.trip.findMany({
    where: { userId: adminId, isPackage: false },
    orderBy: { updatedAt: "desc" },
    take: LOOKBACK_TRIPS,
    select: {
      tripId: true,
      tripTitle: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      destination: true,
      duration: true,
      adults: true,
      kids5to12: true,
      startDate: true,
      updatedAt: true,
      accommodations: { select: { hotelId: true, city: true, mealPlan: true, checkIn: true, checkOut: true, cancelledAt: true } },
      transportations: { select: { vehicleId: true } },
    },
  });

  const hotelCounts = new Map(); // cityKey -> Map(hotelId -> n)
  const vehicleStats = new Map(); // vehicleId -> { n, min, max }
  const meals = new Map();
  const routes = new Map(); // "dest|nights" -> Map(json -> n)
  const clients = new Map(); // name key -> client

  for (const t of trips) {
    const stays = t.accommodations
      .filter((a) => !a.cancelledAt)
      .sort((a, b) => new Date(a.checkIn || 0) - new Date(b.checkIn || 0));
    for (const a of stays) {
      if (a.hotelId && a.city) {
        const k = placeKey(a.city);
        if (!hotelCounts.has(k)) hotelCounts.set(k, new Map());
        const m = hotelCounts.get(k);
        m.set(a.hotelId, (m.get(a.hotelId) || 0) + 1);
      }
      if (a.mealPlan) meals.set(a.mealPlan, (meals.get(a.mealPlan) || 0) + 1);
    }
    const guests = (t.adults || 0) + (t.kids5to12 || 0);
    for (const id of new Set(t.transportations.map((x) => x.vehicleId).filter(Boolean))) {
      const v = vehicleStats.get(id) || { n: 0, min: guests, max: guests };
      v.n += 1;
      v.min = Math.min(v.min, guests);
      v.max = Math.max(v.max, guests);
      vehicleStats.set(id, v);
    }
    const nights = Number(t.duration) || stays.reduce((n, a) => n + nightsOf(a), 0);
    if (t.destination && nights && stays.length) {
      // Merge consecutive stays in the same city: [{ city, nights }].
      const split = [];
      for (const a of stays) {
        const last = split[split.length - 1];
        if (last && placeKey(last.city) === placeKey(a.city)) last.nights += nightsOf(a);
        else split.push({ city: String(a.city || "").split(",")[0].trim(), nights: nightsOf(a) });
      }
      if (split.reduce((n, r) => n + r.nights, 0) === nights) {
        const key = `${placeKey(t.destination)}|${nights}`;
        if (!routes.has(key)) routes.set(key, new Map());
        const m = routes.get(key);
        const sig = JSON.stringify(split);
        m.set(sig, (m.get(sig) || 0) + 1);
      }
    }
    if (t.clientName) {
      const k = placeKey(t.clientName);
      const c = clients.get(k) || { name: t.clientName.trim(), phone: "", email: "", trips: 0, last_trip_id: t.tripId, last_trip: t.tripTitle };
      c.trips += 1;
      // Trips are newest first: keep the most recent non-empty contact details.
      if (!c.phone && String(t.clientPhone || "").replace(/\D/g, "").length >= 10) c.phone = t.clientPhone;
      if (!c.email && t.clientEmail) c.email = t.clientEmail;
      clients.set(k, c);
    }
  }

  const hotels = {};
  for (const [city, m] of hotelCounts) hotels[city] = top(m).map(([id]) => id);
  const vehicles = [...vehicleStats.entries()].map(([id, v]) => ({ id, n: v.n, minGuests: v.min, maxGuests: v.max }));
  const mealTop = top(meals, 3)[0];
  const routeMap = {};
  for (const [key, m] of routes) {
    const best = top(m, 2)[0];
    if (best) routeMap[key] = JSON.parse(best[0]);
  }
  return {
    trips_learned_from: trips.length,
    hotels,
    vehicles,
    mealPlan: mealTop ? mealTop[0] : null,
    routes: routeMap,
    clients: [...clients.values()].slice(0, 500),
  };
}

/** What the agency told Ching to remember (callMe is the asking user's own). */
export async function toldMemory(adminId, userId = null) {
  // Conversations live in the same table (kind "conversation") but are never part of memory.
  const rows = await prisma.chingMemory.findMany({ where: { userId: adminId, kind: { in: [...MEMORY_KINDS, HOTEL_TAG_KIND] } }, orderBy: { updatedAt: "desc" } });
  const aliases = {};
  const hotels = {};
  const hotelTags = {};
  const notes = [];
  let callMe = null;
  let agencyName = null; // a pre-per-user "me" row, used until this user sets their own
  for (const r of rows) {
    if (r.kind === HOTEL_TAG_KIND) hotelTags[r.key] = splitTags(r.value);
    else if (r.kind === "alias") aliases[r.key] = r.value;
    else if (r.kind === "hotel") hotels[r.key] = [Number(r.value)].filter(Number.isFinite);
    else if (r.kind === "note") notes.push({ key: r.key, text: r.value, at: r.updatedAt.toISOString() });
    else if (r.kind === "name" && userId != null && r.key === `me:${userId}`) callMe = r.value;
    else if (r.kind === "name" && r.key === "me" && !agencyName) agencyName = r.value;
  }
  return { aliases, hotels, hotelTags, notes, callMe: callMe || agencyName };
}

/** Learned + told, told winning (a told hotel goes ahead of the learned ones). */
export async function chingMemory(adminId, userId = null) {
  const [learned, told] = await Promise.all([learnedMemory(adminId), toldMemory(adminId, userId)]);
  const hotels = { ...learned.hotels };
  for (const [city, ids] of Object.entries(told.hotels)) {
    hotels[city] = [...ids, ...(hotels[city] || []).filter((id) => !ids.includes(id))];
  }
  return { ...learned, hotels, aliases: told.aliases, notes: told.notes, callMe: told.callMe, told_hotels: told.hotels, hotelTags: told.hotelTags };
}

export const MEMORY_KINDS = new Set(["alias", "hotel", "note", "name"]);

// Two more kinds of row share the ChingMemory table (so neither needs a schema
// change), and neither is "what the agency told Ching": they are never listed
// by "what do you remember", never wiped by "forget everything", and don't
// count towards the 500-row memory limit.
//  - "hoteltag": key = hotel id, value = the hotel's tags, comma-joined — what
//    Ching's meaning tree (frontend utils/ching/meaning.js) searches hotels by.
//  - "conversation": key = "u:<userId>", value = that agent's conversation with
//    Ching as JSON (lib/chingConversation.js).
export const HOTEL_TAG_KIND = "hoteltag";
export const CONVERSATION_KIND = "conversation";

// The tag vocabulary. Keep in step with TAG_GROUPS in frontend/src/utils/ching/meaning.js.
export const HOTEL_TAGS = new Set([
  "riverside", "lake-view", "mountain-view", "valley-view", "garden", "snow-view",
  "quiet", "romantic", "lively", "heritage", "boutique", "luxury", "budget",
  "family", "honeymoon", "groups", "seniors", "solo", "pets",
  "houseboat", "resort", "cottage", "homestay", "camp",
  "central", "near-airport", "near-gondola", "near-market", "near-lake", "secluded",
  "spa", "pool", "heating", "parking", "restaurant", "lift", "wifi", "bonfire",
]);
export const splitTags = (v) => [...new Set(String(v || "").split(",").map((t) => t.trim()).filter((t) => HOTEL_TAGS.has(t)))];

/** { hotelId: [tags] } for the agency. */
export async function hotelTagMap(adminId) {
  const rows = await prisma.chingMemory.findMany({ where: { userId: adminId, kind: HOTEL_TAG_KIND }, select: { key: true, value: true } });
  const out = {};
  for (const r of rows) out[r.key] = splitTags(r.value);
  return out;
}

/** Set one hotel's tags (an empty list removes the row). The hotel must be the agency's own. → tags | null */
export async function setHotelTags(adminId, hotelId, tags, userId = null) {
  const id = Number(hotelId);
  const hotel = Number.isInteger(id) ? await prisma.hotel.findFirst({ where: { id, userId: adminId }, select: { id: true } }) : null;
  if (!hotel) return null;
  const clean = splitTags((Array.isArray(tags) ? tags : []).join(","));
  const where = { userId_kind_key: { userId: adminId, kind: HOTEL_TAG_KIND, key: String(id) } };
  if (!clean.length) {
    await prisma.chingMemory.deleteMany({ where: { userId: adminId, kind: HOTEL_TAG_KIND, key: String(id) } });
    return [];
  }
  await prisma.chingMemory.upsert({
    where,
    create: { userId: adminId, kind: HOTEL_TAG_KIND, key: String(id), value: clean.join(","), createdBy: userId },
    update: { value: clean.join(","), createdBy: userId },
  });
  return clean;
}
