import crypto from "crypto";
import prisma from "@/lib/prisma";
import { syncViaKashmirCatalog } from "@/lib/viaKashmirCatalog";

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
 * the partner never creates new rows themselves (see the isDmcBridge guard
 * in lib/catalog.js blocking POST), but they can still edit/customise what
 * gets synced in (PUT is unguarded) - e.g. picking which of a destination's
 * activities to keep. Every price synced is already the DMC price.
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

/**
 * Marks a verified token's nonce as used, making the token single-use on
 * top of its 2-minute TTL - without this, a leaked/logged SSO URL (browser
 * history, a proxy log, a shared screenshot) could be replayed for a fresh
 * session token for as long as the TTL window lasts. Returns false if this
 * nonce was already consumed (a replay) or the token has no nonce at all.
 *
 * Best-effort on a missing nonce rather than a hard failure: this app can't
 * verify ViaKashmir always includes one, and refusing every token over a
 * missing field would turn a partial gap into a total outage. If it's ever
 * confirmed ViaKashmir always sends one, tighten this to reject a missing
 * nonce outright.
 */
export async function consumeDmcSsoNonce(payload) {
  if (!payload?.nonce) {
    console.warn("DMC SSO token has no nonce - replay protection skipped for this login.");
    return true;
  }

  // Opportunistic cleanup of stale rows, fire-and-forget - keeps this table
  // from growing forever without needing a cron job. Never blocks or fails
  // the actual consume check below.
  prisma.dmcSsoNonce
    .deleteMany({ where: { consumedAt: { lt: new Date(Date.now() - 3_600_000) } } })
    .catch(() => {});

  try {
    await prisma.dmcSsoNonce.create({ data: { nonce: String(payload.nonce) } });
    return true;
  } catch (e) {
    if (e?.code === "P2002") return false; // unique violation - already consumed
    throw e;
  }
}

/**
 * Seeds/refreshes this agency's private destinations/hotels/vehicles/
 * activities rows from Via Kashmir's real inventory. Safe to call repeatedly
 * - upserts by (userId, name), so re-running it (e.g. on every SSO login)
 * refreshes DMC prices without creating duplicates.
 */
export async function syncDmcInventory(userId) {
  // Full catalog (every room x meal plan at the DMC price, seasonal dated
  // rates, cover photos, cabs, destinations, package templates) - see
  // lib/viaKashmirCatalog.js. The audience comes from the account's own
  // isDmcBridge flag, so a partner can only ever receive DMC prices.
  return syncViaKashmirCatalog(userId);
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
