import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { isTrial, isExpired, isActive } from "@/lib/subscription";
import { planInfo } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

const num = (v) => (v == null ? 0 : Number(v));

// GET /api/super-admin/businesses/:id — full business detail + seat summary.
export async function GET(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "admin") {
    return NextResponse.json({ message: "Not a valid business account" }, { status: 404 });
  }

  const [subscription, teams, tripAgg, recentTrips] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: id } }),
    prisma.team.findMany({ where: { ownerId: id }, select: { id: true } }),
    prisma.trip.aggregate({ where: { userId: id, isPackage: false }, _count: { _all: true }, _sum: { paidAmount: true } }),
    prisma.trip.findMany({
      where: { userId: id, isPackage: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, tripTitle: true, destination: true, createdAt: true, status: true, paidAmount: true },
    }),
  ]);

  const teamIds = teams.map((t) => t.id);
  const memberUsers = teamIds.length
    ? await prisma.user.findMany({
        where: { teamId: { in: teamIds }, id: { not: id } },
        select: { id: true, name: true, email: true, status: true, profilePicture: true, teamId: true },
      })
    : [];
  const memberSubs = memberUsers.length
    ? await prisma.subscription.findMany({ where: { userId: { in: memberUsers.map((m) => m.id) } } })
    : [];
  const subByUser = new Map(memberSubs.map((s) => [s.userId, s]));

  const teamMembers = memberUsers.map((m) => {
    const ms = subByUser.get(m.id) || null;
    return {
      id: m.id,
      user_id: m.id,
      name: m.name,
      email: m.email,
      status: m.status,
      job_title: null,
      image_url: m.profilePicture || null,
      is_paid: !!(ms && ms.status === "active" && !isTrial(ms) && !isExpired(ms)),
      subscription: ms
        ? { plan_key: ms.planKey, status: ms.status, is_trial: isTrial(ms), is_expired: isExpired(ms) }
        : null,
    };
  });

  let teamMemberLimit = 0;
  let assignedSeats = 0;
  let availableSeats = 0;
  let reason = null;

  if (subscription && isActive(subscription)) {
    const plan = await prisma.plan.findFirst({ where: { key: subscription.planKey } });
    teamMemberLimit = plan ? Number(plan.teamMemberLimit || 0) : 0;
    assignedSeats = teamMembers.filter(
      (tm) => tm.subscription && tm.subscription.status === "active" && tm.subscription.plan_key === subscription.planKey && !tm.subscription.is_expired
    ).length;
    availableSeats = Math.max(0, teamMemberLimit - assignedSeats);
    if (teamMemberLimit <= 0) reason = "Current plan does not include additional team seats.";
    else if (availableSeats <= 0) reason = "No included seats available on this plan.";
  } else {
    reason = "Business does not have an active subscription plan.";
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    created_at: user.createdAt,
    bypass_subscription: !!user.bypassSubscription,
    team_members_count: teamMembers.length,
    trips_count: tripAgg._count._all,
    total_revenue: num(tripAgg._sum.paidAmount),
    plan: planInfo(subscription, { team_member_limit: teamMemberLimit }),
    seat_summary: {
      team_member_limit: teamMemberLimit,
      assigned_count: assignedSeats,
      available_count: availableSeats,
      can_assign: !!(subscription && isActive(subscription) && teamMemberLimit > 0 && availableSeats > 0),
      reason,
    },
    recent_trips: recentTrips.map((t) => ({
      id: t.id,
      trip_title: t.tripTitle,
      destination: t.destination,
      created_at: t.createdAt,
      status: t.status,
      paid_amount: num(t.paidAmount),
    })),
    team_members: teamMembers,
  });
}

// PUT /api/super-admin/businesses/:id — update name/email/password.
export async function PUT(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json();
  if (!b.name) return NextResponse.json({ errors: { name: ["The name field is required."] } }, { status: 422 });
  if (!b.email) return NextResponse.json({ errors: { email: ["The email field is required."] } }, { status: 422 });

  const clash = await prisma.user.findFirst({
    where: { email: { equals: String(b.email), mode: "insensitive" }, id: { not: id } },
  });
  if (clash) return NextResponse.json({ errors: { email: ["The email has already been taken."] } }, { status: 422 });

  const data = { name: b.name, email: String(b.email).toLowerCase() };
  if (b.password) {
    if (String(b.password).length < 8) {
      return NextResponse.json({ errors: { password: ["The password must be at least 8 characters."] } }, { status: 422 });
    }
    data.password = await hashPassword(b.password);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({
    message: "Business updated successfully",
    user: { id: updated.id, name: updated.name, email: updated.email },
  });
}

// DELETE /api/super-admin/businesses/:id
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (user.role === "super_admin") {
    return NextResponse.json({ message: "Cannot delete super admin" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "Business deleted successfully" });
}
