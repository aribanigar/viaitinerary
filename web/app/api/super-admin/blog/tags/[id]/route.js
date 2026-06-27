import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/super-admin/blog/tags/:id — detach from posts and delete.
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const tag = await prisma.blogTag.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!tag) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prisma.blogPostTag.deleteMany({ where: { blogTagId: tag.id } });
  await prisma.blogTag.delete({ where: { id: tag.id } });
  return NextResponse.json({ message: "Tag deleted successfully" });
}
