import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 5 attempts per 60-second sliding window, DB-backed (Postgres, not in-memory)
// since this runs as serverless functions with no shared memory between
// invocations. Applied to login, OTP send, password reset, signup, and the
// public lead-inquiry form.
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Client IP behind Vercel's proxy — falls back to a constant if unavailable
 * (e.g. local dev), which just makes local requests share one bucket. */
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Check + record one attempt against `key` in a single call. Returns
 * `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`. Call this
 * BEFORE doing the sensitive work — a blocked attempt still counts, so an
 * attacker can't reset the window by retrying while blocked.
 */
export async function rateLimit(key) {
  const now = Date.now();
  const cutoff = new Date(now - WINDOW_MS);

  const recent = await prisma.rateLimitAttempt.findMany({
    where: { key, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (recent.length >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - recent[0].createdAt.getTime());
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  await prisma.rateLimitAttempt.create({ data: { key } });
  // Best-effort cleanup of this key's old rows so the table doesn't grow
  // unbounded — never blocks the response on failure.
  prisma.rateLimitAttempt.deleteMany({ where: { key, createdAt: { lt: cutoff } } }).catch(() => {});

  return { allowed: true };
}

/** Standard 429 response for a blocked attempt. */
export function rateLimitedResponse(retryAfterSeconds) {
  return NextResponse.json(
    { message: `Too many attempts. Try again in ${retryAfterSeconds}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
