import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { getBlogTeamIds, serializePost, POST_INCLUDE } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/blog/posts/:slug — single post; super admins may preview drafts.
export async function GET(request, { params }) {
  const teamIds = await getBlogTeamIds();
  const user = await userFromRequest(request);
  const isSuperAdmin = user && user.role === "super_admin";

  const where = { teamId: { in: teamIds }, slug: params.slug };
  if (!isSuperAdmin) {
    where.status = "published";
    where.publishedAt = { lte: new Date() };
  }

  const post = await prisma.blogPost.findFirst({ where, include: POST_INCLUDE });
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (post.status === "published" && !isSuperAdmin) {
    await prisma.blogPost.update({ where: { id: post.id }, data: { viewsCount: { increment: 1 } } });
    post.viewsCount += 1;
  }

  return NextResponse.json(serializePost(post));
}
