import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { chingVoiceConfig, checkChingVoice, parseVoiceId } from "@/lib/chingVoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ching's spoken replies in an ElevenLabs voice. Which voice and which key:
// lib/chingVoice.js (the agency's Settings → Integrations, else the Vercel
// environment: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID). Optional
// ELEVENLABS_MODEL_ID, default eleven_flash_v2_5 (lowest latency and cost).
// No key, out of credits or unreachable → the browser keeps using its own
// speech synthesis (utils/ching/voice.js falls back on any non-audio reply).
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

const MAX_CHARS = 800; // one reply; longer text is the caller's bug, not a reason to spend credits
const PER_MINUTE = 40; // per user, per warm instance — a guard on credits, not a hard quota
const recent = new Map(); // userId -> [timestamps]

function allow(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < 60000);
  if (list.length >= PER_MINUTE) return false;
  list.push(now);
  recent.set(userId, list);
  return true;
}

// GET /api/ching/tts → { enabled, voice_id, own_key, source } (the widget asks once per page load)
// GET /api/ching/tts?check=1 → also asks ElevenLabs (Settings → "Check voice"):
//   { voice_name, credits, problem, db_ok, server_version } — no credits spent.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const cfg = await chingVoiceConfig(await adminIdOf(user));
  const out = { enabled: !!cfg.apiKey, voice_id: cfg.voiceId, own_key: cfg.ownKey, source: cfg.source };
  if (new URL(request.url).searchParams.get("check")) {
    const c = await checkChingVoice(cfg);
    Object.assign(out, {
      ok: c.ok,
      voice_name: c.voiceName,
      credits: c.credits,
      problem: c.problem,
      db_ok: cfg.dbOk,
      model: MODEL_ID,
      server_version: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    });
  }
  return NextResponse.json(out);
}

// POST /api/ching/tts { text, voice_id? } → audio/mpeg
// voice_id (a link or ID) previews a voice in Settings before it's saved.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const cfg = await chingVoiceConfig(await adminIdOf(user));
  if (!cfg.apiKey) return NextResponse.json({ message: "Voice not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let voiceId = cfg.voiceId;
  if (body.voice_id) {
    voiceId = parseVoiceId(body.voice_id);
    if (!voiceId) return NextResponse.json({ message: "That doesn't look like an ElevenLabs voice link or ID." }, { status: 422 });
  }
  const text = String(body.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ message: "Nothing to say." }, { status: 422 });
  if (!allow(user.id)) return NextResponse.json({ message: "Too many voice replies — slow down." }, { status: 429 });

  let upstream;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": cfg.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: MODEL_ID }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (err) {
    console.error("ching tts: ElevenLabs unreachable", err?.message || err);
    return NextResponse.json({ message: "Voice service unreachable." }, { status: 502 });
  }
  if (!upstream.ok) {
    // 401 bad key, 402/429 out of credits or rate-limited, 404 unknown voice id.
    const detail = await upstream.text().catch(() => "");
    console.error(`ching tts: ElevenLabs ${upstream.status}`, detail.slice(0, 300));
    const why =
      upstream.status === 401 ? "the ElevenLabs API key was rejected"
      : upstream.status === 404 || upstream.status === 400 ? "ElevenLabs doesn't know that voice (or it isn't in your account)"
      : upstream.status === 402 || upstream.status === 429 ? "ElevenLabs is out of credits or rate-limited"
      : `ElevenLabs error ${upstream.status}`;
    return NextResponse.json({ message: `Voice unavailable: ${why}.` }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
  });
}
