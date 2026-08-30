import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { catalogHotel } from "@/lib/serialize";
import { fetchB2BHotels, mapB2BHotel, B2B_SOURCE } from "@/lib/b2bViaKashmir";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

/**
 * POST /api/hotels/import-b2b — pulls the live, public "approved & in-tariff"
 * feed from the Via Kashmir B2B rate portal and upserts each hotel into this
 * agency's catalog, keyed by (userId, external_source, external_id) so a
 * re-run refreshes rates/contact info in place instead of duplicating rows.
 * New hotels still count against the plan's hotel limit; refreshing an
 * already-imported hotel never does, since the row count doesn't change.
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

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { bypassSubscription: true },
  });
  let remainingSlots = Infinity;
  if (!admin?.bypassSubscription) {
    const sub = await prisma.subscription.findUnique({ where: { userId: adminId } });
    const plan = sub?.planKey ? await prisma.plan.findFirst({ where: { key: sub.planKey } }) : null;
    if (plan?.hotelLimit != null) {
      const currentCount = await prisma.hotel.count({ where: { userId: adminId } });
      remainingSlots = Math.max(0, plan.hotelLimit - currentCount);
    }
  }

  let imported = 0;
  let updated = 0;
  let skippedLimit = 0;

  for (const hotel of hotels) {
    if (!hotel?.id || !hotel?.name) continue;
    const mapped = mapB2BHotel(hotel);

    const existing = await prisma.hotel.findFirst({
      where: { userId: adminId, externalSource: B2B_SOURCE, externalId: hotel.id },
      select: { id: true },
    });

    if (!existing && remainingSlots <= 0) {
      skippedLimit++;
      continue;
    }

    if (existing) {
      await prisma.hotel.update({ where: { id: existing.id }, data: mapped });
      updated++;
    } else {
      await prisma.hotel.create({ data: { ...mapped, userId: adminId } });
      imported++;
      remainingSlots--;
    }
  }

  return NextResponse.json({
    imported,
    updated,
    skipped_limit: skippedLimit,
    total_source_hotels: hotels.length,
  });
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
