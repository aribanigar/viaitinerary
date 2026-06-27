import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { resolveCountry } from "@/lib/subscription";
import { razorpayConfigured, razorpayKey, createRazorpayOrder } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

async function authorizedMember(request, caller) {
  const { member_user_id } = await request.clone().json().catch(() => ({}));
  if (!member_user_id) return null;
  if (caller.role !== "admin") return { error: NextResponse.json({ message: "Only admins can manage team member subscriptions." }, { status: 403 }) };
  const member = await prisma.user.findUnique({ where: { id: parseInt(member_user_id, 10) } });
  if (!member) return { error: NextResponse.json({ message: "Member not found." }, { status: 404 }) };
  const team = member.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
  if (!team || team.ownerId !== caller.id) return { error: NextResponse.json({ message: "Access denied." }, { status: 403 }) };
  return { member };
}

// POST /api/razorpay/create-order { plan, member_user_id?, country? }
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payment gateway is not configured. Please contact support." }, { status: 503 });
  }

  const body = await request.json();
  const plan = body.plan;
  if (!plan) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  let memberId = null;
  if (body.member_user_id) {
    if (user.role !== "admin") return NextResponse.json({ message: "Only admins can manage team member subscriptions." }, { status: 403 });
    const member = await prisma.user.findUnique({ where: { id: parseInt(body.member_user_id, 10) } });
    const team = member?.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
    if (!member || !team || team.ownerId !== user.id) return NextResponse.json({ message: "Access denied." }, { status: 403 });
    memberId = member.id;
  }

  const country = body.country ? body.country.trim().toUpperCase() : resolveCountry(request);

  const where = { key: plan, isActive: true };
  if (country) where.OR = [{ country }, { country: null }];
  let candidates = await prisma.plan.findMany({ where });
  if (country) candidates.sort((a, b) => (a.country === country ? 0 : 1) - (b.country === country ? 0 : 1));
  const planConfig = candidates[0];
  if (!planConfig) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  const amountPaise = Math.round(Number(planConfig.price || 0) * 100);
  if (amountPaise < 100) return NextResponse.json({ error: "Invalid amount. Minimum order is ₹1." }, { status: 400 });

  try {
    const order = await createRazorpayOrder({
      amountPaise,
      currency: "INR",
      notes: { plan: String(plan), country: String(country ?? ""), member_user_id: String(memberId ?? ""), user_id: String(user.id) },
    });
    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: razorpayKey(),
      plan,
      country,
      member_user_id: memberId,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Razorpay order failed" }, { status: err.status || 500 });
  }
}
