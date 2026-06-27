import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest, publicUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/user — the current authenticated user.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  }
  const team = user.teamId
    ? await prisma.team.findUnique({ where: { id: user.teamId } })
    : null;
  return NextResponse.json(publicUser(user, team));
}
