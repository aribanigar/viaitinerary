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
  const s = await prisma.agencySetting
    .findUnique({ where: { userId: adminId }, select: { chingVoiceId: true, elevenlabsApiKey: true } })
    .catch(() => null); // columns not pushed yet → platform defaults
  const apiKey = s?.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || null;
  const voiceId = s?.chingVoiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  return { apiKey, voiceId, ownKey: !!s?.elevenlabsApiKey };
}
