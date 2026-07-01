import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TEMPORARY one-time admin bootstrap. Just visit /api/setup in the browser.
// Creates (or resets the password of) the super-admin, plus default plans and a
// trial subscription. It only ever touches this one known admin account.
// DELETE this route once you can log in.
async function handle(request) {
  const email = (process.env.ADMIN_EMAIL || "viakashmir.in@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "password";
  const passwordHash = await hashPassword(password);

  // Upsert the super-admin (create, or reset password + role/status if present).
  let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const existed = !!user;
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, role: "super_admin", status: "active" },
    });
  } else {
    user = await prisma.user.create({
      data: { name: "Super Admin", email, password: passwordHash, role: "super_admin", status: "active" },
    });
  }

  // Ensure the admin owns a team.
  let team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) {
    team = await prisma.team.create({ data: { name: "ViaItinerary", slug: "viaitinerary", ownerId: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });
  }

  // Default plans.
  const plans = [
    { key: "trial", name: "Trial", price: 0, durationMonths: 3, tripLimit: 3, isActive: true },
    { key: "monthly", name: "Monthly", price: 999, durationMonths: 1, tripLimit: null, isActive: true },
    { key: "six_months", name: "6 Months", price: 5200, durationMonths: 6, tripLimit: null, isActive: true },
    { key: "yearly", name: "Yearly", price: 10000, durationMonths: 12, tripLimit: null, isActive: true },
  ];
  for (const p of plans) {
    const existing = await prisma.plan.findFirst({ where: { key: p.key, country: null } });
    if (existing) await prisma.plan.update({ where: { id: existing.id }, data: p });
    else await prisma.plan.create({ data: p });
  }

  // Active trial subscription.
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);
    await prisma.subscription.create({
      data: { userId: user.id, planKey: "trial", status: "trialing", startsAt: new Date(), trialEndsAt, tripLimit: 3, tripsUsed: 0 },
    });
  }

  return NextResponse.json({
    message: existed ? "Super-admin already existed — password reset." : "Super-admin created.",
    email,
    password,
    login_url: "/login",
    note: "Delete /api/setup and SETUP_TOKEN after logging in.",
  });
}

export const GET = handle;
export const POST = handle;
