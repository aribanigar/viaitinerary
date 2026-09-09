import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest, hashPassword } from "@/lib/auth";
import { provisionSupabaseUser } from "@/lib/supabaseAuth";
import { serializeTeamMember } from "@/lib/teamMembers";

export const dynamic = "force-dynamic";

// GET /api/teams — the caller's own team members (role: "team" users on
// their team). A "team" in this feature is a User row, not the Team table.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (!["admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ message: "Only admins can manage team members." }, { status: 403 });
  }

  const team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) return NextResponse.json([]);

  const members = await prisma.user.findMany({
    where: { teamId: team.id, role: "team" },
    orderBy: { createdAt: "desc" },
  });
  const subs = members.length
    ? await prisma.subscription.findMany({ where: { userId: { in: members.map((m) => m.id) } } })
    : [];
  const subByUser = new Map(subs.map((s) => [s.userId, s]));

  return NextResponse.json(members.map((m) => serializeTeamMember(m, subByUser.get(m.id) || null)));
}

// POST /api/teams — invite a new team member.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (!["admin", "super_admin"].includes(user.role)) {
    return NextResponse.json({ message: "Only admins can manage team members." }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password, phone } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ message: "Name, email and password are required." }, { status: 422 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 422 });
  }

  const normalizedEmail = String(email).toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
  }

  let team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) {
    team = await prisma.team.create({ data: { name: `${user.name}'s agency`, ownerId: user.id } });
  }

  let supabaseId;
  try {
    supabaseId = await provisionSupabaseUser(normalizedEmail, password);
  } catch (err) {
    return NextResponse.json({ message: err.message || "Could not create the account with the auth provider." }, { status: 502 });
  }

  const member = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: await hashPassword(password),
      phone: phone || null,
      supabaseId,
      role: "team",
      status: "active",
      teamId: team.id,
    },
  });

  return NextResponse.json(serializeTeamMember(member, null), { status: 201 });
}
