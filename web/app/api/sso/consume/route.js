import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, cookieOptions, TOKEN_COOKIE } from "@/lib/auth";
import { initializeTrial } from "@/lib/subscription";
import { verifyDmcSsoToken, consumeDmcSsoNonce, syncDmcInventory } from "@/lib/dmcBridge";

export const dynamic = "force-dynamic";

// GET /api/sso/consume?token=... - what viakashmir.in's "Launch Itinerary
// Builder" button redirects a DMC partner to. Verifies the signed token
// (lib/dmcBridge.js), finds or provisions the matching agency account,
// refreshes their real-inventory catalog, signs them a normal session token,
// and redirects into the app with it - the existing frontend already stores
// whatever it finds at /sso-login?token=... exactly like a login response.
//
// Never reachable without a valid, unexpired, correctly-signed, not-already-
// used token - there is no other way to create or sign into a DMC-bridge
// account.
export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";

  const payload = token ? verifyDmcSsoToken(token) : null;
  if (!payload) {
    return NextResponse.redirect(
      `${origin}/sso-login?error=${encodeURIComponent("Your itinerary-builder link has expired. Go back to Via Kashmir and try again.")}`
    );
  }

  // Single-use: a signature-valid, unexpired token that's already been
  // consumed once (e.g. a leaked/logged URL replayed within the TTL) is
  // treated the same as an invalid one.
  if (!(await consumeDmcSsoNonce(payload))) {
    return NextResponse.redirect(
      `${origin}/sso-login?error=${encodeURIComponent("This itinerary-builder link has already been used. Go back to Via Kashmir and try again.")}`
    );
  }

  let user = await prisma.user.findUnique({ where: { viaKashmirDmcUserId: payload.dmcUserId } });

  if (!user) {
    const email = String(payload.email).toLowerCase();

    // A DMC partner's ViaKashmir email happening to match an existing,
    // non-bridge viaitinerary account would otherwise hit User.email's
    // unique constraint below and crash with a raw 500 - catch it here
    // with a clear message instead.
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      return NextResponse.redirect(
        `${origin}/sso-login?error=${encodeURIComponent("An account with this email already exists on viaitinerary. Contact Via Kashmir to link your DMC partner account.")}`
      );
    }

    // First time this DMC partner has reached the builder - provision their
    // agency account. bypassSubscription:true means they're never blocked by
    // a trial/plan limit - access is governed entirely by ViaKashmir's own
    // dmcItineraryAccess toggle, not by this app's subscription state.
    const name = payload.companyName || payload.email;
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: await hashPassword(crypto.randomBytes(32).toString("hex")), // unusable - SSO-only login
          role: "admin",
          status: "active",
          emailVerifiedAt: new Date(),
          viaKashmirDmcUserId: payload.dmcUserId,
          isDmcBridge: true,
          bypassSubscription: true,
        },
      });

      await prisma.agencySetting.create({
        data: {
          userId: user.id,
          agencyName: payload.companyName || name,
          contactEmail: payload.email,
        },
      });

      await initializeTrial(user.id);
    } catch (e) {
      // Covers the race where two concurrent consumes for a brand-new
      // partner (double-click, two tabs) both pass the findUnique checks
      // above and both attempt to create - the second hits the unique
      // constraint on viaKashmirDmcUserId or email.
      console.error("DMC bridge account provisioning failed", payload.dmcUserId, e);
      return NextResponse.redirect(
        `${origin}/sso-login?error=${encodeURIComponent("Something went wrong setting up your account. Go back to Via Kashmir and try again.")}`
      );
    }
  }

  if (["inactive", "suspended"].includes(user.status)) {
    return NextResponse.redirect(
      `${origin}/sso-login?error=${encodeURIComponent(`Your account has been ${user.status}. Contact Via Kashmir.`)}`
    );
  }

  // Keep the agency's real-inventory catalog fresh on every handoff - cheap
  // and means DMC prices a partner sees are never more than one login old.
  try {
    await syncDmcInventory(user.id);
  } catch (e) {
    // Never block login over a sync failure - stale inventory is
    // recoverable, a locked-out partner is not.
    console.error("DMC inventory sync failed on SSO consume", user.id, e);
  }

  const authToken = signToken({ sub: String(user.id), role: user.role });
  const res = NextResponse.redirect(`${origin}/sso-login?token=${encodeURIComponent(authToken)}`);
  res.cookies.set(TOKEN_COOKIE, authToken, cookieOptions());
  return res;
}
