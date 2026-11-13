import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { persistImage, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/destinations/fill-photos — for every one of this admin's
// destinations missing a photo (the bulk-seeded Indian destinations were
// created with none) — or whose photo is a temporary Pixabay link that has
// since expired — search Pixabay for "<name> <state/country>" and use the top
// hit, copied into our own storage (lib/storage.js persistImage). Never
// overwrites a destination photo that is stored permanently.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    return NextResponse.json({ message: "Photo search is not configured." }, { status: 501 });
  }

  const destinations = await prisma.destination.findMany({
    where: {
      userId: adminId,
      OR: [{ imagePath: null }, { imagePath: "" }, { imagePath: { startsWith: "https://pixabay.com/get/" } }],
    },
  });

  let filled = 0;
  const failed = [];
  // A few at a time: each one is a search + download + upload.
  const queue = [...destinations];
  const worker = async () => {
    for (let dest = queue.shift(); dest; dest = queue.shift()) await fillOne(dest);
  };
  async function fillOne(dest) {
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
          data: { imagePath: await persistImage(top.largeImageURL, "destinations") },
        });
        filled++;
      } else {
        failed.push(dest.name);
      }
    } catch {
      failed.push(dest.name);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  return NextResponse.json({
    message: `Filled photos for ${filled} of ${destinations.length} destinations.`,
    filled,
    total: destinations.length,
    failed,
    ...(storageEnabled() ? {} : { warning: "Image storage (SUPABASE_SERVICE_ROLE_KEY) is not configured, so these photos are temporary Pixabay links that will stop working." }),
  });
}
