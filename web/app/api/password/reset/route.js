import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCode } from "@/lib/otp";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/password/reset { email, otp, password } — verify code, set new password.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const email = b.email;
  const otp = b.otp ?? b.code;
  const password = b.password ?? b.new_password;

  if (!email || !otp || !password) {
    return NextResponse.json({ message: "Email, code and new password are required." }, { status: 422 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 422 });
  }
  if (b.password_confirmation !== undefined && b.password_confirmation !== password) {
    return NextResponse.json({ message: "Passwords do not match." }, { status: 422 });
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: String(email), mode: "insensitive" } } });
  if (!user) return NextResponse.json({ message: "Invalid code or email." }, { status: 422 });

  const ok = await verifyCode(email, otp, "reset");
  if (!ok) return NextResponse.json({ message: "Invalid or expired code." }, { status: 422 });

  await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
  return NextResponse.json({ message: "Password reset successfully. You can now log in." });
}
