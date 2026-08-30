import { NextResponse } from "next/server";
import { fetchB2BHotels, applyB2BHotelsForAdmin, adminIdsWithB2BImports } from "@/lib/b2bViaKashmir";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-b2b-hotels — scheduled refresh of the Via Kashmir B2B
 * feed for every agency that has imported from it at least once (never a
 * first-time import — that stays an explicit, in-app action). Wired up as a
 * Vercel Cron job in vercel.json; also callable by any external scheduler
 * that has CRON_SECRET, since not every host runs Vercel Cron.
 *
 * Fetches the feed once and applies it to every opted-in agency, rather than
 * re-fetching per agency.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
  }

  let hotels;
  try {
    hotels = await fetchB2BHotels();
  } catch (err) {
    return NextResponse.json(
      { message: err.message || "Could not reach the Via Kashmir B2B feed." },
      { status: 502 },
    );
  }

  const adminIds = await adminIdsWithB2BImports();
  const perAdmin = [];
  for (const adminId of adminIds) {
    try {
      const summary = await applyB2BHotelsForAdmin(adminId, hotels);
      perAdmin.push({ admin_id: adminId, ...summary });
    } catch (err) {
      perAdmin.push({ admin_id: adminId, error: err.message || "sync failed" });
    }
  }

  return NextResponse.json({
    synced_admins: adminIds.length,
    total_source_hotels: hotels.length,
    results: perAdmin,
  });
}
