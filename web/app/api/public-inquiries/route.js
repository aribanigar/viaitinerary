import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateInquiryId, toInt, toAmount, toDate } from "@/lib/leads";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";
import { mailerForAdminId, sendMail, publicLeadAdminHtml, publicLeadCustomerHtml } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// POST /api/public-inquiries — PUBLIC inquiry with no agency (goes to super admin).
export async function POST(request) {
  const limit = await rateLimit(`public-inquiries:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

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
      adults: toInt(body.adults, 1),
      kidsCnb: toInt(body.kidsUpto5, 0),
      kids5to12: toInt(body.kids5to12, 0),
      startDate: toDate(body.startDate),
      duration: body.duration != null && body.duration !== "" ? String(body.duration) : null,
      approximateBudget: toAmount(body.approximateBudget),
      currency: body.currency ?? null,
      specialRequests: body.specialRequests ?? null,
      status: "new",
      sourceUrl: request.headers.get("referer"),
    },
  });

  const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  if (superAdmin) {
    await notify(superAdmin.id, "new_lead", {
      lead_inquiry_id: lead.id,
      inquiry_id: lead.inquiryId,
      client_name: lead.clientName,
      destination: lead.destination,
    });
  }

  // Email the platform admin and a receipt to the traveller. The lead is
  // already saved, so a mail failure only gets logged.
  await emailPublicLead(lead, superAdmin);

  return NextResponse.json({ message: "Your inquiry has been submitted successfully!", inquiry_id: lead.inquiryId }, { status: 201 });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emailPublicLead(lead, superAdmin) {
  try {
    const { mailer } = await mailerForAdminId(superAdmin?.id);
    if (!mailer) return;
    const adminTo = process.env.ADMIN_ALERT_EMAIL || superAdmin?.email;
    const sends = [];
    if (adminTo) {
      sends.push(
        sendMail(mailer, {
          to: adminTo,
          ...(lead.clientEmail && EMAIL_RE.test(lead.clientEmail) ? { replyTo: lead.clientEmail } : {}),
          subject: `New lead ${lead.inquiryId}: ${lead.clientName}${lead.destination ? ` (${lead.destination})` : ""}`,
          html: publicLeadAdminHtml(lead),
        }),
      );
    }
    if (lead.clientEmail && EMAIL_RE.test(lead.clientEmail)) {
      sends.push(
        sendMail(mailer, {
          to: lead.clientEmail,
          subject: `We have your trip request (${lead.inquiryId})`,
          html: publicLeadCustomerHtml(lead, mailer.fromName),
        }),
      );
    }
    const results = await Promise.allSettled(sends);
    results.forEach((r) => {
      if (r.status === "rejected") console.error("public lead email failed:", r.reason?.message || r.reason);
    });
  } catch (e) {
    console.error("public lead email failed:", e?.message || e);
  }
}
