import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializePost, POST_INCLUDE } from "@/lib/blog";

export const dynamic = "force-dynamic";

// POST /api/super-admin/blog/posts/:id/unpublish — revert to draft.
export async function POST(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const post = await prisma.blogPost.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!post) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updated = await prisma.blogPost.update({
    where: { id: post.id },
    data: { status: "draft" },
    include: POST_INCLUDE,
  });
  return NextResponse.json(serializePost(updated));
}
