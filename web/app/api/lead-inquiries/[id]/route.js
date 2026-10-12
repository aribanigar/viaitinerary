import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import {
  serializeLead,
  serializeActivity,
  generateInquiryId,
  assignableMemberIds,
  logLeadActivity,
  toInt,
  toAmount,
  toDate,
  toDateTime,
  oneOf,
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
} from "@/lib/leads";
import { notify } from "@/lib/notify";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_LABEL = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiating: "Negotiating", converted: "Won", lost: "Lost", closed: "Closed" };
const fmtWhen = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

// GET /api/lead-inquiries/:id — one lead with its timeline (auth).
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const lead = await prisma.leadInquiry.findFirst({ where: { id: parseInt(params.id, 10), userId: adminId } });
  if (!lead) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: lead.id, userId: adminId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ids = [...new Set([lead.assignedTo, ...activities.map((a) => a.authorId)].filter(Boolean))];
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(people.map((p) => [p.id, p]));

  return NextResponse.json({
    inquiry: serializeLead(lead, lead.assignedTo ? byId.get(lead.assignedTo) || null : null),
    activities: activities.map((a) => serializeActivity(a, byId.get(a.authorId) || null)),
  });
}

// POST /api/lead-inquiries/:identifier — PUBLIC website form submit to an agency.
export async function POST(request, { params }) {
  const limit = await rateLimit(`lead-inquiry:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);
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
      adults: toInt(body.adults, 1),
      kidsCnb: toInt(body.kidsUpto5, 0),
      kids5to12: toInt(body.kids5to12, 0),
      startDate: toDate(body.startDate),
      duration: body.duration != null && body.duration !== "" ? String(body.duration) : null,
      approximateBudget: toAmount(body.approximateBudget),
      currency: body.currency ?? "INR (₹)",
      specialRequests: body.specialRequests ?? null,
      status: "new",
      source: "website",
      priority: "warm",
      sourceUrl: request.headers.get("referer"),
    },
  });

  // Speed to lead: the agency hears about it at once.
  await Promise.all([
    logLeadActivity(lead, null, "created", null, { source: "website" }),
    notify(agency.id, "new_lead", {
      type: "new_lead",
      message: `New website lead: ${lead.clientName}${lead.destination ? ` — ${lead.destination}` : ""}`,
      lead_inquiry_id: lead.id,
      inquiry_id: lead.inquiryId,
      client_name: lead.clientName,
      client_phone: lead.clientPhone,
      destination: lead.destination,
    }),
  ]);

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
  const log = []; // [type, body, meta] timeline entries for what changed

  if (b.status !== undefined) {
    if (!LEAD_STATUSES.includes(b.status)) return NextResponse.json({ message: "Invalid status." }, { status: 422 });
    if (b.status !== lead.status) {
      data.status = b.status;
      const reason = b.status === "lost" || b.status === "closed" ? String(b.lost_reason || "").trim() || null : null;
      if (reason) data.lostReason = reason;
      if (b.status !== "lost" && b.status !== "closed") data.lostReason = null;
      // A closed lead has nothing left to chase.
      if (["converted", "lost", "closed"].includes(b.status)) data.nextFollowUpAt = null;
      log.push(["status", `${STATUS_LABEL[lead.status] || lead.status} → ${STATUS_LABEL[b.status]}${reason ? ` — ${reason}` : ""}`, { from: lead.status, to: b.status }]);
    }
  }
  if (b.lost_reason !== undefined && data.lostReason === undefined && ["lost", "closed"].includes(lead.status)) {
    data.lostReason = String(b.lost_reason || "").trim() || null;
  }
  if (b.notes !== undefined) data.notes = b.notes;
  if (b.priority !== undefined) {
    const p = oneOf(b.priority, LEAD_PRIORITIES);
    if (!p) return NextResponse.json({ message: "Invalid priority." }, { status: 422 });
    if (p !== (lead.priority || "warm")) {
      data.priority = p;
      log.push(["edited", `Priority: ${p}`, { priority: p }]);
    }
  }
  if (b.source !== undefined) {
    const src = oneOf(b.source, LEAD_SOURCES);
    if (!src) return NextResponse.json({ message: "Invalid source." }, { status: 422 });
    data.source = src;
  }
  if (b.next_follow_up_at !== undefined) {
    const when = toDateTime(b.next_follow_up_at);
    if (when === undefined) return NextResponse.json({ message: "Invalid follow-up date." }, { status: 422 });
    const before = lead.nextFollowUpAt ? lead.nextFollowUpAt.getTime() : null;
    if ((when ? when.getTime() : null) !== before) {
      data.nextFollowUpAt = when;
      data.followUpRemindedAt = null;
      log.push(["follow_up", when ? `Follow-up set for ${fmtWhen(when)}` : "Follow-up cleared", { at: when }]);
    }
  }

  // Lead details, editable from the lead drawer.
  const edits = [];
  const text = (k, col, label) => {
    if (b[k] === undefined) return;
    const v = String(b[k] ?? "").trim() || null;
    if (v !== (lead[col] ?? null)) {
      data[col] = v;
      edits.push(label);
    }
  };
  if (b.client_name !== undefined && !String(b.client_name || "").trim()) {
    return NextResponse.json({ message: "Client name is required." }, { status: 422 });
  }
  text("client_name", "clientName", "name");
  text("client_email", "clientEmail", "email");
  if (b.client_phone !== undefined) {
    const ph = String(b.client_phone || "").replace(/[^\d+]/g, "");
    const v = ph.replace(/\D/g, "").length >= 7 ? ph : null;
    if (v !== lead.clientPhone) {
      data.clientPhone = v;
      edits.push("phone");
    }
  }
  text("destination", "destination", "destination");
  text("special_requests", "specialRequests", "requirements");
  if (b.duration !== undefined) {
    const v = b.duration != null && b.duration !== "" ? String(b.duration) : null;
    if (v !== lead.duration) {
      data.duration = v;
      edits.push("nights");
    }
  }
  if (b.start_date !== undefined) {
    data.startDate = toDate(b.start_date);
    edits.push("travel date");
  }
  if (b.adults !== undefined) data.adults = toInt(b.adults, 1);
  if (b.kids_cnb !== undefined) data.kidsCnb = toInt(b.kids_cnb, 0);
  if (b.kids_5_to_12 !== undefined) data.kids5to12 = toInt(b.kids_5_to_12, 0);
  if (b.adults !== undefined || b.kids_cnb !== undefined || b.kids_5_to_12 !== undefined) edits.push("guests");
  if (b.approximate_budget !== undefined) {
    data.approximateBudget = toAmount(b.approximate_budget);
    edits.push("budget");
  }
  if (edits.length) log.push(["edited", `Updated ${[...new Set(edits)].join(", ")}`, null]);

  if (Object.prototype.hasOwnProperty.call(b, "assigned_to")) {
    const willBeConverted = lead.status === "converted" || b.status === "converted";
    if (willBeConverted) return NextResponse.json({ message: "Converted leads cannot be reassigned." }, { status: 422 });
    if (b.assigned_to !== null) {
      const ids = await assignableMemberIds(adminId);
      if (!ids.includes(Number(b.assigned_to)) && Number(b.assigned_to) !== adminId) {
        return NextResponse.json({ message: "Selected assignee is not valid for your team." }, { status: 422 });
      }
    }
    data.assignedTo = b.assigned_to === null ? null : Number(b.assigned_to);
  }

  const updated = await prisma.leadInquiry.update({ where: { id: lead.id }, data });
  const assignee = updated.assignedTo
    ? await prisma.user.findUnique({ where: { id: updated.assignedTo }, select: { id: true, name: true, email: true } })
    : null;

  if (data.assignedTo !== undefined && data.assignedTo !== lead.assignedTo) {
    log.push(["assigned", assignee ? `Assigned to ${assignee.name}` : "Unassigned", { to: data.assignedTo }]);
  }
  await Promise.all(log.map(([type, body, meta]) => logLeadActivity(updated, user.id, type, body, meta)));

  if (data.assignedTo && data.assignedTo !== lead.assignedTo && data.assignedTo !== user.id) {
    await notify(data.assignedTo, "lead_assigned", {
      type: "lead_assigned",
      message: `Lead assigned to you: ${updated.clientName}${updated.destination ? ` — ${updated.destination}` : ""}`,
      lead_inquiry_id: updated.id,
      inquiry_id: updated.inquiryId,
      client_name: updated.clientName,
      client_phone: updated.clientPhone,
      destination: updated.destination,
    });
  }

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
