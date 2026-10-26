import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest, publicUser, hashPassword } from "@/lib/auth";
import { supabaseSetPassword } from "@/lib/supabaseAuth";
import { persistImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/user/update-profile { name?, password?, password_confirmation?, profile_picture? }
// The Profile page's save. Only the signed-in user's own row is touched.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const b = await request.json().catch(() => ({}));

  const data = {};
  if (b.name !== undefined) {
    const name = String(b.name || "").trim();
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 422 });
    data.name = name.slice(0, 120);
  }

  const password = b.password ? String(b.password) : "";
  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 422 });
    }
    if (b.password_confirmation !== undefined && b.password_confirmation !== password) {
      return NextResponse.json({ message: "Passwords do not match." }, { status: 422 });
    }
    data.password = await hashPassword(password);
  }

  if (b.profile_picture !== undefined) {
    const pic = b.profile_picture ? String(b.profile_picture) : null;
    if (pic && !/^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(pic)) {
      return NextResponse.json({ message: "Please upload a JPG or PNG image." }, { status: 422 });
    }
    data.profilePicture = pic ? await persistImage(pic, "profiles") : null;
  }

  const updated = Object.keys(data).length
    ? await prisma.user.update({ where: { id: user.id }, data })
    : user;

  // Same rule as every password path: keep Supabase Auth in step, or the old
  // password keeps working through /api/login's Supabase fallback.
  if (password && user.supabaseId) {
    try {
      await supabaseSetPassword(user.supabaseId, password);
    } catch (err) {
      console.error("update-profile: Supabase password sync failed", err);
    }
  }

  const team = updated.teamId ? await prisma.team.findUnique({ where: { id: updated.teamId } }) : null;
  return NextResponse.json({ message: "Profile updated.", user: publicUser(updated, team) });
}
