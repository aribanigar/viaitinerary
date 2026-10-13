import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { persistImage, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Folders an upload may land in (the storage path prefix) — nothing else.
const KINDS = new Set(["trips", "itineraries", "accommodations"]);
const TYPES = /^data:image\/(jpeg|png|webp|gif);base64,/;
const MAX_BYTES = 4 * 1024 * 1024; // decoded; the browser sends ≤ ~1 MB after utils/imageFile.js

// POST /api/uploads/image { image: dataURL, kind } → { url }
// The Trip Builder uploads a picked photo once and keeps only its URL, so its
// autosave (every few seconds) no longer re-sends — and re-stores — the image.
// Without Storage configured the data URL comes back unchanged (same fallback
// as persistImage everywhere else).
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image : "";
  const kind = KINDS.has(body.kind) ? body.kind : "trips";
  if (!TYPES.test(image)) {
    return NextResponse.json({ message: "Please upload a JPG, PNG or WebP image." }, { status: 422 });
  }
  const bytes = Math.floor(((image.length - image.indexOf(",") - 1) * 3) / 4);
  if (bytes > MAX_BYTES) {
    return NextResponse.json({ message: "That image is too large (max 4 MB)." }, { status: 413 });
  }
  const url = await persistImage(image, kind);
  return NextResponse.json({ url, stored: storageEnabled() && url !== image });
}
