import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { assignIncludedSeat } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// POST /api/super-admin/businesses/:id/assign-member { member_user_id }
export async function POST(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const business = await prisma.user.findUnique({ where: { id } });
  if (!business || business.role !== "admin") {
    return NextResponse.json({ message: "Not a valid business account" }, { status: 404 });
  }

  const b = await request.json();
  if (!b.member_user_id) return NextResponse.json({ message: "member_user_id is required." }, { status: 422 });

  const member = await prisma.user.findUnique({ where: { id: parseInt(b.member_user_id, 10) } });
  if (!member) return NextResponse.json({ message: "Member not found." }, { status: 404 });

  const team = member.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
  if (!team || team.ownerId !== business.id) {
    return NextResponse.json({ message: "Member does not belong to this business." }, { status: 403 });
  }

  try {
    const sub = await assignIncludedSeat(business.id, member);
    return NextResponse.json({ message: "Seat assigned successfully.", subscription: sub });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 400 });
  }
}
