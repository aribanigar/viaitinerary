import { PrismaClient } from "@prisma/client";

// One PrismaClient per process — cached on globalThis in every environment,
// not just dev: a warm serverless instance can load this module through more
// than one route bundle, and each fresh client opens its own pool and pays
// its own engine start-up.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma._prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma._prisma = prisma;

export default prisma;
