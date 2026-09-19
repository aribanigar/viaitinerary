import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const num = (v) => (v == null ? 0 : Number(v));
const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));
const monthEnd = (y, m) => new Date(Date.UTC(y, m + 1, 1));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GET /api/super-admin/dashboard — platform-wide analytics.
//
// This route used to take 6 sequential round-trips to the DB (each stage
// awaited before the next could start), with one stage alone firing 18
// separate per-month count queries (3 queries x 6 months) — on a pooled
// connection with a low connection_limit, that fan-out queued up and made
// the dashboard take ages to load. Everything below is independent of
// everything else (nothing here actually needs another query's result), so
// it all fires as a single Promise.all batch, and the 18 per-month counts
// are collapsed into 3 grouped queries (one per metric, all 6 months at
// once) via date_trunc.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStartCur = monthStart(y, m);
  const monthEndCur = monthEnd(y, m);
  const trialWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const gm = m - i;
    const gy = y + Math.floor(gm / 12);
    const gmonth = ((gm % 12) + 12) % 12;
    months.push({ key: `${gy}-${gmonth}`, label: `${MONTHS[gmonth]} ${gy}`, start: monthStart(gy, gmonth) });
  }
  const growthRangeStart = months[0].start;
  const growthRangeEnd = monthEndCur;
  const monthKey = (d) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
  };

  const [
    totalAdmins,
    totalTeams,
    totalTrips,
    activeTeams,
    plans,
    newAdminsThisMonth,
    tripsThisMonth,
    platformRevenueAgg,
    subscriptionsAdmin,
    trialsExpiringSoonRows,
    totalInquiries,
    pipelineAgg,
    inquiryGroups,
    totalDemos,
    pendingDemos,
    recentDemos,
    recentAdmins,
    adminsByMonth,
    tripsByMonth,
    inquiriesByMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "admin" } }),
    prisma.team.count(),
    prisma.trip.count({ where: { isPackage: false } }),
    prisma.team.count({ where: { isActive: true } }),
    prisma.plan.findMany(),
    prisma.user.count({ where: { role: "admin", createdAt: { gte: monthStartCur, lt: monthEndCur } } }),
    prisma.trip.count({ where: { isPackage: false, createdAt: { gte: monthStartCur, lt: monthEndCur } } }),
    prisma.trip.aggregate({ where: { isPackage: false }, _sum: { paidAmount: true } }),
    prisma.$queryRaw`
      SELECT s.plan_key AS "planKey", s.status, s.ends_at AS "endsAt"
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE u.role = 'admin'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE u.role = 'admin' AND s.plan_key = 'trial' AND s.status = 'trialing'
        AND s.trial_ends_at >= ${now} AND s.trial_ends_at <= ${trialWindowEnd}
    `,
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
    prisma.user.findMany({
      where: { role: "admin" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }),
    prisma.$queryRaw`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS count
      FROM users
      WHERE role = 'admin' AND created_at >= ${growthRangeStart} AND created_at < ${growthRangeEnd}
      GROUP BY 1
    `,
    prisma.$queryRaw`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS count
      FROM trips
      WHERE is_package = false AND created_at >= ${growthRangeStart} AND created_at < ${growthRangeEnd}
      GROUP BY 1
    `,
    prisma.$queryRaw`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS count
      FROM trip_inquiries
      WHERE created_at >= ${growthRangeStart} AND created_at < ${growthRangeEnd}
      GROUP BY 1
    `,
  ]);

  const planByKey = new Map(plans.map((p) => [p.key, p]));

  const planBreakdown = {
    trial: subscriptionsAdmin.filter((s) => s.planKey === "trial").length,
    monthly: subscriptionsAdmin.filter((s) => s.planKey === "monthly").length,
    six_months: subscriptionsAdmin.filter((s) => s.planKey === "six_months").length,
    yearly: subscriptionsAdmin.filter((s) => s.planKey === "yearly").length,
  };

  const activePaid = subscriptionsAdmin.filter((s) => s.status === "active" && s.endsAt && new Date(s.endsAt) > now);
  let mrr = 0;
  for (const sub of activePaid) {
    const plan = planByKey.get(sub.planKey);
    const price = plan ? num(plan.price) : 0;
    const durationMo = Math.max(plan ? Number(plan.durationMonths || 1) : 1, 1);
    mrr += price / durationMo;
  }
  mrr = Math.round(mrr);
  const arr = mrr * 12;
  const trialsExpiringSoon = trialsExpiringSoonRows[0]?.count ?? 0;

  const rawByStatus = new Map(inquiryGroups.map((g) => [g.status, g._count._all]));
  const inquiryByStatus = {};
  for (const s of ["new", "contacted", "quoted", "converted", "closed"]) {
    inquiryByStatus[s] = rawByStatus.get(s) || 0;
  }

  const adminsByMonthMap = new Map(adminsByMonth.map((r) => [monthKey(r.month), r.count]));
  const tripsByMonthMap = new Map(tripsByMonth.map((r) => [monthKey(r.month), r.count]));
  const inquiriesByMonthMap = new Map(inquiriesByMonth.map((r) => [monthKey(r.month), r.count]));
  const growth = months.map(({ key, label }) => ({
    month: label,
    admins: adminsByMonthMap.get(key) || 0,
    trips: tripsByMonthMap.get(key) || 0,
    inquiries: inquiriesByMonthMap.get(key) || 0,
  }));

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
