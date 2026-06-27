import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { upgradeUserToPlan } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// POST /api/subscription/upgrade { plan, member_user_id? }
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const { plan, member_user_id } = await request.json();

  if (!plan) return NextResponse.json({ message: "plan is required." }, { status: 422 });
  const planRow = await prisma.plan.findFirst({ where: { key: plan } });
  if (!planRow) return NextResponse.json({ message: "Invalid plan." }, { status: 422 });

  // Team member upgrade (admin acting on a member).
  if (member_user_id) {
    const member = await prisma.user.findUnique({ where: { id: parseInt(member_user_id, 10) } });
    const team = member?.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
    if (!member || !team || team.ownerId !== user.id) {
      return NextResponse.json({ message: "Team member not found or access denied." }, { status: 404 });
    }
    await upgradeUserToPlan(member.id, plan);
    return NextResponse.json({ message: "Team member subscribed successfully.", plan_name: plan, target_member: member.name });
  }

  // Admin self-upgrade.
  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ message: "Only admins can upgrade their own plan." }, { status: 403 });
  }
  await upgradeUserToPlan(user.id, plan);
  return NextResponse.json({ message: "Plan upgraded successfully.", plan_name: plan, total_cost: Number(planRow.price) });
}
