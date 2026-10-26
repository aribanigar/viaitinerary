import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { readConversation, saveConversation, clearConversation } from "@/lib/chingConversation";

export const dynamic = "force-dynamic";

// The signed-in agent's own conversation with Ching (lib/chingConversation.js).

// GET /api/ching/conversation → { lines, threads, pending, at }
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json(await readConversation(await adminIdOf(user), user.id));
}

// PUT /api/ching/conversation { lines, threads, pending } — replace it (the browser sends the whole, bounded, conversation).
export async function PUT(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Nothing to save." }, { status: 422 });
  const at = await saveConversation(await adminIdOf(user), user.id, body);
  return NextResponse.json({ saved: true, at });
}

// DELETE /api/ching/conversation — "clear our conversation".
export async function DELETE(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  await clearConversation(await adminIdOf(user), user.id);
  return NextResponse.json({ cleared: true });
}
