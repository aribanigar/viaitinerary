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
  supabaseFindUserByEmail,
  supabaseCreateUser,
  supabaseSetPassword,
} from "@/lib/supabaseAuth";

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
// Verified against the local bcrypt hash only. Every password-changing path
// in this app writes that hash, but not all of them also update Supabase — so
// accepting a Supabase match too let a changed (revoked) password keep
// working, and put a cross-network call to Supabase Auth (with its own
// per-IP rate limit, shared by every login coming out of Vercel) on every
// single login. Supabase stays a synced mirror of credentials, not a gate.
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

    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json({ message: "Invalid login details" }, { status: 401 });
    }
    if (["inactive", "suspended"].includes(user.status)) {
      return NextResponse.json(
        { message: `Your account has been ${user.status}. Please contact support.` },
        { status: 403 }
      );
    }

    const followUps = [];
    if (needsRehash(user.password)) {
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
