import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { PLATFORMS, authorizeUrl, frontendUrl } from "@/lib/integrations";

export const dynamic = "force-dynamic";

// GET /api/auth/:platform/redirect — the Facebook / Google sign-in URL for
// connecting a lead source. JSON { url } for the app; a browser visiting it
// directly (signed in by cookie) is sent straight on.
export async function GET(request, { params }) {
  const platform = String(params.platform);
  const wantsPage = (request.headers.get("accept") || "").includes("text/html");
  if (!PLATFORMS.includes(platform)) return NextResponse.json({ message: "Unsupported platform" }, { status: 400 });
  const user = await userFromRequest(request);
  if (!user) {
    return wantsPage ? NextResponse.redirect(`${frontendUrl(request)}/login`) : NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  }
  const url = authorizeUrl(platform, user.id, request);
  if (!url) {
    const message = `${platform === "facebook" ? "Meta" : "Google"} sign-in is not set up on this server yet.`;
    return wantsPage
      ? NextResponse.redirect(`${frontendUrl(request)}/integrations?error=${encodeURIComponent(message)}`)
      : NextResponse.json({ message }, { status: 503 });
  }
  return wantsPage ? NextResponse.redirect(url) : NextResponse.json({ url });
}
