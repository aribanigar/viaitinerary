import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/super-admin/businesses/:id/bypass-subscription — toggle the flag.
export async function PATCH(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const id = parseInt(params.id, 10);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { bypassSubscription: !user.bypassSubscription },
  });
  return NextResponse.json({
    message: "Bypass updated successfully",
    bypass_subscription: !!updated.bypassSubscription,
  });
}
