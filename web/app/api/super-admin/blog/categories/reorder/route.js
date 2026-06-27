import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/super-admin/blog/categories/reorder { categories: [{id, display_order}] }
export async function POST(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const b = await request.json();
  if (!Array.isArray(b.categories) || !b.categories.length) {
    return NextResponse.json({ errors: { categories: ["The categories field is required."] } }, { status: 422 });
  }

  await prisma.$transaction(
    b.categories.map((c) =>
      prisma.blogCategory.update({
        where: { id: parseInt(c.id, 10) },
        data: { displayOrder: parseInt(c.display_order, 10) || 0 },
      })
    )
  );

  return NextResponse.json({ message: "Categories reordered successfully" });
}
