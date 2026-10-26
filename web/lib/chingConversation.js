import prisma from "@/lib/prisma";
import { CONVERSATION_KIND } from "@/lib/chingMemory";

// An agent's conversation with Ching, kept so it is still there after a
// reload, tomorrow, or on their phone: the lines said (grouped into one thread
// per trip) and the trip request Ching was still asking about. One ChingMemory
// row per agent (kind "conversation", key "u:<userId>") — the agent's own; a
// team-mate never sees it. Bounded: the newest lines win.

export const MAX_LINES = 200;
const MAX_TEXT = 2000;
const MAX_BYTES = 120000;
const clip = (v, n) => String(v ?? "").slice(0, n);

/** Whatever the browser sent → a conversation that is safe to store. Pure. */
export function cleanConversation(input) {
  const src = input && typeof input === "object" ? input : {};
  const lines = (Array.isArray(src.lines) ? src.lines : [])
    .map((l) => ({
      role: l?.role === "ching" ? "ching" : "you",
      text: clip(l?.text, MAX_TEXT).trim(),
      at: Number.isFinite(Number(l?.at)) ? Number(l.at) : Date.now(),
      ...(l?.thread ? { thread: clip(l.thread, 60) } : {}),
    }))
    .filter((l) => l.text)
    .slice(-MAX_LINES);
  const threads = {};
  for (const [id, t] of Object.entries(src.threads && typeof src.threads === "object" ? src.threads : {}).slice(-60)) {
    threads[clip(id, 60)] = { title: clip(t?.title, 120), at: Number(t?.at) || Date.now() };
  }
  // The request Ching was still asking about (frontend utils/ching/brief.js state).
  let pending = null;
  const p = src.pending;
  if (p && typeof p === "object" && typeof p.text === "string") {
    pending = {
      thread: clip(p.thread, 60),
      text: clip(p.text, 4000),
      ask: (Array.isArray(p.ask) ? p.ask : []).map((k) => clip(k, 20)).slice(0, 6),
      month: Number.isInteger(p.month) ? p.month : null,
      nameAsked: !!p.nameAsked,
      nameSkipped: !!p.nameSkipped,
      question: clip(p.question, 400),
      at: Number(p.at) || Date.now(),
    };
  }
  const out = { v: 1, lines, threads, pending, at: Date.now() };
  // Too big to keep whole: the oldest lines go.
  while (JSON.stringify(out).length > MAX_BYTES && out.lines.length > 10) out.lines = out.lines.slice(Math.ceil(out.lines.length / 4));
  return out;
}

const keyOf = (userId) => `u:${userId}`;

export async function readConversation(adminId, userId) {
  const row = await prisma.chingMemory.findUnique({ where: { userId_kind_key: { userId: adminId, kind: CONVERSATION_KIND, key: keyOf(userId) } } });
  if (!row) return cleanConversation(null);
  try {
    return { ...cleanConversation(JSON.parse(row.value)), at: row.updatedAt.getTime() };
  } catch {
    return cleanConversation(null);
  }
}

export async function saveConversation(adminId, userId, input) {
  const value = JSON.stringify(cleanConversation(input));
  const where = { userId_kind_key: { userId: adminId, kind: CONVERSATION_KIND, key: keyOf(userId) } };
  const row = await prisma.chingMemory.upsert({ where, create: { userId: adminId, kind: CONVERSATION_KIND, key: keyOf(userId), value, createdBy: userId }, update: { value } });
  return row.updatedAt.getTime();
}

export async function clearConversation(adminId, userId) {
  await prisma.chingMemory.deleteMany({ where: { userId: adminId, kind: CONVERSATION_KIND, key: keyOf(userId) } });
}
