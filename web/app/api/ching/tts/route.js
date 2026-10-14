import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ching's spoken replies in the agency's chosen ElevenLabs voice.
// Configured only through Vercel environment variables (never in the repo):
//   ELEVENLABS_API_KEY   — the account's API key (stays on the server)
//   ELEVENLABS_VOICE_ID  — the voice to speak with (ElevenLabs → Voices → ID)
//   ELEVENLABS_MODEL_ID  — optional, default eleven_flash_v2_5 (lowest latency)
// Not configured, out of credits or unreachable → the browser keeps using its
// own speech synthesis (utils/ching/voice.js falls back on any non-audio reply).
const API_KEY = process.env.ELEVENLABS_API_KEY || "";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
const enabled = () => !!(API_KEY && VOICE_ID);

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

// GET /api/ching/tts → { enabled } (the widget asks once per page load)
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  return NextResponse.json({ enabled: enabled() });
}

// POST /api/ching/tts { text } → audio/mpeg
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (!enabled()) return NextResponse.json({ message: "Voice not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ message: "Nothing to say." }, { status: 422 });
  if (!allow(user.id)) return NextResponse.json({ message: "Too many voice replies — slow down." }, { status: 429 });

  let upstream;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
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
    return NextResponse.json({ message: `Voice service error (${upstream.status}).` }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
  });
}
