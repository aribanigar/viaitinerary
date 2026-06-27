import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { serializeLead, generateInquiryId, assignableMemberIds } from "@/lib/leads";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["new", "contacted", "quoted", "converted", "closed"];

// POST /api/lead-inquiries/:identifier — PUBLIC website form submit to an agency.
export async function POST(request, { params }) {
  const body = await request.json();

  // Honeypot: bots fill the hidden "website" field.
  if (body.website) {
    return NextResponse.json(
      { message: "Your trip inquiry has been submitted successfully! The agency will contact you soon.", inquiry_id: "INQ000000" },
      { status: 201 }
    );
  }

  const identifier = params.id;
  const where = { role: "admin", status: "active" };
  if (UUID_RE.test(identifier)) where.embedToken = identifier;
  else where.id = parseInt(identifier, 10);

  const agency = await prisma.user.findFirst({ where });
  if (!agency) return NextResponse.json({ message: "Invalid agency or agency is not active." }, { status: 404 });

  if (!body.clientName || !body.clientEmail || !body.clientPhone || !body.destination || !body.startDate || !body.duration) {
    return NextResponse.json({ message: "Please fill all required fields." }, { status: 422 });
  }

  // Duplicate prevention: same email + agency within 2 minutes.
  const recent = await prisma.leadInquiry.findFirst({
    where: { userId: agency.id, clientEmail: body.clientEmail, createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } },
  });
  if (recent) {
    return NextResponse.json(
      { message: "Your trip inquiry has been submitted successfully! The agency will contact you soon.", inquiry_id: recent.inquiryId },
      { status: 201 }
    );
  }

  const lead = await prisma.leadInquiry.create({
    data: {
      inquiryId: generateInquiryId(),
      userId: agency.id,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientPhone: body.clientPhone,
      destination: body.destination,
      adults: body.adults ?? 1,
      kidsCnb: body.kidsUpto5 ?? 0,
      kids5to12: body.kids5to12 ?? 0,
      startDate: new Date(body.startDate),
      duration: String(body.duration),
      approximateBudget: body.approximateBudget != null ? Number(body.approximateBudget) : null,
      currency: body.currency ?? "INR (₹)",
      specialRequests: body.specialRequests ?? null,
      status: "new",
      sourceUrl: request.headers.get("referer"),
    },
  });

  return NextResponse.json(
    { message: "Your trip inquiry has been submitted successfully! The agency will contact you soon.", inquiry_id: lead.inquiryId },
    { status: 201 }
  );
}

// PATCH /api/lead-inquiries/:id — update status / notes / assignment (auth).
export async function PATCH(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const lead = await prisma.leadInquiry.findFirst({ where: { id: parseInt(params.id, 10), userId: adminId } });
  if (!lead) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  const data = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ message: "Invalid status." }, { status: 422 });
    data.status = b.status;
  }
  if (b.notes !== undefined) data.notes = b.notes;
  if (Object.prototype.hasOwnProperty.call(b, "assigned_to")) {
    const willBeConverted = lead.status === "converted" || b.status === "converted";
    if (willBeConverted) return NextResponse.json({ message: "Converted leads cannot be reassigned." }, { status: 422 });
    if (b.assigned_to !== null) {
      const ids = await assignableMemberIds(adminId);
      if (!ids.includes(Number(b.assigned_to))) {
        return NextResponse.json({ message: "Selected assignee is not valid for your team." }, { status: 422 });
      }
    }
    data.assignedTo = b.assigned_to === null ? null : Number(b.assigned_to);
  }

  const updated = await prisma.leadInquiry.update({ where: { id: lead.id }, data });
  const assignee = updated.assignedTo
    ? await prisma.user.findUnique({ where: { id: updated.assignedTo }, select: { id: true, name: true, email: true } })
    : null;
  return NextResponse.json({ message: "Inquiry updated successfully.", inquiry: serializeLead(updated, assignee) });
}

// DELETE /api/lead-inquiries/:id
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const lead = await prisma.leadInquiry.findFirst({ where: { id: parseInt(params.id, 10), userId: adminId } });
  if (!lead) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.leadInquiry.delete({ where: { id: lead.id } });
  return NextResponse.json({ message: "Inquiry deleted successfully." });
}
