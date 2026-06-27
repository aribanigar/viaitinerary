import prisma from "@/lib/prisma";

// --- status helpers (mirror App\Models\Subscription) ---
export const isTrial = (s) => !!s && s.planKey === "trial" && s.status === "trialing";
export const isPending = (s) => !!s && s.status === "pending";

export function isExpired(s) {
  if (!s) return false;
  const now = new Date();
  if (s.status === "trialing") return !!s.trialEndsAt && now > new Date(s.trialEndsAt);
  if (s.status === "active") return s.endsAt !== null && now > new Date(s.endsAt);
  return false;
}
export const isActive = (s) => !!s && ["trialing", "active"].includes(s.status) && !isExpired(s);

export function getSubscriptionForUser(userId) {
  return prisma.subscription.findUnique({ where: { userId } });
}

/** Create a fresh trial subscription for a new admin (idempotent). */
export async function initializeTrial(userId) {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  const trialPlan = await prisma.plan.findFirst({ where: { key: "trial" } });
  const durationDays = trialPlan?.durationMonths ?? 3;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);
  return prisma.subscription.create({
    data: {
      userId,
      planKey: "trial",
      status: "trialing",
      startsAt: new Date(),
      trialEndsAt,
      tripLimit: trialPlan?.tripLimit ?? 3,
      tripsUsed: 0,
    },
  });
}

/** Upgrade (or create) a user's subscription to a paid plan. */
export async function upgradeUserToPlan(userId, planKey, paymentId = null) {
  const plan = await prisma.plan.findFirst({ where: { key: planKey } });
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + (plan?.durationMonths ?? 1));

  const data = {
    planKey,
    paidAmount: plan ? plan.price : 0,
    razorpayPaymentId: paymentId,
    status: "active",
    startsAt: new Date(),
    endsAt,
    trialEndsAt: null,
    tripLimit: plan ? plan.tripLimit : null,
  };

  const sub = await prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data, tripsUsed: 0 },
  });
  await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
  return sub;
}

/** Given any user, resolve the admin User id (mirrors getAdminId). */
export async function resolveAdminId(user) {
  if (user.role === "team" && user.teamId) {
    const team = await prisma.team.findUnique({ where: { id: user.teamId } });
    return team?.ownerId ?? user.id;
  }
  return user.id;
}

/** May this admin context create a trip? Returns {allowed, reason, status}. */
export async function canCreateTrip(user) {
  const adminId = await resolveAdminId(user);
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin) return { allowed: false, reason: "Cannot resolve admin.", status: 403 };
  if (admin.bypassSubscription) return { allowed: true, status: 200 };

  const sub = await prisma.subscription.findUnique({ where: { userId: adminId } });
  if (!sub || isPending(sub)) return { allowed: false, reason: "Subscription record not found.", status: 403 };

  if (isTrial(sub)) {
    if (isExpired(sub)) return { allowed: false, reason: "Trial has expired. Please upgrade.", status: 402 };
    if (sub.tripsUsed >= (sub.tripLimit ?? 3))
      return { allowed: false, reason: "Trial limit reached. Upgrade to create more trips.", status: 402 };
  }
  if (!isTrial(sub) && isExpired(sub))
    return { allowed: false, reason: "Your subscription has expired. Please renew.", status: 402 };

  return { allowed: true, status: 200 };
}

export async function incrementTripsUsed(adminId) {
  await prisma.subscription.updateMany({ where: { userId: adminId }, data: { tripsUsed: { increment: 1 } } });
}

// --- plans / offers ---
export function resolveCountry(request) {
  const url = new URL(request.url);
  const c = url.searchParams.get("country") || request.headers.get("x-country-code");
  return c ? c.trim().toUpperCase() : null;
}

export function serializePlan(p) {
  return {
    id: p.id,
    key: p.key,
    country: p.country,
    name: p.name,
    price: Number(p.price),
    original_price: p.originalPrice == null ? null : Number(p.originalPrice),
    duration_months: p.durationMonths,
    trip_limit: p.tripLimit,
    features: p.features ?? [],
    badge_label: p.badgeLabel,
    recommended: p.recommended,
    is_active: p.isActive,
    is_offer: p.isOffer,
    offer_image: p.offerImage,
    offer_starts_at: p.offerStartsAt,
    offer_expires_at: p.offerExpiresAt,
    team_member_limit: p.teamMemberLimit,
  };
}

/** Active plans (excluding trial), country-preferred, keyed by plan key. */
export async function getActivePlans(country = null) {
  const where = { isActive: true, key: { not: "trial" } };
  if (country) where.OR = [{ country }, { country: null }];
  let plans = await prisma.plan.findMany({ where, orderBy: { price: "asc" } });
  if (country) {
    const seen = new Set();
    plans = plans
      .sort((a, b) => (a.country === country ? 0 : 1) - (b.country === country ? 0 : 1))
      .filter((p) => (seen.has(p.key) ? false : seen.add(p.key)));
  }
  const out = {};
  for (const p of plans) out[p.key] = serializePlan(p);
  return out;
}

/** The current live offer plan (if any), country-preferred. */
export async function getActiveOffer(country = null) {
  const now = new Date();
  const where = {
    isActive: true,
    isOffer: true,
    AND: [
      { OR: [{ offerStartsAt: null }, { offerStartsAt: { lte: now } }] },
      { OR: [{ offerExpiresAt: null }, { offerExpiresAt: { gt: now } }] },
    ],
  };
  if (country) where.OR = [{ country }, { country: null }];
  const plans = await prisma.plan.findMany({ where });
  if (!plans.length) return null;
  plans.sort((a, b) => (a.country === country ? 0 : 1) - (b.country === country ? 0 : 1));
  return serializePlan(plans[0]);
}

/** Assign an included team-member seat from an admin's paid plan. */
export async function assignIncludedSeat(adminId, member) {
  if (!member.teamId) throw new Error("Team member not found or access denied.");
  const team = await prisma.team.findUnique({ where: { id: member.teamId } });
  if (!team || team.ownerId !== adminId) throw new Error("Team member not found or access denied.");

  const adminSub = await prisma.subscription.findUnique({ where: { userId: adminId } });
  if (!adminSub || !isActive(adminSub)) throw new Error("Admin subscription not active.");

  const planKey = adminSub.planKey;
  const plan = await prisma.plan.findFirst({ where: { key: planKey } });
  const limit = plan ? Number(plan.teamMemberLimit || 0) : 0;
  if (limit <= 0) throw new Error("This plan does not include additional team members.");

  // Count active members on the same plan under this admin's teams.
  const teams = await prisma.team.findMany({ where: { ownerId: adminId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);
  const members = await prisma.user.findMany({ where: { teamId: { in: teamIds } }, select: { id: true } });
  const subs = await prisma.subscription.findMany({ where: { userId: { in: members.map((m) => m.id) } } });
  const assigned = subs.filter((s) => s.status === "active" && s.planKey === planKey && !isExpired(s)).length;
  if (assigned >= limit) throw new Error("No included seats available.");

  const memberSub = await prisma.subscription.findUnique({ where: { userId: member.id } });
  if (memberSub && memberSub.status === "active" && memberSub.planKey === planKey && !isExpired(memberSub)) {
    return memberSub;
  }

  const data = {
    planKey,
    paidAmount: 0,
    razorpayPaymentId: null,
    status: "active",
    startsAt: new Date(),
    endsAt: adminSub.endsAt,
    trialEndsAt: null,
    tripLimit: adminSub.tripLimit,
  };
  const sub = await prisma.subscription.upsert({
    where: { userId: member.id },
    update: data,
    create: { userId: member.id, ...data, tripsUsed: 0 },
  });
  await prisma.user.update({ where: { id: member.id }, data: { status: "active" } });
  return sub;
}
