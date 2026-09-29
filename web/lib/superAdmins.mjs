// Accounts that are always platform super admins. Enforced at login (see
// app/api/login/route.js) rather than only by the deploy-time seed, because
// the seed is silently skipped whenever the build's `prisma db push` step
// fails — a role that depends on it can quietly never apply.
//
// Promote-only: nothing here creates an account. The person signs up (email
// verified by OTP) and is promoted on their next login.
export const SUPER_ADMIN_EMAILS = ["viakashmir.in@gmail.com", "aribanigar034@gmail.com"];

export function isConfiguredSuperAdmin(email) {
  const e = String(email || "").trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(e);
}
