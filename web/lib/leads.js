import prisma from "@/lib/prisma";

const num = (d) => (d == null ? null : Number(d));
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/**
 * A whole number from a form value — inputs send what was typed as text
 * ("03", "1", ""), and the lead's count columns are Int: text there made
 * Prisma reject the whole lead ("Create Lead" failed).
 */
export function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
/** An amount, or null when nothing (or nothing numeric) was entered. */
export function toAmount(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}
/** A date from "YYYY-MM-DD" (or anything Date parses), else null — never an Invalid Date. */
export function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The pipeline. "closed" is the old name for a dead lead — still accepted and
 * shown, but new choices are "lost" (with a reason) or "converted" (won).
 */
export const LEAD_STATUSES = ["new", "contacted", "quoted", "negotiating", "converted", "lost", "closed"];
export const OPEN_STATUSES = ["new", "contacted", "quoted", "negotiating"];
export const LEAD_SOURCES = ["website", "whatsapp", "phone", "instagram", "facebook", "google", "referral", "repeat", "walk_in", "b2b", "other"];
export const LEAD_PRIORITIES = ["hot", "warm", "cold"];
export const ACTIVITY_TYPES = ["note", "call", "whatsapp", "email", "meeting", "status", "follow_up", "assigned", "created", "converted", "edited"];
/** Activities that count as reaching the client. */
export const CONTACT_TYPES = ["call", "whatsapp", "email", "meeting"];

/** A value from a fixed list, or undefined when it isn't one (caller decides). */
export const oneOf = (v, list) => (v != null && list.includes(String(v)) ? String(v) : undefined);

/** A date-time for a follow-up: "" / null clear it, junk is undefined (ignored). */
export function toDateTime(v) {
  if (v === "" || v === null) return null;
  if (v === undefined) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function serializeActivity(a, author = null) {
  return {
    id: a.id,
    lead_id: a.leadId,
    type: a.type,
    body: a.body,
    meta: a.meta ?? null,
    created_at: a.createdAt,
    author: author ? { id: author.id, name: author.name } : null,
  };
}

/** Write one timeline entry. Never throws — the timeline must not break the action it records. */
export async function logLeadActivity(lead, authorId, type, body = null, meta = null) {
  try {
    return await prisma.leadActivity.create({
      data: { leadId: lead.id, userId: lead.userId, authorId: authorId ?? null, type, body, meta: meta ?? undefined },
    });
  } catch (err) {
    console.error(`logLeadActivity(${lead.id}, ${type}) failed:`, err.message);
    return null;
  }
}

export function generateInquiryId() {
  return `INQ${Math.floor(100000 + Math.random() * 900000)}`;
}

export function serializeLead(l, assignee = undefined) {
  return {
    id: l.id,
    inquiry_id: l.inquiryId,
    user_id: l.userId,
    client_name: l.clientName,
    client_email: l.clientEmail,
    client_phone: l.clientPhone,
    destination: l.destination,
    adults: l.adults,
    kids_cnb: l.kidsCnb,
    kids_5_to_12: l.kids5to12,
    start_date: dateOnly(l.startDate),
    duration: l.duration,
    approximate_budget: num(l.approximateBudget),
    currency: l.currency,
    special_requests: l.specialRequests,
    status: l.status,
    source_url: l.sourceUrl,
    notes: l.notes,
    is_public: l.isPublic,
    assigned_to: l.assignedTo,
    utm_source: l.utmSource,
    utm_medium: l.utmMedium,
    utm_campaign: l.utmCampaign,
    source: l.source || (l.isPublic || l.sourceUrl ? "website" : null),
    priority: l.priority || "warm",
    next_follow_up_at: l.nextFollowUpAt,
    last_contacted_at: l.lastContactedAt,
    lost_reason: l.lostReason,
    converted_trip_id: l.convertedTripId,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    assignee:
      assignee !== undefined
        ? assignee && { id: assignee.id, name: assignee.name, email: assignee.email }
        : undefined,
  };
}

/** User ids assignable for an admin: active members of teams they own. */
export async function assignableMemberIds(adminId) {
  const teams = await prisma.team.findMany({ where: { ownerId: adminId, isActive: true }, select: { id: true } });
  const members = await prisma.user.findMany({
    where: { teamId: { in: teams.map((t) => t.id) } },
    select: { id: true },
  });
  return [...new Set(members.map((m) => m.id))];
}

/**
 * Daily: one in-app reminder per agent listing the open leads whose follow-up
 * is due today or overdue (unassigned leads go to the agency admin). Each lead
 * is reminded once per day (`followUpRemindedAt`). Days are IST.
 */
export async function remindLeadFollowUps(now = new Date(), notifyFn) {
  const IST = 330 * 60000;
  const local = new Date(now.getTime() + IST);
  local.setUTCHours(0, 0, 0, 0);
  const dayStart = new Date(local.getTime() - IST);
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

  const leads = await prisma.leadInquiry.findMany({
    where: {
      userId: { not: null },
      status: { in: OPEN_STATUSES },
      nextFollowUpAt: { lte: dayEnd },
      OR: [{ followUpRemindedAt: null }, { followUpRemindedAt: { lt: dayStart } }],
    },
    select: { id: true, userId: true, assignedTo: true, clientName: true, nextFollowUpAt: true },
    orderBy: { nextFollowUpAt: "asc" },
    take: 5000,
  });

  const byAgent = new Map();
  for (const l of leads) {
    const to = l.assignedTo || l.userId;
    byAgent.set(to, [...(byAgent.get(to) || []), l]);
  }
  for (const [agentId, list] of byAgent) {
    const overdue = list.filter((l) => l.nextFollowUpAt < dayStart).length;
    const names = list.slice(0, 4).map((l) => l.clientName).join(", ");
    const more = list.length > 4 ? ` +${list.length - 4} more` : "";
    await notifyFn(agentId, "lead_follow_up", {
      type: "lead_follow_up",
      message: `${list.length} lead follow-up${list.length > 1 ? "s" : ""} due today${overdue ? ` (${overdue} overdue)` : ""}: ${names}${more}`,
      count: list.length,
      overdue,
    });
  }
  if (leads.length) {
    await prisma.leadInquiry.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data: { followUpRemindedAt: now } });
  }
  return { leads: leads.length, agents: byAgent.size };
}
