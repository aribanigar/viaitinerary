import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { mailerForAdminId, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/settings/smtp/test — send a test email using the agency's SMTP.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const b = await request.json().catch(() => ({}));
  const testEmail = b.testEmail || b.test_email;
  if (!testEmail || !EMAIL_RE.test(testEmail)) {
    return NextResponse.json({ message: "A valid testEmail is required." }, { status: 422 });
  }

  const { mailer } = await mailerForAdminId(adminId);
  if (!mailer) return NextResponse.json({ message: "SMTP credentials are not configured." }, { status: 422 });

  try {
    await sendMail(mailer, {
      to: testEmail,
      subject: "SMTP Test Email",
      text: "This is a test email sent from your SMTP settings.",
    });
    return NextResponse.json({ message: "Test email sent successfully." });
  } catch (err) {
    return NextResponse.json({ message: `Failed to send test email: ${err.message}` }, { status: 502 });
  }
}
