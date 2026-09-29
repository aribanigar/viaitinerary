import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  hashPassword,
  needsRehash,
  signToken,
  publicUser,
  cookieOptions,
  TOKEN_COOKIE,
} from "@/lib/auth";
import {
  supabaseAuthEnabled,
  supabaseSignIn,
  supabaseFindUserByEmail,
  supabaseCreateUser,
  supabaseSetPassword,
} from "@/lib/supabaseAuth";
import { isConfiguredSuperAdmin } from "@/lib/superAdmins.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Longest a login response will wait on the one-time Supabase mirror sync
// below; past this the sync keeps going on its own and the login returns.
const SUPABASE_SYNC_BUDGET_MS = 1500;

/**
 * Keep this account's Supabase Auth identity in step with the password that
 * just verified. Only runs for accounts not yet linked (one time each).
 * Never throws — a failure just means it's retried on the next login.
 */
async function linkSupabaseIdentity(user, password) {
  try {
    const existing = await supabaseFindUserByEmail(user.email);
    let supabaseId = existing?.id || null;
    if (supabaseId) {
      await supabaseSetPassword(supabaseId, password);
    } else {
      supabaseId = (await supabaseCreateUser(user.email, password))?.id || null;
    }
    if (supabaseId) {
      await prisma.user.update({ where: { id: user.id }, data: { supabaseId } });
    }
  } catch (err) {
    console.error(`Supabase identity link failed for ${user.email}:`, err.message);
  }
}

// POST /api/login — email + password, returns a bearer token (Sanctum-compatible
// shape the existing frontend expects) and sets a session cookie.
//
// The local bcrypt hash is checked first — no network, and the right answer
// for almost every login. Supabase Auth is only asked when that fails, to
// recover accounts whose local hash went stale while Supabase kept the real
// password: until 2026-09-19 the deploy-time seed reset the super admin's
// local hash to "password" on every build, and logins kept working only
// through Supabase. A Supabase match rewrites the local hash, so the next
// login for that account is local again.
export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 422 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim(), mode: "insensitive" } },
      include: { membershipTeam: true },
    });
    if (!user) {
      return NextResponse.json({ message: "Incorrect email or password." }, { status: 401 });
    }

    let localHashStale = false;
    if (!(await verifyPassword(password, user.password))) {
      const supabaseUser = user.supabaseId ? await supabaseSignIn(user.email, password) : null;
      if (!supabaseUser || supabaseUser.id !== user.supabaseId) {
        return NextResponse.json({ message: "Incorrect email or password." }, { status: 401 });
      }
      localHashStale = true;
    }
    if (["inactive", "suspended"].includes(user.status)) {
      return NextResponse.json(
        { message: `Your account has been ${user.status}. Please contact support.` },
        { status: 403 }
      );
    }

    if (user.role !== "super_admin" && isConfiguredSuperAdmin(user.email)) {
      await prisma.user.update({ where: { id: user.id }, data: { role: "super_admin" } });
      user.role = "super_admin";
    }

    const followUps = [];
    if (localHashStale || needsRehash(user.password)) {
      followUps.push(
        hashPassword(password)
          .then((hash) => prisma.user.update({ where: { id: user.id }, data: { password: hash } }))
          .catch((err) => console.error(`Password rehash failed for ${user.email}:`, err.message))
      );
    }
    if (!user.supabaseId && supabaseAuthEnabled()) {
      followUps.push(
        Promise.race([
          linkSupabaseIdentity(user, password),
          new Promise((resolve) => setTimeout(resolve, SUPABASE_SYNC_BUDGET_MS)),
        ])
      );
    }
    await Promise.all(followUps);

    const token = signToken({ sub: String(user.id), role: user.role });
    const res = NextResponse.json({
      token,
      access_token: token,
      token_type: "Bearer",
      user: publicUser(user, user.membershipTeam),
    });
    res.cookies.set(TOKEN_COOKIE, token, cookieOptions());
    return res;
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json({ message: "Login failed. Please try again." }, { status: 500 });
  }
}
