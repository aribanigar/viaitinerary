import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { limitSettings, saveLimitSettings } from "@/lib/itineraryLimit";

export const dynamic = "force-dynamic";

// GET /api/super-admin/itinerary-limit
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(await limitSettings());
}

// PUT /api/super-admin/itinerary-limit { enabled, soft_limit, hard_limit }
export async function PUT(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const b = await request.json().catch(() => ({}));
  const soft = Number(b.soft_limit);
  const hard = Number(b.hard_limit);
  const errors = {};
  if (typeof b.enabled !== "boolean") errors.enabled = ["The enabled field is required."];
  if (!Number.isInteger(soft) || soft < 1 || soft > 1000000) errors.soft_limit = ["Enter a whole number from 1 to 1,000,000."];
  if (!Number.isInteger(hard) || hard < 1 || hard > 1000000) errors.hard_limit = ["Enter a whole number from 1 to 1,000,000."];
  else if (!errors.soft_limit && hard < soft) errors.hard_limit = ["The hard limit must be equal to or higher than the soft limit."];
  if (Object.keys(errors).length) {
    return NextResponse.json({ message: Object.values(errors)[0][0], errors }, { status: 422 });
  }

  try {
    const settings = await saveLimitSettings({ enabled: b.enabled, soft_limit: soft, hard_limit: hard });
    return NextResponse.json({ message: "Itinerary limit settings saved.", settings });
  } catch (e) {
    console.error("itinerary limit save failed:", e);
    return NextResponse.json({ message: "Could not save the settings. Please try again." }, { status: 500 });
  }
}
