import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/notifications/:id/read — mark one of the caller's own notifications read.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const id = parseInt(params.id, 10);
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return NextResponse.json({ message: "Notification not found." }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: notification.readAt || new Date() },
  });
  return NextResponse.json({
    id: updated.id,
    read_at: updated.readAt,
    created_at: updated.createdAt,
    data: updated.data,
  });
}
