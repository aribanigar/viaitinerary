import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { isExpired } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const num = (v) => (v == null ? 0 : Number(v));
const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));
const monthEnd = (y, m) => new Date(Date.UTC(y, m + 1, 1));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GET /api/super-admin/dashboard — platform-wide analytics.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const [totalAdmins, totalTeams, totalTrips, activeTeams, adminUsers, plans] = await Promise.all([
    prisma.user.count({ where: { role: "admin" } }),
    prisma.team.count(),
    prisma.trip.count({ where: { isPackage: false } }),
    prisma.team.count({ where: { isActive: true } }),
    prisma.user.findMany({ where: { role: "admin" }, select: { id: true } }),
    prisma.plan.findMany(),
  ]);
  const adminIds = adminUsers.map((a) => a.id);
  const planByKey = new Map(plans.map((p) => [p.key, p]));

  const [newAdminsThisMonth, tripsThisMonth, subscriptions, platformRevenueAgg] = await Promise.all([
    prisma.user.count({ where: { role: "admin", createdAt: { gte: monthStart(y, m), lt: monthEnd(y, m) } } }),
    prisma.trip.count({ where: { isPackage: false, createdAt: { gte: monthStart(y, m), lt: monthEnd(y, m) } } }),
    prisma.subscription.findMany({ where: { userId: { in: adminIds } } }),
    prisma.trip.aggregate({ where: { isPackage: false }, _sum: { paidAmount: true } }),
  ]);

  const planBreakdown = {
    trial: subscriptions.filter((s) => s.planKey === "trial").length,
    monthly: subscriptions.filter((s) => s.planKey === "monthly").length,
    six_months: subscriptions.filter((s) => s.planKey === "six_months").length,
    yearly: subscriptions.filter((s) => s.planKey === "yearly").length,
  };

  const activePaid = subscriptions.filter((s) => s.status === "active" && s.endsAt && new Date(s.endsAt) > now);
  let mrr = 0;
  for (const sub of activePaid) {
    const plan = planByKey.get(sub.planKey);
    const price = plan ? num(plan.price) : 0;
    const durationMo = Math.max(plan ? Number(plan.durationMonths || 1) : 1, 1);
    mrr += price / durationMo;
  }
  mrr = Math.round(mrr);
  const arr = mrr * 12;

  const trialsExpiringSoon = await prisma.subscription.count({
    where: {
      userId: { in: adminIds },
      planKey: "trial",
      status: "trialing",
      trialEndsAt: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    },
  });

  const [totalInquiries, pipelineAgg, inquiryGroups, totalDemos, pendingDemos, recentDemos] = await Promise.all([
    prisma.leadInquiry.count(),
    prisma.leadInquiry.aggregate({ where: { approximateBudget: { not: null } }, _sum: { approximateBudget: true } }),
    prisma.leadInquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.demoRequest.count(),
    prisma.demoRequest.count({ where: { status: "pending" } }),
    prisma.demoRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, companyName: true, agencyType: true, noOfEmployees: true, status: true, createdAt: true },
    }),
  ]);

  const rawByStatus = new Map(inquiryGroups.map((g) => [g.status, g._count._all]));
  const inquiryByStatus = {};
  for (const s of ["new", "contacted", "quoted", "converted", "closed"]) {
    inquiryByStatus[s] = rawByStatus.get(s) || 0;
  }

  // 6-month growth.
  const growth = [];
  for (let i = 5; i >= 0; i--) {
    const gm = m - i;
    const gy = y + Math.floor(gm / 12);
    const gmonth = ((gm % 12) + 12) % 12;
    const start = monthStart(gy, gmonth);
    const end = monthEnd(gy, gmonth);
    const [admins, trips, inquiries] = await Promise.all([
      prisma.user.count({ where: { role: "admin", createdAt: { gte: start, lt: end } } }),
      prisma.trip.count({ where: { isPackage: false, createdAt: { gte: start, lt: end } } }),
      prisma.leadInquiry.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]);
    growth.push({ month: `${MONTHS[gmonth]} ${gy}`, admins, trips, inquiries });
  }

  const recentAdmins = await prisma.user.findMany({
    where: { role: "admin" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, email: true, status: true, createdAt: true },
  });
  const recentSubs = await prisma.subscription.findMany({ where: { userId: { in: recentAdmins.map((u) => u.id) } } });
  const recentSubByUser = new Map(recentSubs.map((s) => [s.userId, s]));
  const recentBusinesses = recentAdmins.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    plan: recentSubByUser.get(u.id)?.planKey ?? "none",
    created_at: u.createdAt,
  }));

  return NextResponse.json({
    total_admins: totalAdmins,
    total_teams: totalTeams,
    total_trips: totalTrips,
    active_teams: activeTeams,
    new_admins_this_month: newAdminsThisMonth,
    trips_this_month: tripsThisMonth,
    mrr,
    arr,
    total_revenue: num(platformRevenueAgg._sum.paidAmount),
    trials_expiring_soon: trialsExpiringSoon,
    plan_breakdown: planBreakdown,
    inquiries: {
      total: totalInquiries,
      pipeline_value: num(pipelineAgg._sum.approximateBudget),
      by_status: inquiryByStatus,
    },
    demos: {
      total: totalDemos,
      pending: pendingDemos,
      recent: recentDemos.map((d) => ({
        id: d.id,
        name: d.name,
        company_name: d.companyName,
        agency_type: d.agencyType,
        no_of_employees: d.noOfEmployees,
        status: d.status,
        created_at: d.createdAt,
      })),
    },
    growth,
    recent_businesses: recentBusinesses,
  });
}
