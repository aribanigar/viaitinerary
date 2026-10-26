import prisma from "@/lib/prisma";

// How Ching is doing, measured from real use (since 2026-10-14):
//  - MISSES: every request Ching didn't understand, understood only in part,
//    got corrected on straight after, got stuck asking about, or couldn't
//    answer from the catalog — grouped by the SHAPE of the sentence (names,
//    numbers and dates blanked) so one weak spot shows as one line with a
//    count, not as fifty different sentences.
//  - STATS: per day, how many turns Ching took and how they went, so there is
//    a number to watch ("understood 91% this week") instead of a feeling.
// Both live in ChingMemory rows of their own kinds ("miss", "stat") — no
// schema change — and, like hotel tags and conversations, are NOT memory.
// Text is scrubbed of phone numbers and emails in the browser before it is
// sent (frontend utils/ching/insight.js) and again here.

export const MISS_KIND = "miss";
export const STAT_KIND = "stat";
export const MISS_TYPES = new Set(["unknown", "partial", "corrected", "stuck", "no-trip", "unmet"]);
export const STAT_NAMES = new Set(["turns", "understood", "missed", "partial", "corrected", "plans", "confirmed", "cancelled", "voice", "typed"]);
const MAX_MISSES = 300;
const KEEP_DAYS = 90;
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

/** Phone numbers and emails never go into the log. */
export const scrub = (s) =>
  clip(s, 400)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>")
    .replace(/(?:\+?\d[\s-]?){7,}/g, "<phone> ")
    .replace(/\s+/g, " ")
    .trim();

const parse = (v, fallback) => {
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? o : fallback;
  } catch {
    return fallback;
  }
};
const dayKey = (d = new Date()) => new Date(d).toISOString().slice(0, 10);
const safeKey = (s) => clip(s, 80).toLowerCase().replace(/[^a-z0-9:_-]+/g, "");

/**
 * Record a batch of events from the browser:
 *   { type: "miss", kind, key, shape, text, page }  |  { type: "stat", name, n }
 * Misses with the same kind + key are one row whose count goes up.
 */
export async function recordInsights(adminId, userId, events) {
  const list = (Array.isArray(events) ? events : []).slice(0, 25);
  const stats = {};
  const misses = new Map();
  for (const e of list) {
    if (e?.type === "stat" && STAT_NAMES.has(String(e.name))) {
      stats[e.name] = (stats[e.name] || 0) + Math.max(1, Math.min(50, Number(e.n) || 1));
    } else if (e?.type === "miss" && MISS_TYPES.has(String(e.kind))) {
      const key = `${e.kind}:${safeKey(e.key)}`;
      if (key.endsWith(":")) continue;
      const m = misses.get(key) || { kind: e.kind, shape: scrub(e.shape).slice(0, 240), texts: [], page: clip(e.page, 40), n: 0 };
      const text = scrub(e.text).slice(0, 300);
      if (text && !m.texts.includes(text)) m.texts.push(text);
      m.n += 1;
      misses.set(key, m);
    }
  }
  const now = new Date();
  for (const [key, m] of misses) {
    const where = { userId_kind_key: { userId: adminId, kind: MISS_KIND, key } };
    const row = await prisma.chingMemory.findUnique({ where });
    const old = row ? parse(row.value, {}) : {};
    const examples = [...new Set([...m.texts, ...(old.examples || [])])].slice(0, 4);
    const value = JSON.stringify({
      kind: m.kind,
      shape: m.shape || old.shape || "",
      examples,
      count: (old.count || 0) + m.n,
      first: old.first || now.toISOString(),
      last: now.toISOString(),
      page: m.page || old.page || "",
      by: [...new Set([...(old.by || []), userId])].slice(-8),
      // Seen again after it was marked fixed: it is open again.
      status: old.status === "ignored" ? "ignored" : "open",
      reopened: old.status === "done" ? (old.reopened || 0) + 1 : old.reopened || 0,
    });
    await prisma.chingMemory.upsert({ where, create: { userId: adminId, kind: MISS_KIND, key, value, createdBy: userId }, update: { value } });
  }
  if (Object.keys(stats).length) {
    const key = dayKey(now);
    const where = { userId_kind_key: { userId: adminId, kind: STAT_KIND, key } };
    const row = await prisma.chingMemory.findUnique({ where });
    const old = row ? parse(row.value, {}) : {};
    for (const [k, n] of Object.entries(stats)) old[k] = (old[k] || 0) + n;
    await prisma.chingMemory.upsert({ where, create: { userId: adminId, kind: STAT_KIND, key, value: JSON.stringify(old), createdBy: userId }, update: { value: JSON.stringify(old) } });
  }
  if (misses.size) await trim(adminId);
  return { misses: misses.size, stats: Object.keys(stats).length };
}

// Bounded: the oldest misses and stats beyond the window go.
async function trim(adminId) {
  const n = await prisma.chingMemory.count({ where: { userId: adminId, kind: MISS_KIND } });
  if (n > MAX_MISSES) {
    const old = await prisma.chingMemory.findMany({ where: { userId: adminId, kind: MISS_KIND }, orderBy: { updatedAt: "asc" }, take: n - MAX_MISSES, select: { id: true } });
    await prisma.chingMemory.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  }
  const cutoff = dayKey(Date.now() - KEEP_DAYS * 86400000);
  await prisma.chingMemory.deleteMany({ where: { userId: adminId, kind: STAT_KIND, key: { lt: cutoff } } });
}

/** Pure: stat rows + miss rows → the report. `days` = how far back the totals look. */
export function buildReport(missRows, statRows, { days = 14, now = new Date() } = {}) {
  const from = dayKey(new Date(now).getTime() - (days - 1) * 86400000);
  const daily = statRows
    .map((r) => ({ day: r.key, ...parse(r.value, {}) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.day >= from)
    .sort((a, b) => a.day.localeCompare(b.day));
  const totals = {};
  for (const d of daily) for (const [k, v] of Object.entries(d)) if (k !== "day") totals[k] = (totals[k] || 0) + (Number(v) || 0);
  const turns = totals.turns || 0;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const misses = missRows
    .map((r) => ({ key: r.key, tenant: r.userId, ...parse(r.value, {}) }))
    .filter((m) => m.kind)
    .sort((a, b) => (b.status === "open") - (a.status === "open") || (b.count || 0) - (a.count || 0) || String(b.last).localeCompare(String(a.last)));
  const open = misses.filter((m) => m.status === "open");
  const byKind = {};
  for (const m of open) byKind[m.kind] = (byKind[m.kind] || 0) + (m.count || 0);
  return {
    days,
    daily,
    totals,
    // The numbers to watch.
    score: {
      understood: pct(Math.max(0, turns - (totals.missed || 0)), turns), // % of turns Ching acted on
      missed: pct(totals.missed || 0, turns),
      corrected: pct(totals.corrected || 0, Math.max(0, turns - (totals.missed || 0))), // % of what it did that was taken back
      confirmed: pct(totals.confirmed || 0, totals.plans || 0), // % of planned trips the agent built
      turns,
    },
    open: open.length,
    byKind,
    misses,
  };
}

export async function readInsights(adminId, opts = {}) {
  const where = adminId == null ? {} : { userId: adminId };
  const [missRows, statRows] = await Promise.all([
    prisma.chingMemory.findMany({ where: { ...where, kind: MISS_KIND }, orderBy: { updatedAt: "desc" }, take: adminId == null ? 2000 : MAX_MISSES }),
    prisma.chingMemory.findMany({ where: { ...where, kind: STAT_KIND }, orderBy: { key: "desc" }, take: adminId == null ? 5000 : KEEP_DAYS }),
  ]);
  if (adminId != null) return buildReport(missRows, statRows, opts);
  // Every agency together (platform super admins): the same sentence shape
  // missed at several agencies is one line; the days are summed.
  const merged = new Map();
  for (const r of missRows) {
    const v = parse(r.value, {});
    const m = merged.get(r.key);
    if (!m) merged.set(r.key, { key: r.key, userId: 0, value: { ...v, agencies: 1 } });
    else {
      m.value.count = (m.value.count || 0) + (v.count || 0);
      m.value.examples = [...new Set([...(m.value.examples || []), ...(v.examples || [])])].slice(0, 4);
      m.value.last = String(v.last) > String(m.value.last) ? v.last : m.value.last;
      m.value.status = m.value.status === "open" || v.status === "open" ? "open" : m.value.status;
      m.value.agencies += 1;
    }
  }
  const days = new Map();
  for (const r of statRows) {
    const v = parse(r.value, {});
    const d = days.get(r.key) || {};
    for (const [k, n] of Object.entries(v)) d[k] = (d[k] || 0) + (Number(n) || 0);
    days.set(r.key, d);
  }
  return buildReport(
    [...merged.values()].map((m) => ({ key: m.key, userId: 0, value: JSON.stringify(m.value) })),
    [...days.entries()].map(([key, v]) => ({ key, value: JSON.stringify(v) })),
    opts,
  );
}

/** Mark a miss "done" (fixed), "ignored" (not worth fixing) or "open" again. → true when found. */
export async function setMissStatus(adminId, key, status) {
  if (!["open", "done", "ignored"].includes(status)) return false;
  const where = { userId_kind_key: { userId: adminId, kind: MISS_KIND, key: clip(key, 120) } };
  const row = await prisma.chingMemory.findUnique({ where });
  if (!row) return false;
  await prisma.chingMemory.update({ where, data: { value: JSON.stringify({ ...parse(row.value, {}), status }) } });
  return true;
}

export async function deleteMisses(adminId, key = null) {
  const where = { userId: adminId, kind: MISS_KIND, ...(key ? { key: clip(key, 120) } : {}) };
  const { count } = await prisma.chingMemory.deleteMany({ where });
  return count;
}
