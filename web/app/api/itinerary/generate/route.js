import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { computeItineraryTiers } from "@/lib/itineraryEngine";
import { loadItineraryCatalogs, parseGenerateInput } from "@/lib/itineraryGenerate";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

/**
 * POST /api/itinerary/generate — deterministic, no-AI itinerary preview.
 * Pure compute, no writes, so the wizard can re-generate cheaply as the
 * salesperson tweaks budget/profit/preferences before committing to one.
 */
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const body = await request.json().catch(() => ({}));
  const parsed = parseGenerateInput(body);
  if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 422 });

  const catalogs = await loadItineraryCatalogs(adminId, parsed.data.destinationId);
  if (!catalogs.destination) {
    return NextResponse.json({ message: "Destination not found." }, { status: 404 });
  }

  const result = computeItineraryTiers(parsed.data, catalogs);
  return NextResponse.json(result);
}
