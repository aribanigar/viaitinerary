import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBlogTeamIds, serializePost, POST_INCLUDE } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/blog/posts — published posts for the public blog (no auth).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const teamIds = await getBlogTeamIds();
  const where = {
    teamId: { in: teamIds },
    status: "published",
    publishedAt: { lte: new Date() },
  };
  if (category) where.category = { is: { slug: category } };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: POST_INCLUDE,
    }),
  ]);

  return NextResponse.json({
    data: posts.map(serializePost),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}
