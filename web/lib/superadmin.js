import prisma from "@/lib/prisma";
import { isTrial, isExpired } from "@/lib/subscription";

const num = (v) => (v == null ? 0 : Number(v));

export function planInfo(sub, extra = {}) {
  if (!sub) return null;
  const trial = isTrial(sub);
  return {
    plan_name: sub.planKey,
    is_trial: trial,
    is_expired: isExpired(sub),
    expires_at: trial ? sub.trialEndsAt : sub.endsAt,
    ...extra,
  };
}

/**
 * Compute the per-admin aggregates the super-admin business views need:
 * trips count + revenue (sum of trip paid_amount), and team-member count
 * (member users belonging to the admin's owned teams, excluding the admin).
 */
export async function businessAggregates(adminIds) {
  if (!adminIds.length) {
    return { tripsCount: new Map(), revenue: new Map(), memberCount: new Map() };
  }

  const tripGroups = await prisma.trip.groupBy({
    by: ["userId"],
    where: { userId: { in: adminIds }, isPackage: false },
    _count: { _all: true },
    _sum: { paidAmount: true },
  });
  const tripsCount = new Map();
  const revenue = new Map();
  for (const g of tripGroups) {
    tripsCount.set(g.userId, g._count._all);
    revenue.set(g.userId, num(g._sum.paidAmount));
  }

  // Member count: users whose team is owned by an admin, excluding the admin itself.
  const teams = await prisma.team.findMany({
    where: { ownerId: { in: adminIds } },
    select: { id: true, ownerId: true },
  });
  const teamOwner = new Map(teams.map((t) => [t.id, t.ownerId]));
  const memberCount = new Map();
  if (teams.length) {
    const members = await prisma.user.findMany({
      where: { teamId: { in: teams.map((t) => t.id) }, id: { notIn: adminIds } },
      select: { teamId: true },
    });
    for (const m of members) {
      const owner = teamOwner.get(m.teamId);
      if (owner != null) memberCount.set(owner, (memberCount.get(owner) || 0) + 1);
    }
  }

  return { tripsCount, revenue, memberCount };
}

export function businessRow(admin, { sub, agency, tripsCount, revenue, memberCount }) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: agency ? agency.contactPhone : null,
    status: admin.status,
    bypass_subscription: !!admin.bypassSubscription,
    team_members_count: memberCount || 0,
    trips_count: tripsCount || 0,
    total_revenue: num(revenue),
    plan: planInfo(sub),
    created_at: admin.createdAt,
  };
}
