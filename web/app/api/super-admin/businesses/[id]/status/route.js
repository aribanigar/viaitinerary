import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "inactive", "suspended"];

// PATCH /api/super-admin/businesses/:id/status
export async function PATCH(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  if (!STATUSES.includes(b.status)) {
    return NextResponse.json({ message: "Invalid status." }, { status: 422 });
  }

  const updated = await prisma.user.update({ where: { id }, data: { status: b.status } });
  return NextResponse.json({ message: "Status updated successfully", status: updated.status });
}
