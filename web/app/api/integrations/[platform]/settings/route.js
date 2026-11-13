import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { saveMetaSettings } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// PATCH /api/integrations/facebook/settings { page_id?, form_ids?, sheet_url?, subscribe? }
export async function PATCH(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (params.platform !== "facebook") return NextResponse.json({ message: "Not found" }, { status: 404 });
  try {
    const out = await saveMetaSettings(await adminIdOf(user), await request.json().catch(() => ({})));
    return NextResponse.json({ message: "Meta settings saved", ...out });
  } catch (e) {
    if (e.status === 422) return NextResponse.json({ message: e.message, error: e.message }, { status: 422 });
    console.error("meta settings save failed:", e);
    return NextResponse.json({ message: "Could not save the Meta settings. Please try again." }, { status: 500 });
  }
}
