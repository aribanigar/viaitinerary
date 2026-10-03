import crypto from "crypto";
import { NextResponse } from "next/server";
import { setInternalAccount, currentInternalAccount, syncViaKashmirCatalog } from "@/lib/viaKashmirCatalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Called server-to-server by viakashmir.in's admin to choose which builder
 * account is Via Kashmir's internal (B2B net) account. Authenticated with
 * VK_INTERNAL_BRIDGE_SECRET in x-vk-internal-secret - never the DMC secret.
 *   GET  -> { account: {id,email,name,dmcBridgeSyncedAt} | null }
 *   POST { email } -> sets it (one account only), then syncs the catalog.
 */
function denied(request) {
  const expected = process.env.VK_INTERNAL_BRIDGE_SECRET;
  const provided = request.headers.get("x-vk-internal-secret") || "";
  if (!expected) return NextResponse.json({ message: "Internal bridge not configured." }, { status: 503 });
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  return null;
}

export async function GET(request) {
  const d = denied(request);
  if (d) return d;
  return NextResponse.json({ account: await currentInternalAccount() });
}

export async function POST(request) {
  const d = denied(request);
  if (d) return d;
  const { email } = await request.json().catch(() => ({}));
  if (!email) return NextResponse.json({ message: "email is required." }, { status: 400 });
  const res = await setInternalAccount({ email });
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status });
  let sync = null;
  try {
    sync = await syncViaKashmirCatalog(res.user.id);
  } catch (e) {
    sync = { error: e.message };
  }
  return NextResponse.json({ account: await currentInternalAccount(), sync });
}
