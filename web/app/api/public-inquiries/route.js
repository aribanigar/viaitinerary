import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateInquiryId } from "@/lib/leads";

export const dynamic = "force-dynamic";

// POST /api/public-inquiries — PUBLIC inquiry with no agency (goes to super admin).
export async function POST(request) {
  const body = await request.json();

  if (body.website) {
    return NextResponse.json(
      { message: "Your inquiry has been submitted successfully!", inquiry_id: "INQ000000" },
      { status: 201 }
    );
  }
  if (!body.clientName && !body.client_name) {
    return NextResponse.json({ message: "Name is required." }, { status: 422 });
  }

  const lead = await prisma.leadInquiry.create({
    data: {
      inquiryId: generateInquiryId(),
      userId: null,
      isPublic: true,
      clientName: body.clientName ?? body.client_name,
      clientEmail: body.clientEmail ?? body.client_email ?? null,
      clientPhone: body.clientPhone ?? body.client_phone ?? null,
      destination: body.destination ?? null,
      adults: body.adults ?? 1,
      kidsCnb: body.kidsUpto5 ?? 0,
      kids5to12: body.kids5to12 ?? 0,
      startDate: body.startDate ? new Date(body.startDate) : null,
      duration: body.duration != null ? String(body.duration) : null,
      approximateBudget: body.approximateBudget != null ? Number(body.approximateBudget) : null,
      currency: body.currency ?? null,
      specialRequests: body.specialRequests ?? null,
      status: "new",
      sourceUrl: request.headers.get("referer"),
    },
  });

  return NextResponse.json({ message: "Your inquiry has been submitted successfully!", inquiry_id: lead.inquiryId }, { status: 201 });
}
