import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

// DELETE /api/integrations/:platform — disconnect (facebook | google).
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await prisma.integration.deleteMany({ where: { userId: await adminIdOf(user), platform: String(params.platform) } });
  return NextResponse.json({ message: "Integration removed" });
}
