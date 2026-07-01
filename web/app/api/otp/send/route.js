import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { issueCode, otpEmailHtml } from "@/lib/otp";
import { mailerForAdminId, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/otp/send { email } — email a verification code (signup).
export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ message: "A valid email is required." }, { status: 422 });
  }

  // If the email belongs to an agency, use its SMTP; otherwise the platform SMTP.
  const existing = await prisma.user.findFirst({ where: { email: { equals: String(email), mode: "insensitive" } } });
  const { mailer } = await mailerForAdminId(existing?.id ?? null);
  if (!mailer) {
    return NextResponse.json({ message: "Email sending is not configured yet." }, { status: 503 });
  }

  const code = await issueCode(email, "signup");
  try {
    await sendMail(mailer, {
      to: email,
      subject: "Your ViaItinerary verification code",
      html: otpEmailHtml(code, "signup"),
      text: `Your verification code is ${code} (valid for 10 minutes).`,
    });
  } catch (e) {
    return NextResponse.json({ message: `Failed to send code: ${e.message}` }, { status: 502 });
  }
  return NextResponse.json({ message: "Verification code sent to your email." });
}
