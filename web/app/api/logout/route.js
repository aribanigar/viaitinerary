import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/logout — stateless JWT, so the client discards its token; we also
// clear the session cookie.
export async function POST() {
  const res = NextResponse.json({ message: "Logged out" });
  res.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
