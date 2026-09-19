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
 * hotels/vehicles rows from Via Kashmir's real, live inventory - the partner
 * never creates these rows themselves (see the isDmcBridge guard in
 * lib/catalog.js), they only pick from and customise activities within what
 * gets synced here. Every price synced is already the DMC price.
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
 * Upserts a batch of {name, ...data} rows for one Prisma model, scoped to
 * userId. One findMany (not one query per row) to see what already exists,
 * then all creates/updates fired concurrently - the naive version of this
 * (a findFirst + create/update per item, awaited serially) took 100+ real
 * round trips for a full hotel catalog and blew Vercel's function timeout on
 * first live test (confirmed 2026-09-19). This is the fix.
 */
async function upsertBatch(model, userId, rows) {
  if (rows.length === 0) return;
  const names = rows.map((r) => r.name);
  const existing = await prisma[model].findMany({
    where: { userId, name: { in: names } },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existing.map((e) => [e.name, e.id]));

  await Promise.all(
    rows.map((row) => {
      const id = existingByName.get(row.name);
      return id
        ? prisma[model].update({ where: { id }, data: row.data })
        : prisma[model].create({ data: { ...row.data, userId, name: row.name } });
    })
  );
}

/**
 * Seeds/refreshes this agency's private destinations/hotels/vehicles rows
 * from Via Kashmir's real inventory. Safe to call repeatedly - upserts by
 * (userId, name), so re-running it (e.g. on every SSO login) refreshes DMC
 * prices without creating duplicates.
 */
export async function syncDmcInventory(userId) {
  // All four catalog fetches run in parallel - independent HTTP calls to
  // ViaKashmir, no reason to wait on one before starting the next.
  const [destinations, hotels, houseboats, cabs] = await Promise.all([
    fetchCatalog("destinations"),
    fetchCatalog("hotels", { type: "hotel" }),
    fetchCatalog("hotels", { type: "houseboat" }),
    fetchCatalog("cabs"),
  ]);

  const destinationRows = destinations.map((d) => ({
    name: d.name,
    data: { activities: d.activities || [], imagePath: d.image || null },
  }));

  const hotelRows = [...hotels, ...houseboats]
    .filter((h) => typeof h.dmcPrice === "number")
    .map((h) => ({
      name: h.title,
      data: {
        city: h.city || null,
        priceSections: [{
          room_type: "Standard",
          meal_plan: "CP",
          price: h.dmcPrice,
          cnb: 0,
          upto_5: 0,
          above_12: 0,
          extra_adult: 0,
          valid_from: null,
          valid_to: null,
        }],
      },
    }));

  const vehicleRows = cabs
    .filter((c) => typeof c.dmcPrice === "number")
    .map((c) => ({ name: c.title, data: { price: c.dmcPrice } }));

  await Promise.all([
    upsertBatch("destination", userId, destinationRows),
    upsertBatch("hotel", userId, hotelRows),
    upsertBatch("vehicle", userId, vehicleRows),
  ]);

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
