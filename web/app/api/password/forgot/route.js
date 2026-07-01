import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { issueCode, otpEmailHtml } from "@/lib/otp";
import { mailerForAdminId, sendMail } from "@/lib/mailer";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/password/forgot { email } — email a reset code. Always 200 (no leak).
export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  if (!email) return NextResponse.json({ message: "Email is required." }, { status: 422 });

  const user = await prisma.user.findFirst({ where: { email: { equals: String(email), mode: "insensitive" } } });
  const generic = { message: "If that email exists, a reset code has been sent." };
  if (!user) return NextResponse.json(generic);

  const adminId = await adminIdOf(user);
  const { mailer } = await mailerForAdminId(adminId);
  if (!mailer) return NextResponse.json({ message: "Email sending is not configured yet." }, { status: 503 });

  const code = await issueCode(email, "reset");
  try {
    await sendMail(mailer, {
      to: email,
      subject: "Reset your ViaItinerary password",
      html: otpEmailHtml(code, "reset"),
      text: `Your password reset code is ${code} (valid for 10 minutes).`,
    });
  } catch (e) {
    return NextResponse.json({ message: `Failed to send reset code: ${e.message}` }, { status: 502 });
  }
  return NextResponse.json(generic);
}
