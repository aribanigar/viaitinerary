import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ONE-TIME, token-gated diagnostic: reports the actual current state of the
// viakashmir.in@gmail.com account (role, status, whether Admin@123 verifies
// against the stored hash right now) — no login attempt, no ambiguity about
// what's actually in the database vs. what's being typed. Delete once done.
const TARGET_EMAIL = "viakashmir.in@gmail.com";
const CHECK_PASSWORD = "Admin@123";

async function handle(request) {
  const requiredToken = process.env.SETUP_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ message: "Setup is disabled (SETUP_TOKEN not configured)." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const suppliedToken = searchParams.get("token") || request.headers.get("x-setup-token");
  if (suppliedToken !== requiredToken) {
    return NextResponse.json({ message: "Invalid or missing setup token." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
  });
  if (!user) {
    return NextResponse.json({ message: `No account found for ${TARGET_EMAIL}.` }, { status: 404 });
  }

  const passwordMatches = await verifyPassword(CHECK_PASSWORD, user.password);

  return NextResponse.json({
    email: user.email,
    id: user.id,
    role: user.role,
    status: user.status,
    has_password_hash: Boolean(user.password),
    password_hash_prefix: user.password ? user.password.slice(0, 7) : null,
    admin123_matches: passwordMatches,
  });
}

export const GET = handle;
export const POST = handle;
