import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Create and store a hashed OTP for an email/purpose; returns the plain code. */
export async function issueCode(email, purpose = "signup") {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  // Invalidate any outstanding codes for this email+purpose.
  await prisma.otpCode.updateMany({
    where: { email: email.toLowerCase(), purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.otpCode.create({
    data: { email: email.toLowerCase(), purpose, codeHash, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return code;
}

/** Verify + consume a code. Returns true on success. */
export async function verifyCode(email, code, purpose = "signup") {
  const row = await prisma.otpCode.findFirst({
    where: { email: email.toLowerCase(), purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { id: "desc" },
  });
  if (!row) return false;
  const ok = await bcrypt.compare(String(code), row.codeHash);
  if (!ok) return false;
  await prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return true;
}

export function otpEmailHtml(code, purpose) {
  const title = purpose === "reset" ? "Password reset code" : "Your verification code";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0">
    <div style="max-width:480px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#2563eb;color:#fff;padding:18px 24px;font-size:16px;font-weight:700">${title}</div>
      <div style="padding:24px;color:#111827">
        <p>Use this code to continue. It expires in 10 minutes.</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:12px">If you didn't request this, you can ignore this email.</p>
      </div>
    </div></body></html>`;
}
