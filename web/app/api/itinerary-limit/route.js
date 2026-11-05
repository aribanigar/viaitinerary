import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { limitStatusForAdmin } from "@/lib/itineraryLimit";

export const dynamic = "force-dynamic";

// GET /api/itinerary-limit — the caller's agency usage against the limit.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json(await limitStatusForAdmin(await adminIdOf(user)));
}
