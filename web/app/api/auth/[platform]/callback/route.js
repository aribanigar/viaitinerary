import { NextResponse } from "next/server";
import { PLATFORMS, completeSignIn, frontendUrl } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/auth/:platform/callback?code&state — where Facebook / Google send
// the user back. The signed state names the user; the result goes to /integrations.
export async function GET(request, { params }) {
  const platform = String(params.platform);
  const back = `${frontendUrl(request)}/integrations`;
  const sp = new URL(request.url).searchParams;
  try {
    if (!PLATFORMS.includes(platform)) throw new Error("Unsupported platform");
    if (!sp.get("code") || sp.get("error")) throw new Error(sp.get("error_description") || sp.get("error") || "Missing authorization code.");
    await completeSignIn(platform, { code: sp.get("code"), state: sp.get("state") }, request);
    return NextResponse.redirect(`${back}?success=1&platform=${platform === "facebook" ? "meta" : platform}`);
  } catch (e) {
    console.error(`${platform} oauth callback failed:`, e?.message || e);
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(e?.message || "Sign-in failed.")}`);
  }
}
