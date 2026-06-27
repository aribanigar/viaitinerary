import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { resolveBlogTeamId, generateCategorySlug, serializeCategory } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/super-admin/blog/categories — list with post counts.
export async function GET(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const categories = await prisma.blogCategory.findMany({
    where: { teamId },
    include: { _count: { select: { posts: true } } },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(categories.map(serializeCategory));
}

// POST /api/super-admin/blog/categories — create.
export async function POST(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const b = await request.json();
  if (!b.name) return NextResponse.json({ errors: { name: ["The name field is required."] } }, { status: 422 });

  const slug = b.slug || (await generateCategorySlug(b.name, teamId));
  const category = await prisma.blogCategory.create({
    data: {
      teamId,
      name: b.name,
      slug,
      description: b.description ?? null,
      displayOrder: b.display_order ?? 0,
      isActive: b.is_active ?? true,
    },
  });
  return NextResponse.json(serializeCategory(category), { status: 201 });
}
