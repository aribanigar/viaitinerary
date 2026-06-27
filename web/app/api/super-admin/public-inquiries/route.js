import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializeLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

// GET /api/super-admin/public-inquiries — public (unassigned-to-agency) inquiries.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const { searchParams } = new URL(request.url);
  const filterStatus = searchParams.get("status");
  const assigned = searchParams.get("assigned");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const search = searchParams.get("search");
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { isPublic: true };
  if (filterStatus && filterStatus !== "all") where.status = filterStatus;
  if (assigned && assigned !== "all") {
    if (assigned === "unassigned") where.assignedTo = null;
    else where.assignedTo = { not: null };
  }
  if (startDate && endDate) where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
  if (search) {
    where.OR = [
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
      { clientPhone: { contains: search, mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { inquiryId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, leads] = await Promise.all([
    prisma.leadInquiry.count({ where }),
    prisma.leadInquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ]);

  const assigneeIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean))];
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(assignees.map((a) => [a.id, a]));

  return NextResponse.json({
    data: leads.map((l) => serializeLead(l, l.assignedTo ? byId.get(l.assignedTo) || null : null)),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}
