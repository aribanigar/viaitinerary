import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { parseShowcase, serializeShowcase } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

async function find(params) {
  const id = parseInt(params.id, 10);
  return Number.isFinite(id) ? prisma.showcaseItem.findUnique({ where: { id } }) : null;
}

// GET /api/showcase-items/:id
export async function GET(request, { params }) {
  const row = await find(params);
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(serializeShowcase(row));
}

// PUT /api/showcase-items/:id — super admin.
export async function PUT(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const row = await find(params);
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const { data, errors } = await parseShowcase(await request.json().catch(() => ({})), { partial: true });
  if (errors) return NextResponse.json({ message: Object.values(errors)[0][0], errors }, { status: 422 });
  const updated = await prisma.showcaseItem.update({ where: { id: row.id }, data });
  return NextResponse.json(serializeShowcase(updated));
}

// DELETE /api/showcase-items/:id — super admin.
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const row = await find(params);
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.showcaseItem.delete({ where: { id: row.id } });
  return new NextResponse(null, { status: 204 });
}
