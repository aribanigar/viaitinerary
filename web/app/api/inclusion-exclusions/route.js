import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const ser = (i) => ({
  id: i.id,
  user_id: i.userId,
  type: i.type,
  content: i.content,
  sort_order: i.sortOrder,
});

// GET /api/inclusion-exclusions — grouped by type (inclusion / exclusion).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const items = await prisma.inclusionExclusion.findMany({
    where: { userId: adminId },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  const grouped = {};
  for (const it of items) {
    (grouped[it.type] ||= []).push(ser(it));
  }
  return NextResponse.json(grouped);
}

// POST /api/inclusion-exclusions — add an item; sort_order appended.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const { type, content } = await request.json();

  if (!["inclusion", "exclusion"].includes(type)) {
    return NextResponse.json({ message: "type must be inclusion or exclusion." }, { status: 422 });
  }
  if (!content) return NextResponse.json({ message: "content is required." }, { status: 422 });

  const max = await prisma.inclusionExclusion.aggregate({
    where: { userId: adminId, type },
    _max: { sortOrder: true },
  });
  const item = await prisma.inclusionExclusion.create({
    data: { userId: adminId, type, content, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(ser(item), { status: 201 });
}
