import prisma from "@/lib/prisma";

// Caps how many itineraries (trips) one agency workspace can keep.
// - At the soft limit the agency sees a warning but can still create trips.
// - At the hard limit new trips are blocked until some are deleted.
// Settings are platform-wide (PlatformSetting rows) and managed by the super
// admin. Packages are templates, not itineraries, so they don't count.

export const DEFAULTS = { enabled: true, soft_limit: 450, hard_limit: 500 };
const KEYS = {
  enabled: "itinerary_limit_enabled",
  soft_limit: "itinerary_soft_limit",
  hard_limit: "itinerary_hard_limit",
};

export async function limitSettings(db = prisma) {
  let rows = [];
  try {
    rows = await db.platformSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  } catch {
    // Table not there yet (schema push pending): use the defaults.
    return { ...DEFAULTS };
  }
  const get = (k) => rows.find((r) => r.key === KEYS[k])?.value ?? null;
  const int = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const enabled = get("enabled");
  return {
    enabled: enabled == null ? DEFAULTS.enabled : enabled === "1",
    soft_limit: int(get("soft_limit"), DEFAULTS.soft_limit),
    hard_limit: int(get("hard_limit"), DEFAULTS.hard_limit),
  };
}

export async function saveLimitSettings({ enabled, soft_limit, hard_limit }, db = prisma) {
  const values = { enabled: enabled ? "1" : "0", soft_limit: String(soft_limit), hard_limit: String(hard_limit) };
  await db.$transaction(
    Object.entries(values).map(([k, value]) =>
      db.platformSetting.upsert({ where: { key: KEYS[k] }, create: { key: KEYS[k], value }, update: { value } }),
    ),
  );
  return limitSettings(db);
}

/** Usage of one agency workspace (trips are owned by the admin's user id). */
export async function limitStatusForAdmin(adminId, db = prisma) {
  const settings = await limitSettings(db);
  const count = await db.trip.count({ where: { userId: adminId, isPackage: false } });
  let level = "none";
  if (settings.enabled) {
    if (count >= settings.hard_limit) level = "hard";
    else if (count >= settings.soft_limit) level = "soft";
  }
  return { ...settings, count, level, remaining: Math.max(0, settings.hard_limit - count) };
}

/** May this agency create `extra` more trips? { allowed, reason, status } */
export async function canCreateItinerary(adminId, extra = 1, db = prisma) {
  const s = await limitStatusForAdmin(adminId, db);
  if (s.enabled && s.count + extra > s.hard_limit) {
    return {
      allowed: false,
      status: 403,
      reason: `You have reached the limit of ${s.hard_limit} itineraries. Please delete a few old itineraries to create new ones.`,
      limit: s,
    };
  }
  return { allowed: true, status: 200, limit: s };
}
