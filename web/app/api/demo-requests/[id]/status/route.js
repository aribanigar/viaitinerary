import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { DEMO_STATUSES, serializeDemoRequest } from "@/lib/demoRequests";

export const dynamic = "force-dynamic";

// PATCH /api/demo-requests/:id/status { status } — super admin.
export async function PATCH(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const b = await request.json().catch(() => ({}));
  if (!DEMO_STATUSES.includes(b.status)) {
    return NextResponse.json({ message: "The selected status is invalid.", errors: { status: ["The selected status is invalid."] } }, { status: 422 });
  }
  const id = parseInt(params.id, 10);
  const row = Number.isFinite(id) ? await prisma.demoRequest.findUnique({ where: { id } }) : null;
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const updated = await prisma.demoRequest.update({ where: { id }, data: { status: b.status } });
  return NextResponse.json({ status: "success", message: "Status updated successfully", data: serializeDemoRequest(updated) });
}
