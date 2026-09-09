import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications — the caller's own notifications, paginated.
// Response shape matches the frontend's existing Notifications.jsx exactly
// (recovered from the original implementation this session's cleanup pass
// deleted without realizing it was live) — a nested `notifications` +
// `pagination` shape, NOT this app's usual flat `{data, current_page, ...}`
// catalog convention. Deliberately scoped to the caller's own id, not
// adminIdOf — a team member gets their own personal inbox.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
  const search = searchParams.get("search")?.trim();

  const where = {
    userId: user.id,
    ...(search ? { data: { path: ["message"], string_contains: search } } : {}),
  };

  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / perPage));
  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      read_at: n.readAt,
      created_at: n.createdAt,
      data: n.data,
    })),
    pagination: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total,
      from: total === 0 ? 0 : (page - 1) * perPage + 1,
      to: Math.min(page * perPage, total),
    },
    unread_count: unreadCount,
  });
}
