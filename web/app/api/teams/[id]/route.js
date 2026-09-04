import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest, hashPassword } from "@/lib/auth";
import { supabaseSetPassword } from "@/lib/supabaseAuth";
import { serializeTeamMember, resolveOwnedMember } from "@/lib/teamMembers";

export const dynamic = "force-dynamic";

// PUT /api/teams/:id — update a team member's name/email/phone/password.
export async function PUT(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const id = parseInt(params.id, 10);
  const { member, error, status } = await resolveOwnedMember(user, id);
  if (error) return NextResponse.json({ message: error }, { status });

  const body = await request.json();
  const data = {};
  if (body.name) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.email) {
    const normalizedEmail = String(body.email).toLowerCase();
    const clash = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" }, id: { not: id } },
    });
    if (clash) return NextResponse.json({ message: "An account with this email already exists." }, { status: 422 });
    data.email = normalizedEmail;
  }
  if (body.password) {
    if (String(body.password).length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 422 });
    }
    data.password = await hashPassword(body.password);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  if (body.password && updated.supabaseId) {
    await supabaseSetPassword(updated.supabaseId, body.password);
  }

  const sub = await prisma.subscription.findUnique({ where: { userId: id } });
  return NextResponse.json(serializeTeamMember(updated, sub));
}

// DELETE /api/teams/:id
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const id = parseInt(params.id, 10);
  const { error, status } = await resolveOwnedMember(user, id);
  if (error) return NextResponse.json({ message: error }, { status });

  await prisma.subscription.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "Team member deleted successfully" });
}
