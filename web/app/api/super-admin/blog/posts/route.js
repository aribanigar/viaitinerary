import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  resolveBlogTeamId,
  generatePostSlug,
  calculateReadingTime,
  findOrCreateTags,
  serializePost,
  POST_INCLUDE,
} from "@/lib/blog";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "published", "scheduled"];

// GET /api/super-admin/blog/posts — list this team's posts.
export async function GET(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const { searchParams } = new URL(request.url);
  const filterStatus = searchParams.get("status");
  const categoryId = searchParams.get("category_id");
  const search = searchParams.get("search");
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { teamId };
  if (filterStatus) where.status = filterStatus;
  if (categoryId) where.blogCategoryId = parseInt(categoryId, 10);
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
      orderBy: { createdAt: "desc" },
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

// POST /api/super-admin/blog/posts — create a post.
export async function POST(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const b = await request.json();
  if (!b.title) return NextResponse.json({ errors: { title: ["The title field is required."] } }, { status: 422 });
  if (!b.content) return NextResponse.json({ errors: { content: ["The content field is required."] } }, { status: 422 });
  if (b.status && !STATUSES.includes(b.status)) {
    return NextResponse.json({ errors: { status: ["Invalid status."] } }, { status: 422 });
  }

  const postStatus = b.status || "draft";
  const slugSource = b.slug || b.title;
  const slug = await generatePostSlug(slugSource, teamId);
  let publishedAt = b.published_at ? new Date(b.published_at) : null;
  if (postStatus === "published" && !publishedAt) publishedAt = new Date();

  const post = await prisma.blogPost.create({
    data: {
      teamId,
      authorId: user.id,
      title: b.title,
      slug,
      excerpt: b.excerpt ?? null,
      content: b.content ?? "",
      featuredImage: b.featured_image ?? null,
      blogCategoryId: b.blog_category_id ? parseInt(b.blog_category_id, 10) : null,
      status: postStatus,
      publishedAt,
      metaTitle: b.meta_title ?? null,
      metaDescription: b.meta_description ?? null,
      ogImage: b.og_image ?? null,
      readTimeMinutes: calculateReadingTime(b.content || ""),
    },
  });

  if (Array.isArray(b.tags) && b.tags.length) {
    const tagIds = await findOrCreateTags(b.tags, teamId);
    await prisma.blogPostTag.createMany({
      data: tagIds.map((blogTagId) => ({ blogPostId: post.id, blogTagId })),
      skipDuplicates: true,
    });
  }

  const full = await prisma.blogPost.findUnique({ where: { id: post.id }, include: POST_INCLUDE });
  return NextResponse.json(serializePost(full), { status: 201 });
}
