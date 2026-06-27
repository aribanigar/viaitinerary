import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { resolveBlogTeamId, generateTagSlug, strSlug, serializeTag } from "@/lib/blog";

export const dynamic = "force-dynamic";

// GET /api/super-admin/blog/tags — list with post counts.
export async function GET(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const tags = await prisma.blogTag.findMany({
    where: { teamId },
    include: { _count: { select: { posts: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags.map(serializeTag));
}

// POST /api/super-admin/blog/tags — create.
export async function POST(request) {
  const { user, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const teamId = await resolveBlogTeamId(user);

  const b = await request.json();
  if (!b.name) return NextResponse.json({ errors: { name: ["The name field is required."] } }, { status: 422 });

  const slug = b.slug || strSlug(b.name);
  const existing = await prisma.blogTag.findFirst({ where: { teamId, slug } });
  if (existing) return NextResponse.json({ error: "Tag already exists" }, { status: 409 });

  const finalSlug = b.slug || (await generateTagSlug(b.name, teamId));
  const tag = await prisma.blogTag.create({ data: { teamId, name: b.name, slug: finalSlug } });
  return NextResponse.json(serializeTag(tag), { status: 201 });
}
