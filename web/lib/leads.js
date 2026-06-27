const num = (d) => (d == null ? null : Number(d));
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

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
