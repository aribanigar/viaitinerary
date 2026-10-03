import prisma from "@/lib/prisma";

// Shared lookup for the public /api/public/proposals/:token/* routes.
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** → { trip, settings } or null (bad token, unknown link, or a package). */
export async function loadProposalTrip(token, include) {
  if (!TOKEN_RE.test(token || "")) return null;
  const trip = await prisma.trip.findUnique({ where: { proposalToken: token }, ...(include ? { include } : {}) });
  if (!trip || trip.isPackage) return null;
  const settings = await prisma.agencySetting.findUnique({ where: { userId: trip.userId } });
  return { trip, settings };
}
