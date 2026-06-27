import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { assignIncludedSeat } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// POST /api/subscription/assign-member { member_user_id }
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ message: "Only admins can assign included seats." }, { status: 403 });
  }

  const { member_user_id } = await request.json();
  if (!member_user_id) return NextResponse.json({ message: "member_user_id is required." }, { status: 422 });

  const member = await prisma.user.findUnique({ where: { id: parseInt(member_user_id, 10) } });
  if (!member) return NextResponse.json({ message: "Member not found." }, { status: 404 });
  const team = member.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
  if (!team || team.ownerId !== user.id) return NextResponse.json({ message: "Access denied." }, { status: 403 });

  try {
    const sub = await assignIncludedSeat(user.id, member);
    return NextResponse.json({ message: "Seat assigned successfully.", subscription: sub });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
