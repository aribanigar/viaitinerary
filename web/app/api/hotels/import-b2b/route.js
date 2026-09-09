import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { catalogHotel } from "@/lib/serialize";
import { fetchB2BHotels, mapB2BHotel, applyB2BHotelsForAdmin } from "@/lib/b2bViaKashmir";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

/**
 * POST /api/hotels/import-b2b — pulls the live, public "approved & in-tariff"
 * feed from the Via Kashmir B2B rate portal and upserts each hotel into this
 * agency's catalog, keyed by (userId, external_source, external_id) so a
 * re-run refreshes rates/contact info in place instead of duplicating rows.
 * New hotels still count against the plan's hotel limit; refreshing an
 * already-imported hotel never does, since the row count doesn't change.
 * Once an agency has run this at least once, /api/cron/sync-b2b-hotels keeps
 * their imported hotels refreshed automatically on a schedule.
 */
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  let hotels;
  try {
    hotels = await fetchB2BHotels();
  } catch (err) {
    return NextResponse.json(
      { message: err.message || "Could not reach the Via Kashmir B2B feed." },
      { status: 502 },
    );
  }

  const summary = await applyB2BHotelsForAdmin(adminId, hotels);
  return NextResponse.json(summary);
}

// GET is a lightweight preview — no writes — so the UI can show a count
// before the admin commits to importing.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();

  try {
    const hotels = await fetchB2BHotels();
    return NextResponse.json({
      total_source_hotels: hotels.length,
      preview: hotels.slice(0, 5).map((h) => catalogHotel(mapB2BHotel(h))),
    });
  } catch (err) {
    return NextResponse.json(
      { message: err.message || "Could not reach the Via Kashmir B2B feed." },
      { status: 502 },
    );
  }
}
