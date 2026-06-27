import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/settings/smtp/test — sends a test email.
// Email delivery is implemented in the email phase of the port; this endpoint
// exists so the Settings UI works, and reports that status clearly.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json(
    { message: "Email sending is being migrated; SMTP test will be enabled in the email phase." },
    { status: 501 }
  );
}
