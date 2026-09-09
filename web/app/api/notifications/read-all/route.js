import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/notifications/read-all — mark all of the caller's unread notifications read.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ message: "All notifications marked as read" });
}
