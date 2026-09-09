import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications/unread-count
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const unread_count = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return NextResponse.json({ unread_count });
}
