import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * The viakashmir.in <-> viaitinerary DMC bridge.
 *
 * verifyToken() mirrors ViaKashmir's src/lib/dmcBridge.ts buildDmcSsoToken()
 * exactly - same Node crypto, same base64url(JSON payload) + "." +
 * base64url(HMAC-SHA256 of the encoded payload, shared secret) scheme. Both
 * sides run Node, so this is a near-literal port, not a re-implementation.
 *
 * syncInventory() seeds/refreshes a DMC partner's PRIVATE destinations/
 * hotels/vehicles/activities rows from Via Kashmir's real, live inventory -
 * the partner never creates these rows themselves (see the isDmcBridge guard
 * in lib/catalog.js), they only pick from what gets synced here. Every price
 * synced is already the DMC price.
 */

const TOKEN_TTL_MS = 120_000; // 2 minutes - matches ViaKashmir's SSO_TOKEN_TTL_SECONDS

function secret() {
  const s = process.env.DMC_BRIDGE_SECRET;
  if (!s) throw new Error("DMC_BRIDGE_SECRET is not configured.");
  return s;
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url");
}

/**
 * Verifies a token built by ViaKashmir's buildDmcSsoToken(). Returns the
 * decoded payload (dmcUserId, email, companyName, ts, nonce) or null if the
 * signature is invalid, malformed, or the token has expired.
 */
export function verifyDmcSsoToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payloadEncoded, signature] = token.split(".", 2);

  const expected = crypto.createHmac("sha256", secret()).update(payloadEncoded).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload?.dmcUserId || !payload?.email || !payload?.ts) return null;
  if (Date.now() - payload.ts > TOKEN_TTL_MS) return null; // expired

  return payload;
}

async function fetchCatalog(path, params = {}) {
  const baseUrl = (process.env.VIA_KASHMIR_API_URL || "https://viakashmir.in").replace(/\/$/, "");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${baseUrl}/api/dmc-bridge/${path}${qs ? `?${qs}` : ""}`, {
    headers: { "x-dmc-bridge-secret": secret() },
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`DMC bridge catalog fetch failed: ${path} (${res.status})`);
    return [];
  }
  const json = await res.json();
  return json?.data ?? [];
}

/**
 * Seeds/refreshes this agency's private destinations/hotels/vehicles/
 * activities rows from Via Kashmir's real inventory. Safe to call repeatedly
 * - upserts by (userId, name), so re-running it (e.g. on every SSO login)
 * refreshes DMC prices without creating duplicates.
 */
export async function syncDmcInventory(userId) {
  // Destinations - name + activities only, no pricing.
  for (const d of await fetchCatalog("destinations")) {
    const existing = await prisma.destination.findFirst({ where: { userId, name: d.name } });
    const data = { activities: d.activities || [], imagePath: d.image || null };
    if (existing) await prisma.destination.update({ where: { id: existing.id }, data });
    else await prisma.destination.create({ data: { ...data, userId, name: d.name } });
  }

  // Hotels/houseboats - DMC price only, never the public price.
  for (const type of ["hotel", "houseboat"]) {
    for (const h of await fetchCatalog("hotels", { type })) {
      if (typeof h.dmcPrice !== "number") continue;
      const priceSections = [{
        room_type: "Standard",
        meal_plan: "CP",
        price: h.dmcPrice,
        cnb: 0,
        upto_5: 0,
        above_12: 0,
        extra_adult: 0,
        valid_from: null,
        valid_to: null,
      }];
      const existing = await prisma.hotel.findFirst({ where: { userId, name: h.title } });
      const data = { city: h.city || null, priceSections };
      if (existing) await prisma.hotel.update({ where: { id: existing.id }, data });
      else await prisma.hotel.create({ data: { ...data, userId, name: h.title } });
    }
  }

  // Cabs/shikaras.
  for (const c of await fetchCatalog("cabs")) {
    if (typeof c.dmcPrice !== "number") continue;
    const existing = await prisma.vehicle.findFirst({ where: { userId, name: c.title } });
    const data = { price: c.dmcPrice };
    if (existing) await prisma.vehicle.update({ where: { id: existing.id }, data });
    else await prisma.vehicle.create({ data: { ...data, userId, name: c.title } });
  }

  // Activities - priced, ticketed add-ons (Activity.sellingPrice = the DMC
  // price, same convention as hotels'/cabs' dmcPrice above). Field names
  // (title/dmcPrice/destinationName/description/durationHours) follow the
  // same shape as destinations/hotels/cabs above by convention - not
  // verified against ViaKashmir's actual /api/dmc-bridge/activities
  // response, since that repo wasn't reachable from this session. If
  // activities silently sync as empty, check these names first.
  for (const a of await fetchCatalog("activities")) {
    if (typeof a.dmcPrice !== "number") continue;
    const name = a.title || a.name;
    if (!name) continue;

    let destinationId = null;
    if (a.destinationName) {
      const dest = await prisma.destination.findFirst({ where: { userId, name: a.destinationName } });
      destinationId = dest?.id ?? null;
    }

    const existing = await prisma.activity.findFirst({ where: { userId, name } });
    const data = {
      sellingPrice: a.dmcPrice,
      description: a.description || null,
      durationHours: typeof a.durationHours === "number" ? a.durationHours : null,
      destinationId,
    };
    if (existing) await prisma.activity.update({ where: { id: existing.id }, data });
    else await prisma.activity.create({ data: { ...data, userId, name } });
  }

  await prisma.user.update({ where: { id: userId }, data: { dmcBridgeSyncedAt: new Date() } });
}

/**
 * Pushes a trip's title/client/status to ViaKashmir so it shows up on this
 * partner's profile in /admin/dmc-partners - a synced summary, never a copy
 * of trip content. No-op for a non-bridge agency. Never throws - a failed
 * push must not block trip creation/update.
 */
export async function pushDmcItinerary(trip) {
  try {
    const owner = await prisma.user.findUnique({ where: { id: trip.userId }, select: { viaKashmirDmcUserId: true } });
    if (!owner?.viaKashmirDmcUserId) return;

    const baseUrl = (process.env.VIA_KASHMIR_API_URL || "https://viakashmir.in").replace(/\/$/, "");
    await fetch(`${baseUrl}/api/dmc-bridge/itineraries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dmc-bridge-secret": secret() },
      body: JSON.stringify({
        dmcUserId: owner.viaKashmirDmcUserId,
        itineraryId: String(trip.id),
        title: trip.tripTitle,
        clientName: trip.clientName,
        status: trip.status,
      }),
    });
  } catch (e) {
    console.warn("DMC bridge itinerary push failed", trip.id, e?.message);
  }
}
