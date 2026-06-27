import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { upgradeUserToPlan } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// POST /api/razorpay/verify-payment
// { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, member_user_id? }
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const body = await request.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, member_user_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    return NextResponse.json({ success: false, error: "Missing payment fields." }, { status: 422 });
  }

  const ok = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!ok) {
    return NextResponse.json({ success: false, error: "Signature verification failed." }, { status: 400 });
  }

  // Resolve target (member or self) with ownership checks.
  let targetId = user.id;
  if (member_user_id) {
    if (user.role !== "admin") return NextResponse.json({ message: "Only admins can manage team member subscriptions." }, { status: 403 });
    const member = await prisma.user.findUnique({ where: { id: parseInt(member_user_id, 10) } });
    const team = member?.teamId ? await prisma.team.findUnique({ where: { id: member.teamId } }) : null;
    if (!member || !team || team.ownerId !== user.id) return NextResponse.json({ message: "Access denied." }, { status: 403 });
    targetId = member.id;
  }

  await upgradeUserToPlan(targetId, plan, razorpay_payment_id);
  return NextResponse.json({ success: true });
}
