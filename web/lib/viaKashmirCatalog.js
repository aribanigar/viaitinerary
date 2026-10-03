import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * Via Kashmir catalog sync (viakashmir.in -> this builder), for two audiences:
 *
 *   "dmc"      - DMC partner agencies (isDmcBridge). Pulled from
 *                /api/dmc-bridge/* with DMC_BRIDGE_SECRET. Every price is
 *                already the DMC price; Via Kashmir never sends net rates here.
 *   "internal" - Via Kashmir's own team account (isVkInternal). Pulled from
 *                /api/vk-bridge/* with VK_INTERNAL_BRIDGE_SECRET (a different
 *                secret) - prices are B2B net cost.
 *
 * The audience is decided by the account flags, never by a caller: an
 * isDmcBridge account can only ever receive the DMC feed, and the internal
 * feed is only written into an account that is isVkInternal AND not a DMC
 * partner. Synced rows carry externalSource="viakashmir" + externalId (the
 * website listing id), so re-syncs update in place; anything that left the
 * website is marked unavailable rather than deleted (trips may reference it).
 *
 * Packages arrive without prices: each template is priced from the hotels and
 * cabs it links to in THIS account, so partners see DMC cost and the internal
 * team sees net from the same template.
 */

export const VK_SOURCE = "viakashmir";

const FEEDS = {
  dmc: { path: "dmc-bridge", header: "x-dmc-bridge-secret", env: "DMC_BRIDGE_SECRET" },
  internal: { path: "vk-bridge", header: "x-vk-internal-secret", env: "VK_INTERNAL_BRIDGE_SECRET" },
};

function feedConfig(audience) {
  const cfg = FEEDS[audience];
  if (!cfg) throw new Error(`Unknown catalog audience: ${audience}`);
  const secret = process.env[cfg.env];
  if (!secret) throw new Error(`${cfg.env} is not configured.`);
  if (audience === "internal" && secret === process.env.DMC_BRIDGE_SECRET) {
    throw new Error("VK_INTERNAL_BRIDGE_SECRET must differ from DMC_BRIDGE_SECRET.");
  }
  return { ...cfg, secret };
}

async function fetchFeed(audience, kind, params = {}) {
  const { path, header, secret } = feedConfig(audience);
  const baseUrl = (process.env.VIA_KASHMIR_API_URL || "https://viakashmir.in").replace(/\/$/, "");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${baseUrl}/api/${path}/${kind}${qs ? `?${qs}` : ""}`, {
    headers: { [header]: secret },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Via Kashmir ${path}/${kind} responded ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/** Which feed an account is allowed to receive - from its own flags only. */
export function audienceFor(user) {
  if (!user) return null;
  if (user.isDmcBridge) return "dmc"; // a partner can never be internal
  if (user.isVkInternal) return "internal";
  return null;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ----------------------------------------------------------------- helpers

/** Run thunks with bounded concurrency (keeps us inside the DB pool and function time). */
async function inBatches(thunks, size) {
  for (let i = 0; i < thunks.length; i += size) await Promise.all(thunks.slice(i, i + size).map((t) => t()));
}

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
/** True when every compared field already holds the incoming value (Decimal/Date-safe). */
function sameFields(cur, data, keys) {
  return keys.every((k) => {
    const a = cur[k], b = data[k];
    if (a == null || b == null) return a == null && b == null;
    if (typeof a === "object" && typeof a.toNumber === "function") return a.toNumber() === Number(b);
    return stable(a) === stable(b);
  });
}

const hashOf = (v) => crypto.createHash("sha256").update(stable(v)).digest("hex");

const HOTEL_COMPARE = ["name", "address", "city", "state", "category", "latitude", "longitude", "imagePath", "totalRooms", "isAvailable", "priceSections"];
const VEHICLE_COMPARE = ["name", "price", "vehicleType", "seatingCapacity", "fuelType", "city", "isAvailable", "imagePath", "rateType", "tollParkingIncluded", "notes"];

// ----------------------------------------------------------------- hotels

function hotelData(h) {
  return {
    name: h.title,
    address: h.address || null,
    city: h.city || null,
    state: h.state || "Jammu and Kashmir",
    country: "India",
    category: h.starRating ? String(h.starRating) : null,
    latitude: num(h.latitude),
    longitude: num(h.longitude),
    imagePath: h.image || null,
    totalRooms: num(h.totalRooms),
    isAvailable: true,
    priceSections: (h.rates || []).map((r) => ({
      room_type: r.room_type,
      meal_plan: r.meal_plan,
      price: r.price,
      cnb: 0,
      upto_5: 0,
      above_12: 0,
      extra_adult: 0,
      valid_from: r.valid_from || null,
      valid_to: r.valid_to || null,
    })),
    externalSource: VK_SOURCE,
    externalId: String(h.id),
    lastSyncedAt: new Date(),
  };
}

async function syncHotels(userId, hotels) {
  // Existing synced rows, plus pre-2026-10 DMC rows that were matched by name
  // only (no externalId yet) so they get adopted instead of duplicated.
  const existing = await prisma.hotel.findMany({
    where: { userId, OR: [{ externalSource: VK_SOURCE }, { externalSource: null, name: { in: hotels.map((h) => h.title) } }] },
    select: { id: true, name: true, externalId: true, externalSource: true, ...Object.fromEntries(HOTEL_COMPARE.map((k) => [k, true])) },
  });
  const byExt = new Map(existing.filter((e) => e.externalSource === VK_SOURCE).map((e) => [e.externalId, e]));
  const byName = new Map(existing.filter((e) => !e.externalSource).map((e) => [e.name, e]));
  const seen = new Set();

  const writes = [];
  for (const h of hotels) {
    const data = hotelData(h);
    const cur = byExt.get(data.externalId) ?? byName.get(h.title);
    if (cur) seen.add(cur.id);
    if (cur && cur.externalSource === VK_SOURCE && sameFields(cur, data, HOTEL_COMPARE)) continue; // unchanged
    writes.push(() => (cur ? prisma.hotel.update({ where: { id: cur.id }, data }) : prisma.hotel.create({ data: { ...data, userId } })));
  }
  await inBatches(writes, 20);
  const gone = existing.filter((e) => e.externalSource === VK_SOURCE && !seen.has(e.id) && !hotels.some((h) => String(h.id) === e.externalId)).map((e) => e.id);
  if (gone.length) await prisma.hotel.updateMany({ where: { id: { in: gone } }, data: { isAvailable: false } });
  return prisma.hotel.findMany({ where: { userId, externalSource: VK_SOURCE }, select: { id: true, externalId: true, name: true, city: true, category: true, imagePath: true, priceSections: true } });
}

// ----------------------------------------------------------------- vehicles

async function syncVehicles(userId, cabs) {
  const existing = await prisma.vehicle.findMany({
    where: { userId, OR: [{ externalSource: VK_SOURCE }, { externalSource: null, name: { in: cabs.map((c) => c.title) } }] },
    select: { id: true, name: true, externalId: true, externalSource: true, ...Object.fromEntries(VEHICLE_COMPARE.map((k) => [k, true])) },
  });
  const byExt = new Map(existing.filter((e) => e.externalSource === VK_SOURCE).map((e) => [e.externalId, e]));
  const byName = new Map(existing.filter((e) => !e.externalSource).map((e) => [e.name, e]));
  const keep = new Set();

  await inBatches(cabs.map((c) => () => {
    const data = {
      name: c.title,
      price: c.price,
      vehicleType: c.vehicleType || null,
      seatingCapacity: num(c.seats),
      fuelType: c.fuelType ? String(c.fuelType).toLowerCase() : null,
      city: c.city || null,
      state: "Jammu and Kashmir",
      country: "India",
      isAvailable: true,
      imagePath: c.image || null,
      rateType: c.rateType || "per_day",
      tollParkingIncluded: typeof c.tollsIncluded === "boolean" ? c.tollsIncluded : null,
      notes: c.luggage ? `Luggage: ${c.luggage}` : null,
      externalSource: VK_SOURCE,
      externalId: String(c.id),
    };
    const cur = byExt.get(data.externalId) ?? byName.get(c.title);
    if (cur) keep.add(cur.id);
    if (cur && cur.externalSource === VK_SOURCE && sameFields(cur, data, VEHICLE_COMPARE)) return null;
    return cur ? prisma.vehicle.update({ where: { id: cur.id }, data }) : prisma.vehicle.create({ data: { ...data, userId } });
  }), 20);
  const gone = existing.filter((e) => e.externalSource === VK_SOURCE && !keep.has(e.id)).map((e) => e.id);
  if (gone.length) await prisma.vehicle.updateMany({ where: { id: { in: gone } }, data: { isAvailable: false } });
  return prisma.vehicle.findMany({ where: { userId, externalSource: VK_SOURCE }, select: { id: true, externalId: true, vehicleType: true, name: true } });
}

// ----------------------------------------------------------------- destinations + activities

async function syncDestinations(userId, destinations) {
  const existing = await prisma.destination.findMany({ where: { userId, name: { in: destinations.map((d) => d.name) } }, select: { id: true, name: true } });
  const byName = new Map(existing.map((e) => [e.name, e.id]));
  await Promise.all(destinations.map((d) => {
    const data = { activities: d.activities || [], imagePath: d.image || null };
    const id = byName.get(d.name);
    return id ? prisma.destination.update({ where: { id }, data }) : prisma.destination.create({ data: { ...data, name: d.name, userId } });
  }));
  return prisma.destination.findMany({ where: { userId }, select: { id: true, name: true } });
}

async function syncActivities(userId, activities, destinations) {
  if (!activities.length) return;
  const destIdByName = new Map(destinations.map((d) => [d.name.toLowerCase(), d.id]));
  const existing = await prisma.activity.findMany({ where: { userId, name: { in: activities.map((a) => a.title) } }, select: { id: true, name: true } });
  const byName = new Map(existing.map((e) => [e.name, e.id]));
  await Promise.all(activities.map((a) => {
    const data = {
      sellingPrice: a.price,
      description: a.description || null,
      destinationId: a.city ? destIdByName.get(String(a.city).toLowerCase()) ?? null : null,
      isActive: true,
    };
    const id = byName.get(a.title);
    return id ? prisma.activity.update({ where: { id }, data }) : prisma.activity.create({ data: { ...data, name: a.title, userId } });
  }));
}

// ----------------------------------------------------------------- packages

/** Cheapest undated CP rate (else any undated, else any) - the template's default room/plan. */
function defaultRate(priceSections) {
  const rows = Array.isArray(priceSections) ? priceSections : [];
  const undated = rows.filter((r) => !r.valid_from && !r.valid_to);
  const pool = undated.length ? undated : rows;
  const cp = pool.filter((r) => r.meal_plan === "breakfast_only");
  return [...(cp.length ? cp : pool)].sort((a, b) => a.price - b.price)[0] || null;
}

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function syncPackages(userId, packages, hotels, vehicles, destinations) {
  const hotelByExt = new Map(hotels.map((h) => [h.externalId, h]));
  const vehicleByExt = new Map(vehicles.map((v) => [v.externalId, v]));
  const destIdByName = new Map(destinations.map((d) => [d.name.toLowerCase(), d.id]));
  // Templates are dated from a nominal start; the builder re-dates hotels and
  // cabs when a real start date is picked on the trip.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const existing = await prisma.trip.findMany({ where: { userId, isPackage: true, externalSource: VK_SOURCE }, select: { id: true, externalId: true, externalHash: true } });
  const byExt = new Map(existing.map((e) => [e.externalId, e]));

  const jobs = packages.map((p) => async () => {
    const days = [...(p.itinerary || [])].sort((a, b) => a.day - b.day);
    // Consecutive nights at the same property become one stay.
    const stays = [];
    days.forEach((d) => {
      if (!d.stayListingId) return;
      if (p.nights && d.day > p.nights) return; // departure day: no night booked
      const last = stays[stays.length - 1];
      if (last && last.listingId === d.stayListingId && last.endDay === d.day - 1) last.endDay = d.day;
      else stays.push({ listingId: d.stayListingId, startDay: d.day, endDay: d.day });
    });

    const accommodations = stays
      .map((s) => {
        const h = hotelByExt.get(String(s.listingId));
        if (!h) return null; // property not offered to this account (e.g. no net on file)
        const rate = defaultRate(h.priceSections);
        return {
          hotelId: h.id,
          name: h.name,
          city: h.city,
          category: h.category,
          rooms: "1",
          mealPlan: rate?.meal_plan || "breakfast_only",
          roomType: rate?.room_type || "Standard",
          checkIn: addDays(start, s.startDay - 1),
          checkOut: addDays(start, s.endDay),
          pricePerRoom: rate?.price ?? null,
          imagePath: h.imagePath,
          bedPrices: [],
          alternateOptions: [],
        };
      })
      .filter(Boolean);

    const transportations = days
      .filter((d) => d.cabListingId && vehicleByExt.get(String(d.cabListingId)))
      .map((d) => {
        const v = vehicleByExt.get(String(d.cabListingId));
        return { vehicleId: v.id, vehicleType: v.vehicleType || d.vehicleType, date: addDays(start, d.day - 1), destination: d.overnightAt || null, quantity: 1, tripType: "day_hire" };
      });

    const itineraries = days.map((d) => ({
      dayNumber: d.day,
      title: d.title || `Day ${d.day}`,
      location: d.overnightAt || null,
      description: [d.description, d.activities?.length ? `Activities: ${d.activities.join(", ")}` : null, d.meals?.length ? `Meals: ${d.meals.join(", ")}` : null].filter(Boolean).join("\n\n") || null,
    }));

    const firstDest = (p.destinations || []).map((n) => destIdByName.get(String(n).toLowerCase())).find(Boolean) ?? null;
    const base = {
      tripTitle: p.title,
      destination: (p.destinations || []).join(", ") || p.startingCity || null,
      destinationId: firstDest,
      duration: p.nights && p.days ? `${p.nights} Nights / ${p.days} Days` : p.days ? `${p.days} Days` : null,
      adults: Math.max(2, Number(p.minTravellers) || 2),
      startDate: start,
      imagePath: p.image || null,
      inclusions: p.inclusions || [],
      exclusions: p.exclusions || [],
      tagline: (p.highlights || []).slice(0, 3).join(" · ") || null,
      isPackage: true,
      status: "pending",
      externalSource: VK_SOURCE,
      externalId: String(p.id),
    };

    // Fingerprint of what this template is built from (package + the linked
    // rates in this account), kept in trips.external_hash; unchanged -> skip.
    const fingerprint = hashOf({ base: { ...base, startDate: undefined }, itineraries, accommodations: accommodations.map((a) => ({ ...a, checkIn: undefined, checkOut: undefined })), transportations: transportations.map((t) => ({ ...t, date: undefined })) });
    const cur = byExt.get(String(p.id));
    byExt.delete(String(p.id));
    if (cur && cur.externalHash === fingerprint) return;
    const id = cur?.id;
    if (id) {
      // Refresh: rebuild children so the template always mirrors the website.
      await prisma.$transaction([
        prisma.itinerary.deleteMany({ where: { tripId: id } }),
        prisma.accommodation.deleteMany({ where: { tripId: id } }),
        prisma.transportation.deleteMany({ where: { tripId: id } }),
        prisma.trip.update({
          where: { id },
          data: { ...base, externalHash: fingerprint, itineraries: { create: itineraries }, accommodations: { create: accommodations }, transportations: { create: transportations } },
        }),
      ]);
    } else {
      await prisma.trip.create({
        data: {
          ...base,
          externalHash: fingerprint,
          userId,
          tripId: `VKP${userId}-${String(p.id).slice(-10)}`,
          slug: `${String(p.slug || p.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${userId}`,
          itineraries: { create: itineraries },
          accommodations: { create: accommodations },
          transportations: { create: transportations },
        },
      });
    }
  });
  await inBatches(jobs, 6);
  // Packages no longer published on the website: archive the template.
  const gone = [...byExt.values()].map((e) => e.id);
  if (gone.length) await prisma.trip.updateMany({ where: { id: { in: gone } }, data: { status: "archived" } });
}

// ----------------------------------------------------------------- entry points

/**
 * Sync the full Via Kashmir catalog into one account, choosing the feed from
 * the account's own flags. Returns a summary; throws on fetch failure so a
 * cron/endpoint can report it (the SSO path catches and logs).
 */
export async function syncViaKashmirCatalog(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isDmcBridge: true, isVkInternal: true } });
  const audience = audienceFor(user);
  if (!audience) throw new Error("This account is not connected to Via Kashmir.");

  const [destinations, hotels, houseboats, cabs, activities, packages] = await Promise.all([
    fetchFeed(audience, "destinations"),
    fetchFeed(audience, "hotels", { type: "hotel" }),
    fetchFeed(audience, "hotels", { type: "houseboat" }),
    fetchFeed(audience, "cabs"),
    fetchFeed(audience, "activities"),
    fetchFeed(audience, "packages"),
  ]);

  const destRows = await syncDestinations(userId, destinations);
  const [hotelRows, vehicleRows] = await Promise.all([
    syncHotels(userId, [...hotels, ...houseboats]),
    syncVehicles(userId, cabs),
    syncActivities(userId, activities, destRows),
  ]);
  await syncPackages(userId, packages, hotelRows, vehicleRows, destRows);

  await prisma.user.update({ where: { id: userId }, data: { dmcBridgeSyncedAt: new Date() } });
  return { audience, destinations: destinations.length, hotels: hotels.length + houseboats.length, vehicles: cabs.length, activities: activities.length, packages: packages.length };
}

/** Every account that receives a Via Kashmir catalog (partners + the internal account). */
export async function connectedAccountIds() {
  const rows = await prisma.user.findMany({ where: { OR: [{ isDmcBridge: true }, { isVkInternal: true }], status: "active" }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** True when the agency that owns this data is a DMC partner (checks the owner, so team logins are covered too). */
export async function isPartnerAgency(adminId) {
  const owner = await prisma.user.findUnique({ where: { id: adminId }, select: { isDmcBridge: true } });
  return !!owner?.isDmcBridge;
}

/**
 * Make one account Via Kashmir's internal (B2B net) account, clearing the flag
 * everywhere else - there is only ever one. Refuses DMC partner accounts and
 * team logins. Used by the website admin (via /api/vk-bridge/internal-account)
 * and by the super-admin toggle here, so both ends apply the same rule.
 */
export async function setInternalAccount({ userId, email }) {
  const user = await prisma.user.findFirst({
    where: userId ? { id: Number(userId) } : { email: String(email || "").trim().toLowerCase() },
    select: { id: true, email: true, role: true, isDmcBridge: true, status: true },
  });
  if (!user) return { error: "No builder account with that email. Create the account in the itinerary builder first.", status: 404 };
  if (user.isDmcBridge) return { error: "A DMC partner account can never receive B2B net prices.", status: 422 };
  if (user.role === "team") return { error: "Pick the agency owner account, not a team login.", status: 422 };
  await prisma.$transaction([
    prisma.user.updateMany({ where: { isVkInternal: true, id: { not: user.id } }, data: { isVkInternal: false } }),
    prisma.user.update({ where: { id: user.id }, data: { isVkInternal: true } }),
  ]);
  return { user };
}

/** Clear the internal flag from an account (super-admin toggle off). Synced rows stay but stop refreshing. */
export async function clearInternalAccount(userId) {
  await prisma.user.update({ where: { id: Number(userId) }, data: { isVkInternal: false } });
}

export async function currentInternalAccount() {
  return prisma.user.findFirst({ where: { isVkInternal: true }, select: { id: true, email: true, name: true, dmcBridgeSyncedAt: true } });
}
