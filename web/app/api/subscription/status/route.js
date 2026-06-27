import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import {
  resolveAdminId,
  resolveCountry,
  getActivePlans,
  getActiveOffer,
  getSubscriptionForUser,
  initializeTrial,
  isTrial,
  isExpired,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

// GET /api/subscription/status — optional auth (guests get plans + offer).
export async function GET(request) {
  const user = await userFromRequest(request);
  const country = resolveCountry(request);
  const offer = await getActiveOffer(country);

  if (!user) {
    return NextResponse.json({
      plan_name: "guest",
      active_offer: offer,
      available_plans: await getActivePlans(country),
      country,
    });
  }

  // Admin checking a specific member.
  const memberUserId = new URL(request.url).searchParams.get("member_user_id");
  if (memberUserId) {
    const member = await prisma.user.findUnique({ where: { id: parseInt(memberUserId, 10) } });
    if (!member) return NextResponse.json({ message: "Member not found." }, { status: 404 });
    const team = member.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
    if (!team || team.ownerId !== user.id) return NextResponse.json({ message: "Access denied." }, { status: 403 });
    const sub = await getSubscriptionForUser(member.id);
    return NextResponse.json({
      plan: sub
        ? { plan_name: sub.planKey, is_trial: isTrial(sub), is_expired: isExpired(sub), expires_at: isTrial(sub) ? sub.trialEndsAt : sub.endsAt }
        : null,
      plan_name: sub?.planKey ?? null,
      status: sub?.status ?? "pending",
      is_paid: !!sub && sub.status === "active" && !isExpired(sub),
      subscription_ends_at: sub?.endsAt ?? null,
      is_expired: sub ? isExpired(sub) : false,
      available_plans: await getActivePlans(country),
      target_member: { id: team.id, user_id: member.id, name: member.name, email: member.email },
      country,
    });
  }

  // Calling user's own (admin) subscription.
  const adminId = await resolveAdminId(user);
  const admin = (await prisma.user.findUnique({ where: { id: adminId } })) ?? user;
  let sub = await getSubscriptionForUser(adminId);
  if (!sub && (admin.role === "admin" || admin.role === "super_admin")) {
    sub = await initializeTrial(adminId);
  }

  const seatsNeeded = 1 + (await prisma.team.count({ where: { ownerId: adminId } }));

  if (!sub) {
    return NextResponse.json({
      plan_name: admin.bypassSubscription ? "enterprise" : "none",
      status: admin.bypassSubscription ? "active" : "inactive",
      is_paid: !!admin.bypassSubscription,
      can_create_trip: !!admin.bypassSubscription,
      is_trial_expired: false,
      seats_needed: seatsNeeded,
      available_plans: await getActivePlans(country),
      bypass_subscription: !!admin.bypassSubscription,
      active_offer: offer,
      country,
    });
  }

  const trialExpired = isTrial(sub) && isExpired(sub);
  let canCreate = true;
  if (admin.bypassSubscription) {
    canCreate = true;
  } else if (isTrial(sub)) {
    if (trialExpired || (sub.tripLimit !== null && sub.tripsUsed >= sub.tripLimit)) canCreate = false;
  } else if (isExpired(sub)) {
    canCreate = false;
  }

  return NextResponse.json({
    plan_name: sub.planKey,
    status: sub.status,
    is_paid: sub.status === "active" && !isExpired(sub),
    can_create_trip: canCreate,
    is_trial: isTrial(sub),
    is_trial_expired: trialExpired,
    trip_limit: sub.tripLimit,
    trips_used: sub.tripsUsed,
    trial_ends_at: sub.trialEndsAt,
    subscription_ends_at: sub.endsAt,
    seats_needed: seatsNeeded,
    available_plans: await getActivePlans(country),
    bypass_subscription: !!admin.bypassSubscription,
    active_offer: offer,
    country,
  });
}
