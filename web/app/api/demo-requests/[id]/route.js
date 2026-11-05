import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/demo-requests/:id — super admin.
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const id = parseInt(params.id, 10);
  const row = Number.isFinite(id) ? await prisma.demoRequest.findUnique({ where: { id } }) : null;
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.demoRequest.delete({ where: { id } });
  return NextResponse.json({ status: "success", message: "Demo request deleted successfully" });
}
