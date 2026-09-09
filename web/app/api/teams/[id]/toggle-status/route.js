import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { serializeTeamMember, resolveOwnedMember } from "@/lib/teamMembers";

export const dynamic = "force-dynamic";

// PATCH /api/teams/:id/toggle-status — flip active/inactive.
export async function PATCH(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const id = parseInt(params.id, 10);
  const { member, error, status } = await resolveOwnedMember(user, id);
  if (error) return NextResponse.json({ message: error }, { status });

  const updated = await prisma.user.update({
    where: { id },
    data: { status: member.status === "active" ? "inactive" : "active" },
  });
  const sub = await prisma.subscription.findUnique({ where: { userId: id } });
  return NextResponse.json(serializeTeamMember(updated, sub));
}
