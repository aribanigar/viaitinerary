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
  const rows = await prisma.chingMemory.findMany({ where: { userId: adminId }, orderBy: { updatedAt: "desc" } });
  const aliases = {};
  const hotels = {};
  const notes = [];
  let callMe = null;
  let agencyName = null; // a pre-per-user "me" row, used until this user sets their own
  for (const r of rows) {
    if (r.kind === "alias") aliases[r.key] = r.value;
    else if (r.kind === "hotel") hotels[r.key] = [Number(r.value)].filter(Number.isFinite);
    else if (r.kind === "note") notes.push({ key: r.key, text: r.value, at: r.updatedAt.toISOString() });
    else if (r.kind === "name" && userId != null && r.key === `me:${userId}`) callMe = r.value;
    else if (r.kind === "name" && r.key === "me" && !agencyName) agencyName = r.value;
  }
  return { aliases, hotels, notes, callMe: callMe || agencyName };
}

/** Learned + told, told winning (a told hotel goes ahead of the learned ones). */
export async function chingMemory(adminId, userId = null) {
  const [learned, told] = await Promise.all([learnedMemory(adminId), toldMemory(adminId, userId)]);
  const hotels = { ...learned.hotels };
  for (const [city, ids] of Object.entries(told.hotels)) {
    hotels[city] = [...ids, ...(hotels[city] || []).filter((id) => !ids.includes(id))];
  }
  return { ...learned, hotels, aliases: told.aliases, notes: told.notes, callMe: told.callMe, told_hotels: told.hotels };
}

export const MEMORY_KINDS = new Set(["alias", "hotel", "note", "name"]);
