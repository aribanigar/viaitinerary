import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { setInternalAccount, clearInternalAccount, syncViaKashmirCatalog } from "@/lib/viaKashmirCatalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// PATCH /api/super-admin/businesses/:id/vk-internal { enabled } - super-admin
// toggle for "Via Kashmir internal account (B2B net prices)". Same rule as the
// website admin's setting: one account only, never a DMC partner.
export async function PATCH(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const { enabled } = await request.json().catch(() => ({}));
  if (!enabled) {
    await clearInternalAccount(params.id);
    return NextResponse.json({ is_vk_internal: false });
  }
  const res = await setInternalAccount({ userId: params.id });
  if (res.error) return NextResponse.json({ message: res.error }, { status: res.status });
  let sync = null;
  try { sync = await syncViaKashmirCatalog(res.user.id); } catch (e) { sync = { error: e.message }; }
  return NextResponse.json({ is_vk_internal: true, sync });
}
