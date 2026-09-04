import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/notifications/:id — only the recipient can delete their own.
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const id = parseInt(params.id, 10);
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return NextResponse.json({ message: "Notification not found." }, { status: 404 });
  }

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ message: "Notification deleted successfully" });
}
