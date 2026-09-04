import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ONE-TIME, token-gated: promotes a specific existing account to super_admin
// without touching its password (unlike /api/setup, which resets the
// password too — not appropriate for an account that already logs in fine).
// Delete this route once the promotion is confirmed.
const TARGET_EMAIL = "viakashmir.in@gmail.com";

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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "super_admin", status: "active" },
  });

  return NextResponse.json({
    message: `${updated.email} is now super_admin.`,
    id: updated.id,
    email: updated.email,
    role: updated.role,
  });
}

export const GET = handle;
export const POST = handle;
