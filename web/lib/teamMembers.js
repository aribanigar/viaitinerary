import prisma from "@/lib/prisma";
import { isTrial, isExpired } from "@/lib/subscription";

/**
 * Serialize a team-member User row (+ their own Subscription, if a seat has
 * been assigned) into the shape the frontend was built against. status is
 * capitalized only here, at the response boundary — the DB stays lowercase,
 * matching every other User row in the app. A member with no Subscription
 * row yet (no seat assigned) reports as "pending", not a missing field.
 */
export function serializeTeamMember(member, subscription) {
  return {
    id: member.id,
    user_id: member.id,
    name: member.name,
    role: member.role,
    phone: member.phone,
    image_url: member.profilePicture || null,
    status: member.status === "active" ? "Active" : "Inactive",
    trips_count: 0, // trip authorship isn't tracked per team member today
    is_paid: !!(subscription && subscription.status === "active" && !isTrial(subscription) && !isExpired(subscription)),
    user: {
      email: member.email,
      name: member.name,
      subscription: subscription
        ? { status: subscription.status, plan_key: subscription.planKey }
        : { status: "pending", plan_key: null },
    },
  };
}

/**
 * Resolve a team-member User row that the caller (an admin/super_admin)
 * actually owns — same ownership check as /api/subscription/assign-member.
 * Returns { member } or { error, status }.
 */
export async function resolveOwnedMember(caller, id) {
  if (!["admin", "super_admin"].includes(caller.role)) {
    return { error: "Only admins can manage team members.", status: 403 };
  }
  const member = await prisma.user.findUnique({ where: { id } });
  if (!member) return { error: "Team member not found.", status: 404 };
  const team = member.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
  if (!team || team.ownerId !== caller.id) return { error: "Access denied.", status: 403 };
  return { member };
}
