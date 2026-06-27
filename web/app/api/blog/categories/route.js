import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBlogTeamIds, serializeCategory } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/blog/categories — categories with published-post counts (no auth).
export async function GET() {
  const teamIds = await getBlogTeamIds();
  const categories = await prisma.blogCategory.findMany({
    where: { teamId: { in: teamIds } },
    include: { _count: { select: { posts: { where: { status: "published" } } } } },
    orderBy: { displayOrder: "asc" },
  });
  return NextResponse.json(categories.map(serializeCategory));
}
