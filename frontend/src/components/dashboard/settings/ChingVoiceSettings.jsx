import React, { useRef, useState } from "react";
import { AudioLines, Play, Square, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { updateSettings } from "../../../api/settings";
import { resetChingVoice } from "../../../utils/ching/voice";

// Same rules as web/lib/chingVoice.js parseVoiceId (the server re-checks).
const ID = /^[A-Za-z0-9]{12,40}$/;
function voiceIdFrom(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (ID.test(raw)) return raw;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    for (const k of ["voiceId", "voice_id", "voice"]) {
      const v = url.searchParams.get(k);
      if (v && ID.test(v)) return v;
    }
    return url.pathname.split("/").filter(Boolean).reverse().find((p) => ID.test(p) && /\d/.test(p) && /[A-Za-z]/.test(p)) || null;
  } catch {
    return null;
  }
}

const SAMPLE = "Hello! I'm Ching. Your 6 nights, 7 days Kashmir trip is ready — shall I send it to the client?";
const inputClass =
  "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-[#e7f63c]/20 focus:border-[#e7f63c] outline-none transition-all placeholder:font-medium placeholder:text-slate-300";

// Settings → Integrations → Ching voice: which ElevenLabs voice Ching speaks
// with (a voice link or ID), an optional own API key (write-only), and a
// preview. Saved with the page's Save button like every other setting.
export default function ChingVoiceSettings({ formData, setFormData, handleInputChange, token }) {
  const [previewing, setPreviewing] = useState(false);
  const audio = useRef(null);
  const typed = formData.chingVoiceId || "";
  const parsed = voiceIdFrom(typed);

  const preview = async () => {
    if (previewing) {
      audio.current?.pause();
      setPreviewing(false);
      return;
    }
    if (typed && !parsed) {
      toast.error("That doesn't look like an ElevenLabs voice link or ID.");
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch("/api/ching/tts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: SAMPLE, ...(parsed ? { voice_id: parsed } : {}) }),
      });
      if (!res.ok || !/audio/.test(res.headers.get("content-type") || "")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          res.status === 503
            ? "No ElevenLabs API key yet — add one below (or in Vercel) and save first."
            : data.message || `Preview failed (${res.status}).`,
        );
      }
      const url = URL.createObjectURL(await res.blob());
      if (!audio.current) audio.current = new Audio();
      const a = audio.current;
      a.onended = a.onerror = () => {
        setPreviewing(false);
        URL.revokeObjectURL(url);
      };
      a.src = url;
      await a.play();
    } catch (err) {
      toast.error(err.message || "Couldn't play the preview.");
      setPreviewing(false);
    }
  };

  const removeKey = async () => {
    if (!window.confirm("Remove your ElevenLabs key? Ching will use the platform key, or the browser voice if there is none.")) return;
    try {
      await updateSettings(token, { clearElevenlabsKey: true });
      setFormData((prev) => ({ ...prev, elevenlabsApiKey: "", hasElevenlabsKey: false }));
      resetChingVoice();
      toast.success("ElevenLabs key removed");
    } catch (err) {
      toast.error(err.message || "Couldn't remove the key.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md flex flex-col space-y-4">
      <div className="flex items-center gap-2 text-[#1b1b1b]">
        <AudioLines className="w-5 h-5" />
        <h2 className="text-base font-bold text-slate-900">Ching voice</h2>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          ElevenLabs voice — link or ID <span className="text-slate-300">(blank = default voice)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="chingVoiceId"
            value={typed}
            onChange={handleInputChange}
            placeholder="https://elevenlabs.io/voices/… or a voice ID"
            className={inputClass}
          />
          <button
            type="button"
            onClick={preview}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            {previewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {previewing ? "Stop" : "Preview"}
          </button>
        </div>
        <p className={`text-[11px] ml-1 ${typed && !parsed ? "text-red-500 font-semibold" : "text-slate-400"}`}>
          {typed
            ? parsed
              ? <>Voice ID: <span className="font-mono text-slate-600">{parsed}</span></>
              : "No voice ID found in that — paste the voice's page link from ElevenLabs, or its Voice ID."
            : "Open a voice on elevenlabs.io and paste its link, or copy its Voice ID from My Voices."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          ElevenLabs API key{" "}
          {formData.hasElevenlabsKey ? (
            <span className="text-emerald-600 normal-case tracking-normal">· saved ✓</span>
          ) : (
            <span className="text-slate-300">(optional)</span>
          )}
        </label>
        <input
          type="password"
          name="elevenlabsApiKey"
          value={formData.elevenlabsApiKey || ""}
          onChange={handleInputChange}
          placeholder={formData.hasElevenlabsKey ? "Leave blank to keep the saved key" : "sk_… (blank = the platform's key)"}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="text-[11px] text-slate-400 ml-1 leading-relaxed">
          From ElevenLabs → API Keys. Stored on the server and never shown again; Ching's voice uses your
          ElevenLabs credits. Without any key Ching speaks with the browser's own voice.
          {formData.hasElevenlabsKey && (
            <>
              {" "}
              <button type="button" onClick={removeKey} className="underline text-red-500 hover:text-red-600">
                Remove key
              </button>
            </>
          )}
        </p>
      </div>
      {previewing ? (
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Playing preview…
        </div>
      ) : null}
    </div>
  );
}
