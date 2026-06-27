import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializeLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

// POST /api/super-admin/public-inquiries/:id/assign { admin_id }
export async function POST(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const inquiry = await prisma.leadInquiry.findFirst({
    where: { id: parseInt(params.id, 10), isPublic: true },
  });
  if (!inquiry) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  if (!b.admin_id) return NextResponse.json({ message: "admin_id is required." }, { status: 422 });

  const admin = await prisma.user.findFirst({ where: { id: parseInt(b.admin_id, 10), role: "admin" } });
  if (!admin) return NextResponse.json({ message: "Selected admin is not valid." }, { status: 404 });

  // Transfer ownership to the admin and mark as no longer public.
  const updated = await prisma.leadInquiry.update({
    where: { id: inquiry.id },
    data: { assignedTo: admin.id, userId: admin.id, isPublic: false },
  });

  return NextResponse.json({
    message: "Inquiry assigned successfully.",
    inquiry: serializeLead(updated, { id: admin.id, name: admin.name, email: admin.email }),
  });
}
