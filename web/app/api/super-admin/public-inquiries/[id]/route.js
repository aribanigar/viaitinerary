import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/super-admin/public-inquiries/:id — remove a public inquiry
// (super admin only). Its activity log goes with it (cascade).
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const inquiry = await prisma.leadInquiry.findFirst({ where: { id, isPublic: true } });
  if (!inquiry) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prisma.leadInquiry.delete({ where: { id: inquiry.id } });
  return NextResponse.json({ message: "Inquiry deleted successfully." });
}
