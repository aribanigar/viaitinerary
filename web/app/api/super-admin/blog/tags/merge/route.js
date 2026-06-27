import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { resolveBlogTeamId, serializeTag } from "@/lib/blog";

export const dynamic = "force-dynamic";

// POST /api/super-admin/blog/tags/merge { source_tag_ids: [], target_tag_id }
export async function POST(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const b = await request.json();
  if (!Array.isArray(b.source_tag_ids) || b.source_tag_ids.length < 2) {
    return NextResponse.json({ errors: { source_tag_ids: ["At least two source tags are required."] } }, { status: 422 });
  }
  if (!b.target_tag_id) {
    return NextResponse.json({ errors: { target_tag_id: ["The target tag is required."] } }, { status: 422 });
  }

  const targetId = parseInt(b.target_tag_id, 10);
  const target = await prisma.blogTag.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ message: "Target tag not found." }, { status: 404 });
  if (target.teamId !== teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  for (const rawId of b.source_tag_ids) {
    const sourceId = parseInt(rawId, 10);
    if (sourceId === targetId) continue;
    const source = await prisma.blogTag.findUnique({ where: { id: sourceId } });
    if (!source || source.teamId !== teamId) continue;

    // Reassign each post from the source tag to the target tag.
    const links = await prisma.blogPostTag.findMany({ where: { blogTagId: sourceId } });
    for (const link of links) {
      const exists = await prisma.blogPostTag.findFirst({
        where: { blogPostId: link.blogPostId, blogTagId: targetId },
      });
      if (!exists) {
        await prisma.blogPostTag.create({ data: { blogPostId: link.blogPostId, blogTagId: targetId } });
      }
    }
    await prisma.blogPostTag.deleteMany({ where: { blogTagId: sourceId } });
    await prisma.blogTag.delete({ where: { id: sourceId } });
  }

  const fresh = await prisma.blogTag.findUnique({
    where: { id: targetId },
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json({ message: "Tags merged successfully", target_tag: serializeTag(fresh) });
}
