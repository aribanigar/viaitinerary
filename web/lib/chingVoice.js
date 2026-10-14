// Ching's spoken voice (ElevenLabs) — which voice and which key to use.
//
// Voice: the agency's own pick (Settings → Integrations → Ching voice), else
// ELEVENLABS_VOICE_ID from the environment, else DEFAULT_VOICE_ID.
// Key: the agency's own ElevenLabs key (write-only setting), else the
// platform's ELEVENLABS_API_KEY. Keys live only in the database or Vercel's
// environment variables — never in this (public) repository.
import prisma from "@/lib/prisma";

// The voice the owner chose for Ching (2026-10-14). A voice ID is not a secret.
export const DEFAULT_VOICE_ID = "czQ9pLzjRaF61EAYjcPC";

const ID = /^[A-Za-z0-9]{12,40}$/;

/**
 * An ElevenLabs voice ID, or a link that contains one:
 *   czQ9pLzjRaF61EAYjcPC
 *   https://elevenlabs.io/voices/czQ9pLzjRaF61EAYjcPC
 *   https://elevenlabs.io/app/voice-library?voiceId=czQ9pLzjRaF61EAYjcPC
 *   https://elevenlabs.io/app/voice-lab/share/<hash>/czQ9pLzjRaF61EAYjcPC
 * → the ID, or null when nothing ID-shaped is found.
 */
export function parseVoiceId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  for (const key of ["voiceId", "voice_id", "voice"]) {
    const v = url.searchParams.get(key);
    if (v && ID.test(v)) return v;
  }
  const parts = url.pathname.split("/").filter(Boolean).reverse();
  return parts.find((p) => ID.test(p) && /\d/.test(p) && /[A-Za-z]/.test(p)) || null;
}

/** { apiKey, voiceId, source } for this tenant; apiKey null → not configured. */
export async function chingVoiceConfig(adminId) {
  let dbOk = true;
  const s = await prisma.agencySetting
    .findUnique({ where: { userId: adminId }, select: { chingVoiceId: true, elevenlabsApiKey: true } })
    .catch(() => {
      dbOk = false; // columns not pushed yet (the build's prisma db push failed) → platform defaults
      return null;
    });
  const envKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const apiKey = s?.elevenlabsApiKey || envKey || null;
  const voiceId = s?.chingVoiceId || (process.env.ELEVENLABS_VOICE_ID || "").trim() || DEFAULT_VOICE_ID;
  return { apiKey, voiceId, ownKey: !!s?.elevenlabsApiKey, source: s?.elevenlabsApiKey ? "settings" : envKey ? "vercel" : null, dbOk };
}

/**
 * Ask ElevenLabs whether this key + voice will work, without spending credits:
 * the voice's name, and the characters left this month when the key may read them.
 * → { ok, voiceName, credits: { used, limit } | null, problem }
 */
export async function checkChingVoice({ apiKey, voiceId }) {
  if (!apiKey) return { ok: false, voiceName: null, credits: null, problem: "no_key" };
  const get = (path) =>
    fetch(`https://api.elevenlabs.io${path}`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10000) });
  let voiceRes;
  try {
    voiceRes = await get(`/v1/voices/${encodeURIComponent(voiceId)}`);
  } catch {
    return { ok: false, voiceName: null, credits: null, problem: "unreachable" };
  }
  const voice = voiceRes.ok ? await voiceRes.json().catch(() => ({})) : null;
  let credits = null;
  try {
    const sub = await get("/v1/user/subscription");
    if (sub.ok) {
      const d = await sub.json();
      if (Number.isFinite(d?.character_limit)) credits = { used: d.character_count ?? 0, limit: d.character_limit };
    }
  } catch {
    /* restricted key or network — credits just aren't shown */
  }
  let problem = null;
  if (voiceRes.status === 401) problem = "bad_key";
  else if (voiceRes.status === 403) problem = "key_permissions";
  else if (voiceRes.status === 404 || voiceRes.status === 400) problem = "voice_not_found";
  else if (!voiceRes.ok) problem = `error_${voiceRes.status}`;
  else if (credits && credits.limit - credits.used < 50) problem = "no_credits";
  return { ok: !problem, voiceName: voice?.name || null, credits, problem };
}
