import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { hotelTagMap, setHotelTags, splitTags } from "@/lib/chingMemory";

export const dynamic = "force-dynamic";

// Hotel tags: what each hotel is like ("riverside", "quiet", "family"…), ticked
// by the agency and searched by Ching's meaning tree. Stored per agency in
// ChingMemory rows (lib/chingMemory.js) — no column on the Hotel table.

// GET /api/ching/hotel-tags → { tags: { hotelId: [tag…] } }
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  return NextResponse.json({ tags: await hotelTagMap(adminId) });
}

// PUT /api/ching/hotel-tags { hotel_id, tags: [tag…] } — replace one hotel's
// tags; { hotel_id, add: [...], remove: [...] } changes them (Ching's voice commands).
export async function PUT(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json().catch(() => ({}));
  let tags = Array.isArray(b.tags) ? b.tags : null;
  if (!tags) {
    const now = (await hotelTagMap(adminId))[String(b.hotel_id)] || [];
    const remove = new Set(splitTags((Array.isArray(b.remove) ? b.remove : []).join(",")));
    tags = [...now.filter((t) => !remove.has(t)), ...(Array.isArray(b.add) ? b.add : [])];
  }
  const saved = await setHotelTags(adminId, b.hotel_id, tags, user.id);
  if (!saved) return NextResponse.json({ message: "That hotel isn't in your catalog." }, { status: 404 });
  return NextResponse.json({ hotel_id: Number(b.hotel_id), tags: saved });
}
