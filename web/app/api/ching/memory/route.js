import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { chingMemory, placeKey, MEMORY_KINDS } from "@/lib/chingMemory";

export const dynamic = "force-dynamic";

const clip = (v, n) => String(v ?? "").trim().slice(0, n);

// GET /api/ching/memory — learned habits + what the agency told Ching (lib/chingMemory.js).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  return NextResponse.json(await chingMemory(adminId));
}

// POST /api/ching/memory { kind: alias|hotel|note|name, key, value } — remember (upsert).
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json().catch(() => ({}));
  const kind = String(b.kind || "");
  if (!MEMORY_KINDS.has(kind)) return NextResponse.json({ message: "Unknown memory kind." }, { status: 422 });

  let key = clip(b.key, 120).toLowerCase();
  let value = clip(b.value, 1000);
  if (kind === "hotel") {
    // A preferred hotel for a city: must be one of this agency's own hotels.
    const hotel = await prisma.hotel.findFirst({ where: { id: Number(value) || -1, userId: adminId }, select: { id: true, city: true, name: true } });
    if (!hotel) return NextResponse.json({ message: "That hotel isn't in your catalog." }, { status: 422 });
    key = placeKey(key || hotel.city);
    value = String(hotel.id);
  }
  if (kind === "note") key = key || `note-${Date.now()}`;
  if (kind === "name") key = "me";
  if (!key || !value) return NextResponse.json({ message: "Nothing to remember." }, { status: 422 });

  const count = await prisma.chingMemory.count({ where: { userId: adminId } });
  if (count >= 500) return NextResponse.json({ message: "Ching's memory is full — ask it to forget something first." }, { status: 422 });

  const row = await prisma.chingMemory.upsert({
    where: { userId_kind_key: { userId: adminId, kind, key } },
    create: { userId: adminId, kind, key, value, createdBy: user.id },
    update: { value, createdBy: user.id },
  });
  return NextResponse.json({ id: row.id, kind: row.kind, key: row.key, value: row.value });
}

// DELETE /api/ching/memory { kind?, key?, match? } — forget one thing, things
// matching a phrase, or (no body fields) everything the agency told Ching.
export async function DELETE(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json().catch(() => ({}));
  const where = { userId: adminId };
  if (b.kind && MEMORY_KINDS.has(String(b.kind))) where.kind = String(b.kind);
  if (b.key) where.key = clip(b.key, 120).toLowerCase();
  if (b.match) {
    const m = clip(b.match, 120);
    where.OR = [{ key: { contains: m, mode: "insensitive" } }, { value: { contains: m, mode: "insensitive" } }];
  }
  const { count } = await prisma.chingMemory.deleteMany({ where });
  return NextResponse.json({ forgotten: count });
}
