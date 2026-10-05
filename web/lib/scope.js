import prisma from "@/lib/prisma";

/**
 * The "admin context" (tenant) id used to scope all data.
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

/** The teams.id for a team-role user, else null. */
export function teamIdOf(user) {
  return user.role === "team" ? user.teamId ?? null : null;
}
