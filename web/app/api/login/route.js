import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken, publicUser, cookieOptions, TOKEN_COOKIE } from "@/lib/auth";
import {
  supabaseSignIn,
  supabaseFindUserByEmail,
  supabaseCreateUser,
  supabaseSetPassword,
} from "@/lib/supabaseAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Migrate this account's password into Supabase Auth after a successful
 * legacy bcrypt check, so subsequent logins verify via Supabase directly.
 * Best-effort: never throws, never blocks the login response — a failure
 * here just means the account tries again on its next successful login.
 */
async function migrateToSupabase(user, password) {
  try {
    let supabaseId = user.supabaseId;
    if (!supabaseId) {
      const existing = await supabaseFindUserByEmail(user.email);
      if (existing) {
        supabaseId = existing.id;
        await supabaseSetPassword(supabaseId, password);
      } else {
        const created = await supabaseCreateUser(user.email, password);
        supabaseId = created?.id || null;
      }
    } else {
      await supabaseSetPassword(supabaseId, password);
    }
    if (supabaseId && supabaseId !== user.supabaseId) {
      await prisma.user.update({ where: { id: user.id }, data: { supabaseId } });
    }
  } catch (err) {
    console.error(`Supabase Auth migration failed for ${user.email}:`, err.message);
  }
}

// POST /api/login — email + password, returns a bearer token (Sanctum-compatible
// shape the existing frontend expects) and sets a session cookie. Credentials
// are verified via Supabase Auth first, falling back to (and lazily migrating)
// the legacy bcrypt hash for accounts not yet moved over.
export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 422 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email), mode: "insensitive" } },
    });

    const supabaseUser = user ? await supabaseSignIn(email, password) : null;
    let verified = Boolean(supabaseUser);

    if (!verified && user && (await verifyPassword(password, user.password))) {
      verified = true;
      await migrateToSupabase(user, password);
    }

    if (!user || !verified) {
      return NextResponse.json({ message: "Invalid login details" }, { status: 401 });
    }
    if (supabaseUser && !user.supabaseId) {
      // Verified via Supabase but this row was never linked (e.g. created
      // there some other way) — link it now.
      await prisma.user.update({ where: { id: user.id }, data: { supabaseId: supabaseUser.id } });
    }
    if (["inactive", "suspended"].includes(user.status)) {
      return NextResponse.json(
        { message: `Your account has been ${user.status}. Please contact support.` },
        { status: 403 }
      );
    }

    const team = user.teamId
      ? await prisma.team.findUnique({ where: { id: user.teamId } })
      : null;

    const token = signToken({ sub: String(user.id), role: user.role });
    const res = NextResponse.json({
      token,
      access_token: token,
      token_type: "Bearer",
      user: publicUser(user, team),
    });
    res.cookies.set(TOKEN_COOKIE, token, cookieOptions());
    return res;
  } catch (err) {
    return NextResponse.json({ message: err.message || "Login failed" }, { status: 500 });
  }
}
