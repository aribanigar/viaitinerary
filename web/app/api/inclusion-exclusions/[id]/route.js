import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const ser = (i) => ({ id: i.id, user_id: i.userId, type: i.type, content: i.content, sort_order: i.sortOrder });

async function scoped(request, id) {
  const user = await userFromRequest(request);
  if (!user) return { error: NextResponse.json({ message: "Unauthenticated." }, { status: 401 }) };
  const adminId = await adminIdOf(user);
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return { error: NextResponse.json({ message: "Invalid id" }, { status: 400 }) };
  const item = await prisma.inclusionExclusion.findFirst({ where: { id: numId, userId: adminId } });
  if (!item) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { item };
}

// PUT /api/inclusion-exclusions/:id
export async function PUT(request, { params }) {
  const r = await scoped(request, params.id);
  if (r.error) return r.error;
  const body = await request.json();
  if (!body.content) return NextResponse.json({ message: "content is required." }, { status: 422 });
  const data = { content: body.content };
  if (body.sort_order !== undefined) data.sortOrder = parseInt(body.sort_order, 10) || 0;
  const item = await prisma.inclusionExclusion.update({ where: { id: r.item.id }, data });
  return NextResponse.json(ser(item));
}

// DELETE /api/inclusion-exclusions/:id
export async function DELETE(request, { params }) {
  const r = await scoped(request, params.id);
  if (r.error) return r.error;
  await prisma.inclusionExclusion.delete({ where: { id: r.item.id } });
  return new NextResponse(null, { status: 204 });
}
