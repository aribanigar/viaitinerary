import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { initializeTrial } from "@/lib/subscription";
import { businessAggregates, businessRow } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

function slugify(s) {
  return String(s || "team")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// GET /api/super-admin/businesses — paginated admin accounts with usage stats.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const { searchParams } = new URL(request.url);
  const perPage = Math.min(Math.max(1, parseInt(searchParams.get("per_page") || "25", 10)), 500);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const search = (searchParams.get("search") || "").trim();
  const returnAll = searchParams.get("all") === "1" || searchParams.get("all") === "true";

  const where = { role: "admin" };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const total = await prisma.user.count({ where });
  const admins = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(returnAll ? {} : { skip: (page - 1) * perPage, take: perPage }),
  });

  const adminIds = admins.map((a) => a.id);
  const [subs, agencies, agg] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: { in: adminIds } } }),
    prisma.agencySetting.findMany({ where: { userId: { in: adminIds } } }),
    businessAggregates(adminIds),
  ]);
  const subById = new Map(subs.map((s) => [s.userId, s]));
  const agencyById = new Map(agencies.map((a) => [a.userId, a]));

  const businesses = admins.map((admin) =>
    businessRow(admin, {
      sub: subById.get(admin.id) || null,
      agency: agencyById.get(admin.id) || null,
      tripsCount: agg.tripsCount.get(admin.id) || 0,
      revenue: agg.revenue.get(admin.id) || 0,
      memberCount: agg.memberCount.get(admin.id) || 0,
    })
  );

  const lastPage = returnAll ? 1 : Math.max(1, Math.ceil(total / perPage));
  const count = returnAll ? businesses.length : total;
  const from = count ? (returnAll ? 1 : (page - 1) * perPage + 1) : 0;
  const to = returnAll ? businesses.length : Math.min(page * perPage, total);

  return NextResponse.json({
    businesses,
    pagination: {
      current_page: returnAll ? 1 : page,
      last_page: lastPage,
      per_page: returnAll ? businesses.length : perPage,
      total: count,
      from,
      to,
    },
  });
}

// POST /api/super-admin/businesses — create a new admin (business) account.
export async function POST(request) {
  const { user: actor, error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const b = await request.json();
  if (!b.name) return NextResponse.json({ errors: { name: ["The name field is required."] } }, { status: 422 });
  if (!b.email) return NextResponse.json({ errors: { email: ["The email field is required."] } }, { status: 422 });
  if (!b.password || String(b.password).length < 8) {
    return NextResponse.json({ errors: { password: ["The password must be at least 8 characters."] } }, { status: 422 });
  }

  const existing = await prisma.user.findFirst({ where: { email: { equals: String(b.email), mode: "insensitive" } } });
  if (existing) {
    return NextResponse.json({ errors: { email: ["The email has already been taken."] } }, { status: 422 });
  }

  const user = await prisma.user.create({
    data: {
      name: b.name,
      email: String(b.email).toLowerCase(),
      password: await hashPassword(b.password),
      role: "admin",
      status: "active",
      emailVerifiedAt: new Date(),
    },
  });

  // Mirror signup: every admin owns a team and is a member of it.
  let slug = slugify(`${b.name} agency`) || slugify(String(b.email).split("@")[0]);
  if (await prisma.team.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const team = await prisma.team.create({ data: { name: `${b.name} Travels`, slug, ownerId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });

  await initializeTrial(user.id);
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

  return NextResponse.json(
    {
      message: "Business created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        created_at: user.createdAt,
        team_members_count: 0,
        trips_count: 0,
        plan: {
          plan_name: "trial",
          is_trial: true,
          is_expired: false,
          expires_at: sub?.trialEndsAt ? new Date(sub.trialEndsAt).toISOString() : null,
        },
      },
    },
    { status: 201 }
  );
}
