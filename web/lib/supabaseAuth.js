// Supabase Auth integration (credential storage/verification only — the app
// keeps issuing its own session JWT via web/lib/auth.js exactly as before;
// this module's job is just "does this email/password combo verify, per
// Supabase" and "create/update the Supabase identity for an account").
// Raw fetch, no SDK — matches the existing style of web/lib/storage.js.

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function supabaseAuthEnabled() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
  "Content-Type": "application/json",
  ...extra,
});

/**
 * Verify email/password against Supabase Auth. Returns the Supabase user
 * object on success, or null on any failure (wrong credentials, account not
 * yet migrated, Supabase unreachable, not configured) — never throws, so
 * callers can always fall back to the legacy bcrypt check.
 */
export async function supabaseSignIn(email, password) {
  if (!supabaseAuthEnabled()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.user || null;
  } catch {
    return null;
  }
}

/** Look up an existing Supabase Auth identity by email, or null. Never throws. */
export async function supabaseFindUserByEmail(email) {
  if (!supabaseAuthEnabled()) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  } catch {
    return null;
  }
}

/**
 * Create a Supabase Auth identity with a known password. email_confirm is
 * set true — this app already verifies email ownership itself (OTP-based
 * signup), so Supabase's own confirmation email would be redundant and
 * would otherwise block sign-in until clicked. Throws on failure — callers
 * decide whether that should be fatal.
 */
export async function supabaseCreateUser(email, password) {
  if (!supabaseAuthEnabled()) throw new Error("Supabase Auth is not configured.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.msg || data?.message || `Supabase user creation failed (${res.status})`);
  }
  return data;
}

/** Update an existing Supabase Auth identity's password. Never throws. */
export async function supabaseSetPassword(supabaseUserId, password) {
  if (!supabaseAuthEnabled() || !supabaseUserId) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${supabaseUserId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create (or claim an orphaned) Supabase Auth identity for a brand-new
 * account, before any Prisma row exists for it — so a failure here leaves
 * nothing behind to clean up and the caller is safely retryable. Used by
 * both self-service signup and admin-created team member accounts.
 */
export async function provisionSupabaseUser(email, password) {
  try {
    const created = await supabaseCreateUser(email, password);
    return created?.id || null;
  } catch {
    // Most likely an orphaned identity from an earlier partial attempt (no
    // Prisma row ever got created for it) — claim it.
    const existing = await supabaseFindUserByEmail(email);
    if (!existing) throw new Error("Could not create the account with the auth provider.");
    await supabaseSetPassword(existing.id, password);
    return existing.id;
  }
}
