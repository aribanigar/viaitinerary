import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { audienceFor, syncViaKashmirCatalog } from "@/lib/viaKashmirCatalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/vk-catalog/sync - "Sync from Via Kashmir" for a connected account
// (a DMC partner or the internal account). Which feed it gets is decided by
// the account's own flags, never by the request. A super admin may pass
// { account_id } to refresh any connected account.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const targetId = user.role === "super_admin" && body.account_id ? Number(body.account_id) : await adminIdOf(user);
  const owner = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isDmcBridge: true, isVkInternal: true } });
  if (!audienceFor(owner)) return NextResponse.json({ message: "This account is not connected to Via Kashmir." }, { status: 403 });
  try {
    return NextResponse.json(await syncViaKashmirCatalog(targetId));
  } catch (e) {
    return NextResponse.json({ message: e.message || "Sync failed." }, { status: 502 });
  }
}
