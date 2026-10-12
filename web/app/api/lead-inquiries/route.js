import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import {
  serializeLead,
  generateInquiryId,
  toInt,
  toAmount,
  toDate,
  toDateTime,
  oneOf,
  logLeadActivity,
  LEAD_STATUSES,
  OPEN_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
} from "@/lib/leads";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * End of the caller's "today". `tz` is the browser's getTimezoneOffset()
 * (minutes, IST = -330); without it IST is assumed — the agencies are Indian
 * and the functions run in Tokyo, so UTC midnight would be the wrong day.
 */
function endOfToday(tz) {
  const offset = Number.isFinite(Number(tz)) && tz !== null && tz !== "" ? Number(tz) : -330;
  const local = new Date(Date.now() - offset * 60000);
  local.setUTCHours(23, 59, 59, 999);
  return new Date(local.getTime() + offset * 60000);
}

// GET /api/lead-inquiries — the pipeline: list with filters (status, follow-up
// due, source, priority, mine, search, date range) plus counts per stage.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const followUp = searchParams.get("follow_up");
  const source = searchParams.get("source");
  const priority = searchParams.get("priority");
  const mine = searchParams.get("mine") === "1";
  const sort = searchParams.get("sort");
  const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get("per_page") || "25", 10)));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const now = new Date();
  const dayEnd = endOfToday(searchParams.get("tz"));
  const dayStart = new Date(dayEnd.getTime() - 86400000 + 1);

  const base = { userId: adminId };
  if (mine) base.assignedTo = user.id;

  const where = { ...base };
  if (status === "open") where.status = { in: OPEN_STATUSES };
  else if (status === "lost") where.status = { in: ["lost", "closed"] };
  else if (status && status !== "all") where.status = status;
  if (startDate && endDate) where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
  if (source && source !== "website") where.source = source;
  else if (source === "website") where.AND = [{ OR: [{ source: "website" }, { source: null, OR: [{ isPublic: true }, { sourceUrl: { not: null } }] }] }];
  if (priority === "warm") where.OR = [{ priority: "warm" }, { priority: null }];
  else if (priority) where.priority = priority;
  if (followUp) {
    // Follow-ups only matter while the lead is still open.
    if (!where.status || typeof where.status === "string") where.status = where.status && OPEN_STATUSES.includes(where.status) ? where.status : { in: OPEN_STATUSES };
    if (followUp === "due") where.nextFollowUpAt = { lte: dayEnd };
    else if (followUp === "overdue") where.nextFollowUpAt = { lt: dayStart };
    else if (followUp === "today") where.nextFollowUpAt = { gte: dayStart, lte: dayEnd };
    else if (followUp === "upcoming") where.nextFollowUpAt = { gt: dayEnd };
    else if (followUp === "none") where.nextFollowUpAt = null;
  }
  if (search) {
    const terms = [
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
      { clientPhone: { contains: search.replace(/[\s-]/g, ""), mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { inquiryId: { contains: search, mode: "insensitive" } },
    ];
    where.AND = [...(where.AND || []), { OR: terms }];
  }

  const orderBy =
    sort === "follow_up"
      ? [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
      : { createdAt: "desc" };

  const [total, leads, byStatus, due, overdue] = await Promise.all([
    prisma.leadInquiry.count({ where }),
    prisma.leadInquiry.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage }),
    prisma.leadInquiry.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.leadInquiry.count({ where: { ...base, status: { in: OPEN_STATUSES }, nextFollowUpAt: { lte: dayEnd } } }),
    prisma.leadInquiry.count({ where: { ...base, status: { in: OPEN_STATUSES }, nextFollowUpAt: { lt: dayStart } } }),
  ]);

  const assigneeIds = [...new Set(leads.map((l) => l.assignedTo).filter(Boolean))];
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(assignees.map((a) => [a.id, a]));

  // Per stage, plus "open" (still being worked) and "all"; the Lost tab also
  // holds the old "closed" leads.
  const counts = Object.fromEntries(LEAD_STATUSES.map((st) => [st, 0]));
  for (const row of byStatus) counts[row.status] = (counts[row.status] || 0) + row._count._all;
  const sum = (keys) => keys.reduce((n, k) => n + (counts[k] || 0), 0);
  Object.assign(counts, {
    all: byStatus.reduce((n, row) => n + row._count._all, 0),
    open: sum(OPEN_STATUSES),
    lost: sum(["lost", "closed"]),
    due,
    overdue,
  });

  return NextResponse.json({
    data: leads.map((l) => serializeLead(l, l.assignedTo ? byId.get(l.assignedTo) || null : null)),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
    from: total === 0 ? 0 : (page - 1) * perPage + 1,
    to: Math.min(page * perPage, total),
    counts,
  });
}

// POST /api/lead-inquiries — manual create by an agent (phone call, WhatsApp,
// walk-in…). A name and one way to reach the client are enough: most travel
// leads arrive as a phone number, not an email.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const b = await request.json();

  const name = String(b.client_name || "").trim();
  const email = String(b.client_email || "").trim() || null;
  const phone = String(b.client_phone || "").replace(/[^\d+]/g, "");
  const hasPhone = phone.replace(/\D/g, "").length >= 7;
  if (!name) return NextResponse.json({ message: "Client name is required." }, { status: 422 });
  if (!email && !hasPhone) return NextResponse.json({ message: "Add the client's phone number or email." }, { status: 422 });

  // Same client already being worked? Still saved (a second trip is a new
  // lead), but the agent is told so nobody chases them twice.
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const sameClient = [
    ...(hasPhone && last10.length === 10 ? [{ clientPhone: { endsWith: last10 } }] : []),
    ...(email ? [{ clientEmail: { equals: email, mode: "insensitive" } }] : []),
  ];
  const duplicate = sameClient.length
    ? await prisma.leadInquiry.findFirst({
        where: { userId: adminId, status: { in: OPEN_STATUSES }, OR: sameClient },
        select: { id: true, inquiryId: true, clientName: true, status: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const status = oneOf(b.status, LEAD_STATUSES) ?? "new";
  const lead = await prisma.leadInquiry.create({
    data: {
      inquiryId: generateInquiryId(),
      userId: adminId,
      clientName: name,
      clientEmail: email,
      clientPhone: hasPhone ? phone : null,
      destination: String(b.destination || "").trim() || null,
      adults: toInt(b.adults, 1),
      kidsCnb: toInt(b.kids_cnb, 0),
      kids5to12: toInt(b.kids_5_to_12, 0),
      startDate: toDate(b.start_date),
      duration: b.duration != null && b.duration !== "" ? String(b.duration) : null,
      approximateBudget: toAmount(b.approximate_budget),
      currency: b.currency || "INR (₹)",
      specialRequests: b.special_requests || null,
      status,
      notes: b.notes || null,
      isPublic: false,
      assignedTo: user.id,
      source: oneOf(b.source, LEAD_SOURCES) ?? "phone",
      priority: oneOf(b.priority, LEAD_PRIORITIES) ?? "warm",
      nextFollowUpAt: toDateTime(b.next_follow_up_at) ?? null,
    },
  });

  await logLeadActivity(lead, user.id, "created", b.notes ? String(b.notes) : null, { source: lead.source });
  if (adminId !== user.id) {
    await notify(adminId, "new_lead", {
      type: "new_lead",
      message: `New lead: ${lead.clientName}${lead.destination ? ` — ${lead.destination}` : ""}`,
      lead_inquiry_id: lead.id,
      inquiry_id: lead.inquiryId,
      client_name: lead.clientName,
      client_phone: lead.clientPhone,
      destination: lead.destination,
    });
  }

  return NextResponse.json(
    {
      message: "Lead saved.",
      inquiry: serializeLead(lead),
      duplicate: duplicate
        ? { id: duplicate.id, inquiry_id: duplicate.inquiryId, client_name: duplicate.clientName, status: duplicate.status }
        : null,
    },
    { status: 201 }
  );
}
