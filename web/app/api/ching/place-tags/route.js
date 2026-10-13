import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { placeTagMap, setPlaceTags, splitPlaceTags } from "@/lib/chingMemory";

export const dynamic = "force-dynamic";

// Place tags: what each DESTINATION is like ("snow", "shopping", "quiet"…),
// ticked by the agency and used when a client asks where to go
// (frontend utils/ching/whereTo.js). ChingMemory rows, like hotel tags.

// GET /api/ching/place-tags → { tags: { destinationId: [tag…] } }
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json({ tags: await placeTagMap(await adminIdOf(user)) });
}

// PUT /api/ching/place-tags { destination_id, tags } replaces; { destination_id, add, remove } changes.
export async function PUT(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json().catch(() => ({}));
  let tags = Array.isArray(b.tags) ? b.tags : null;
  if (!tags) {
    // Changing by voice starts from what Ching already reads off the place (sent as `base`), so adding one tag doesn't drop the rest.
    const now = (await placeTagMap(adminId))[String(b.destination_id)] || splitPlaceTags((Array.isArray(b.base) ? b.base : []).join(","));
    const remove = new Set(splitPlaceTags((Array.isArray(b.remove) ? b.remove : []).join(",")));
    tags = [...now.filter((t) => !remove.has(t)), ...(Array.isArray(b.add) ? b.add : [])];
  }
  const saved = await setPlaceTags(adminId, b.destination_id, tags, user.id);
  if (!saved) return NextResponse.json({ message: "That destination isn't in your catalog." }, { status: 404 });
  return NextResponse.json({ destination_id: Number(b.destination_id), tags: saved });
}
