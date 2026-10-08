import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { userFromRequest } from "@/lib/auth";
import { loadProposalTrip } from "@/lib/publicProposalTrip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

// Loopback, private, link-local (cloud metadata), CGNAT and unique-local ranges.
function isPrivateAddress(address) {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::") return true;
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(a);
  }
  const [p0, p1] = address.split(".").map(Number);
  return (
    p0 === 0 || p0 === 10 || p0 === 127 ||
    (p0 === 100 && p1 >= 64 && p1 <= 127) ||
    (p0 === 169 && p1 === 254) ||
    (p0 === 172 && p1 >= 16 && p1 <= 31) ||
    (p0 === 192 && p1 === 168)
  );
}

/**
 * GET /api/image-proxy?url=<https image>[&p=<proposal token>]
 *
 * PDF export rasterizes the itinerary preview in the browser, and the canvas
 * can only capture cross-origin photos whose host sends CORS headers — hotel
 * photos from anywhere else came out blank in the PDF. The exporter fetches
 * such photos through here (same origin) instead. Only for a signed-in user
 * or a valid client proposal link, never to internal addresses, images only.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const proposalToken = searchParams.get("p");
  const allowed = proposalToken
    ? !!(await loadProposalTrip(proposalToken))
    : !!(await userFromRequest(request));
  if (!allowed) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  let target;
  try {
    target = new URL(searchParams.get("url") || "");
  } catch {
    return NextResponse.json({ message: "Invalid url." }, { status: 422 });
  }
  if (!["https:", "http:"].includes(target.protocol)) {
    return NextResponse.json({ message: "Invalid url." }, { status: 422 });
  }

  try {
    const host = target.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return NextResponse.json({ message: "Invalid url." }, { status: 422 });
    }

    const upstream = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return NextResponse.json({ message: "Not an image." }, { status: 502 });
    }
    if (Number(upstream.headers.get("content-length") || 0) > MAX_BYTES) {
      return NextResponse.json({ message: "Image too large." }, { status: 413 });
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return NextResponse.json({ message: "Image too large." }, { status: 413 });
    }
    return new NextResponse(body, {
      headers: { "content-type": type, "cache-control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ message: "Could not fetch image." }, { status: 502 });
  }
}
