import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { serializeLead, generateInquiryId } from "@/lib/leads";

export const dynamic = "force-dynamic";

// GET /api/lead-inquiries — list with filters (status, search, date range).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { userId: adminId };
  if (status && status !== "all") where.status = status;
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
  const assignees = await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, email: true } });
  const byId = new Map(assignees.map((a) => [a.id, a]));

  return NextResponse.json({
    data: leads.map((l) => serializeLead(l, l.assignedTo ? byId.get(l.assignedTo) || null : null)),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}

// POST /api/lead-inquiries — manual create by an admin.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json();

  if (!b.client_name) return NextResponse.json({ message: "client_name is required." }, { status: 422 });
  if (!b.client_email) return NextResponse.json({ message: "client_email is required." }, { status: 422 });
  if (!b.destination) return NextResponse.json({ message: "destination is required." }, { status: 422 });

  const lead = await prisma.leadInquiry.create({
    data: {
      inquiryId: generateInquiryId(),
      userId: adminId,
      clientName: b.client_name,
      clientEmail: b.client_email,
      clientPhone: b.client_phone ?? null,
      destination: b.destination,
      adults: b.adults ?? 1,
      kidsCnb: b.kids_cnb ?? 0,
      kids5to12: b.kids_5_to_12 ?? 0,
      startDate: b.start_date ? new Date(b.start_date) : null,
      duration: b.duration != null ? String(b.duration) : null,
      approximateBudget: b.approximate_budget != null ? Number(b.approximate_budget) : null,
      currency: b.currency ?? "INR (₹)",
      specialRequests: b.special_requests ?? null,
      status: b.status ?? "new",
      notes: b.notes ?? null,
      isPublic: false,
      assignedTo: user.id,
    },
  });

  return NextResponse.json({ message: "Lead inquiry created successfully.", inquiry: serializeLead(lead) }, { status: 201 });
}
