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
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    assignee:
      assignee !== undefined
        ? assignee && { id: assignee.id, name: assignee.name, email: assignee.email }
        : undefined,
  };
}

/** User ids assignable for an admin: active members of teams they own. */
import prisma from "@/lib/prisma";
export async function assignableMemberIds(adminId) {
  const teams = await prisma.team.findMany({ where: { ownerId: adminId, isActive: true }, select: { id: true } });
  const members = await prisma.user.findMany({
    where: { teamId: { in: teams.map((t) => t.id) } },
    select: { id: true },
  });
  return [...new Set(members.map((m) => m.id))];
}
