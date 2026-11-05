import { NextResponse } from "next/server";
import { verifyMetaSignature, handleLeadgen } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/webhooks/meta — Meta's subscription check (hub.challenge echo).
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("hub.mode") ?? sp.get("hub_mode");
  const token = sp.get("hub.verify_token") ?? sp.get("hub_verify_token");
  const challenge = sp.get("hub.challenge") ?? sp.get("hub_challenge") ?? "";
  const expected = process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST /api/webhooks/meta — lead notifications, signed with the app secret.
export async function POST(request) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("OK", { status: 200 });
  }
  if (body?.object === "page") {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change?.field !== "leadgen") continue;
        try {
          await handleLeadgen(change.value);
        } catch (e) {
          console.error("meta lead fetch failed:", e?.message || e);
        }
      }
    }
  }
  return new NextResponse("OK", { status: 200 });
}
