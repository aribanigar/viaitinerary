import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { rateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { ImportError, connect, disconnect, openHandle, runStep } from "@/lib/travelAgencyImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/import/travel-agency — bring an agency's data over from
// viakashmiritinerary.in when the same person has an account on both.
//   { action: "connect", email, password } → { handle, account, counts, steps }
//   { action: "step", handle, step, page }  → { step, page, next, stats, notes, errors }
//   { action: "finish", handle }            → closes the session opened there
// Only the agency owner may run it; everything lands in their own workspace.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (!["admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ message: "Only the agency owner can import an account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "connect") {
      // Each try signs in on the other site: keep password guessing off it.
      const limit = await rateLimit(`ta-import:${user.id}`);
      if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);
      return NextResponse.json(await connect(user, { email: body.email, password: body.password }));
    }

    const session = openHandle(body.handle, user.id);
    if (!session) {
      // 409, not 401: a 401 would sign the user out of this app.
      return NextResponse.json({ message: "The import session has expired. Connect again to continue." }, { status: 409 });
    }

    if (body.action === "step") {
      const adminId = await adminIdOf(user);
      return NextResponse.json(await runStep({ session, adminId, step: body.step, page: body.page }));
    }
    if (body.action === "finish") {
      await disconnect(session);
      return NextResponse.json({ message: "Import finished." });
    }
    return NextResponse.json({ message: "Unknown action." }, { status: 422 });
  } catch (e) {
    if (e instanceof ImportError) return NextResponse.json({ message: e.message }, { status: e.status === 401 ? 409 : e.status });
    console.error("travel-agency import failed:", e);
    const missingTable = /import_links|ImportLink|platform_settings/.test(String(e?.message));
    return NextResponse.json(
      {
        message: missingTable
          ? "The import needs the latest database update. Please try again after the next deploy."
          : "Something went wrong during the import. What was already imported is kept; run it again to continue.",
      },
      { status: 500 },
    );
  }
}
