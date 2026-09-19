import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/destinations/fill-photos — for every one of this admin's
// destinations missing a photo (the bulk-seeded Indian destinations were
// created with none), search Pixabay for "<name> <state/country>" and use
// the top hit. Never overwrites a destination that already has a photo.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    return NextResponse.json({ message: "Photo search is not configured." }, { status: 501 });
  }

  const destinations = await prisma.destination.findMany({
    where: { userId: adminId, imagePath: null },
  });

  let filled = 0;
  const failed = [];
  for (const dest of destinations) {
    const query = [dest.name, dest.state || dest.country].filter(Boolean).join(" ");
    const url =
      `https://pixabay.com/api/?key=${encodeURIComponent(key)}` +
      `&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true` +
      `&orientation=horizontal&per_page=3`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Pixabay ${resp.status}`);
      const json = await resp.json();
      const top = (json.hits || [])[0];
      if (top?.largeImageURL) {
        await prisma.destination.update({
          where: { id: dest.id },
          data: { imagePath: top.largeImageURL },
        });
        filled++;
      } else {
        failed.push(dest.name);
      }
    } catch {
      failed.push(dest.name);
    }
  }

  return NextResponse.json({
    message: `Filled photos for ${filled} of ${destinations.length} destinations.`,
    filled,
    total: destinations.length,
    failed,
  });
}
