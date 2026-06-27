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

  console.log(`Seeded super admin.\n  email:    ${ADMIN_EMAIL}\n  password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
