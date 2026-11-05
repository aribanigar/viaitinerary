import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { listIntegrations } from "@/lib/integrations";

export const dynamic = "force-dynamic";

// GET /api/integrations — the agency's connected lead sources (no tokens).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json(await listIntegrations(await adminIdOf(user)));
}
