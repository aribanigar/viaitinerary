import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { serializeCompany } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

// GET /api/trusted-companies — public: the active logos for the landing page.
export async function GET() {
  const rows = await prisma.trustedCompany.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  return NextResponse.json(rows.map(serializeCompany));
}
