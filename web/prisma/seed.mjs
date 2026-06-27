/**
 * Seed the super admin so you can log in immediately.
 *   npm run seed
 * Login:  viakashmir.in@gmail.com  /  password
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "viakashmir.in@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let user = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, role: "super_admin", status: "active" },
    });
  } else {
    user = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: ADMIN_EMAIL,
        password: passwordHash,
        role: "super_admin",
        status: "active",
      },
    });
  }

  let team = await prisma.team.findFirst({ where: { ownerId: user.id } });
  if (!team) {
    team = await prisma.team.create({
      data: { name: "ViaItinerary", slug: "viaitinerary", ownerId: user.id },
    });
    await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });
  }

  // Default subscription plans (from the original config/plans.php).
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

  // Give the admin an active trial subscription.
  const existingSub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!existingSub) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);
    await prisma.subscription.create({
      data: { userId: user.id, planKey: "trial", status: "trialing", startsAt: new Date(), trialEndsAt, tripLimit: 3, tripsUsed: 0 },
    });
  }

  console.log(`Seeded super admin + ${plans.length} plans.\n  email:    ${ADMIN_EMAIL}\n  password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
