import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, publicUser, cookieOptions, TOKEN_COOKIE } from "@/lib/auth";
import { initializeTrial } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// POST /api/signup — create an agency owner (admin) + their team.
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;
    const agencyName = body.agency_name || body.agencyName;

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email and password are required." }, { status: 422 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 422 });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: String(email), mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
    }

    // First account in an empty system becomes the super admin.
    const isFirst = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        password: await hashPassword(password),
        role: isFirst ? "super_admin" : "admin",
        status: "active",
      },
    });

    const teamName = agencyName || `${name}'s agency`;
    let slug = slugify(teamName) || slugify(String(email).split("@")[0]);
    if (await prisma.team.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const team = await prisma.team.create({
      data: { name: teamName, slug, ownerId: user.id },
    });
    await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });

    // Start the admin on a free trial.
    await initializeTrial(user.id);

    const token = signToken({ sub: String(user.id), role: user.role });
    const res = NextResponse.json({
      token,
      access_token: token,
      token_type: "Bearer",
      user: publicUser({ ...user, teamId: team.id }, team),
    });
    res.cookies.set(TOKEN_COOKIE, token, cookieOptions());
    return res;
  } catch (err) {
    return NextResponse.json({ message: err.message || "Signup failed" }, { status: 500 });
  }
}
