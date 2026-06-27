import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  generatePostSlug,
  calculateReadingTime,
  findOrCreateTags,
  serializePost,
  POST_INCLUDE,
} from "@/lib/blog";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "published", "scheduled", "archived"];

async function syncPostTags(postId, teamId, tagNames) {
  const tagIds = await findOrCreateTags(tagNames, teamId);
  await prisma.blogPostTag.deleteMany({ where: { blogPostId: postId, blogTagId: { notIn: tagIds.length ? tagIds : [-1] } } });
  if (tagIds.length) {
    await prisma.blogPostTag.createMany({
      data: tagIds.map((blogTagId) => ({ blogPostId: postId, blogTagId })),
      skipDuplicates: true,
    });
  }
}

// GET /api/super-admin/blog/posts/:id
export async function GET(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const post = await prisma.blogPost.findUnique({ where: { id: parseInt(params.id, 10) }, include: POST_INCLUDE });
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(serializePost(post));
}

// PUT /api/super-admin/blog/posts/:id
export async function PUT(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const post = await prisma.blogPost.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  if (b.status && !STATUSES.includes(b.status)) {
    return NextResponse.json({ errors: { status: ["Invalid status."] } }, { status: 422 });
  }

  const data = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.excerpt !== undefined) data.excerpt = b.excerpt;
  if (b.featured_image !== undefined) data.featuredImage = b.featured_image;
  if (b.blog_category_id !== undefined) data.blogCategoryId = b.blog_category_id ? parseInt(b.blog_category_id, 10) : null;
  if (b.meta_title !== undefined) data.metaTitle = b.meta_title;
  if (b.meta_description !== undefined) data.metaDescription = b.meta_description;
  if (b.og_image !== undefined) data.ogImage = b.og_image;
  if (b.status !== undefined) data.status = b.status;
  if (b.published_at !== undefined) data.publishedAt = b.published_at ? new Date(b.published_at) : null;
  if (b.content !== undefined) {
    data.content = b.content;
    data.readTimeMinutes = calculateReadingTime(b.content);
  }

  // Slug: explicit slug wins; else regenerate when the title changes.
  if (b.slug) {
    data.slug = await generatePostSlug(b.slug, post.teamId, post.id);
  } else if (b.title !== undefined && b.title !== post.title) {
    data.slug = await generatePostSlug(b.title, post.teamId, post.id);
  }

  // Auto-set published_at when first published.
  if (data.status === "published" && !post.publishedAt && data.publishedAt == null) {
    data.publishedAt = new Date();
  }

  await prisma.blogPost.update({ where: { id: post.id }, data });
  if (Array.isArray(b.tags)) await syncPostTags(post.id, post.teamId, b.tags);

  const fresh = await prisma.blogPost.findUnique({ where: { id: post.id }, include: POST_INCLUDE });
  return NextResponse.json(serializePost(fresh));
}

// DELETE /api/super-admin/blog/posts/:id
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const post = await prisma.blogPost.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.blogPost.delete({ where: { id: post.id } });
  return NextResponse.json({ message: "Post deleted successfully" });
}
