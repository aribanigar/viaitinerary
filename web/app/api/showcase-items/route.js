import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { parseShowcase, serializeShowcase } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// GET /api/showcase-items[?active_only=1] — public (landing page + admin list).
export async function GET(request) {
  const activeOnly = new URL(request.url).searchParams.has("active_only");
  const rows = await prisma.showcaseItem.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(rows.map(serializeShowcase));
}

// POST /api/showcase-items — super admin.
export async function POST(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const { data, errors } = await parseShowcase(await request.json().catch(() => ({})));
  if (errors) return NextResponse.json({ message: Object.values(errors)[0][0], errors }, { status: 422 });
  const row = await prisma.showcaseItem.create({ data });
  return NextResponse.json(serializeShowcase(row), { status: 201 });
}
