import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { generateCategorySlug, serializeCategory } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/super-admin/blog/categories/:id — category with its posts.
export async function GET(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const category = await prisma.blogCategory.findUnique({
    where: { id: parseInt(params.id, 10) },
    include: { posts: true },
  });
  if (!category) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCategory(category));
}

// PUT /api/super-admin/blog/categories/:id
export async function PUT(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const category = await prisma.blogCategory.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!category) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  const data = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.description !== undefined) data.description = b.description;
  if (b.display_order !== undefined) data.displayOrder = b.display_order;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  if (b.name !== undefined && b.name !== category.name) {
    data.slug = await generateCategorySlug(b.name, category.teamId, category.id);
  }

  const updated = await prisma.blogCategory.update({ where: { id: category.id }, data });
  return NextResponse.json(serializeCategory(updated));
}

// DELETE /api/super-admin/blog/categories/:id
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const category = await prisma.blogCategory.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!category) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.blogCategory.delete({ where: { id: category.id } });
  return NextResponse.json({ message: "Category deleted successfully" });
}
