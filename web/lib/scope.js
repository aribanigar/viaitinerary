import prisma from "@/lib/prisma";

/**
 * The "admin context" id used to scope all data (mirrors the Laravel
 * BelongsToAdmin trait / User::getAdminId).
 *  - admin / super_admin → their own id
 *  - team member         → the id of the admin who owns their team
 */
export async function adminIdOf(user) {
  if (user.role === "team" && user.teamId) {
    const team = await prisma.team.findUnique({ where: { id: user.teamId } });
    return team?.ownerId ?? user.id;
  }
  return user.id;
}

/** The teams.id for a team-role user, else null (mirrors User::getTeamId). */
export function teamIdOf(user) {
  return user.role === "team" ? user.teamId ?? null : null;
}
