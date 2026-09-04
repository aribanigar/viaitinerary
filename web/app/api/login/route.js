import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken, publicUser, cookieOptions, TOKEN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/login — email + password, returns a bearer token (Sanctum-compatible
// shape the existing frontend expects) and sets a session cookie.
export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 422 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email), mode: "insensitive" } },
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
