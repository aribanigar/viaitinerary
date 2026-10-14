import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Tag } from "lucide-react";
import { fetchHotelTags, saveHotelTags } from "../../api/ching";
import { TAG_GROUPS, tagLabel, inferHotelTags } from "../../utils/ching/meaning";
import { invalidateChingMemory } from "../../utils/ching/memoryStore";

// What this hotel is like — ticked here, searched by Ching when a client asks
// for "riverside", "something quiet", "good for my parents" (utils/ching/meaning.js).
// One fetch of the agency's tags is shared by every hotel opened in this visit.
let cache = null; // { token, promise }
const loadAll = (token) => {
  if (cache?.token !== token) cache = { token, promise: fetchHotelTags(token).then((r) => r?.tags || {}) };
  return cache.promise;
};

const HotelTags = ({ hotel, token }) => {
  const [tags, setTags] = useState(null); // null = loading
  const [saving, setSaving] = useState("");
  const [open, setOpen] = useState(false);
  const fromName = inferHotelTags(hotel);

  useEffect(() => {
    let live = true;
    setTags(null);
    if (!hotel?.id || !token) return undefined;
    loadAll(token)
      .then((all) => live && setTags(all[String(hotel.id)] || []))
      .catch(() => {
        cache = null;
        if (live) setTags([]);
      });
    return () => {
      live = false;
    };
  }, [hotel?.id, token]);

  const toggle = async (tag) => {
    if (!tags || saving) return;
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setSaving(tag);
    setTags(next);
    try {
      const r = await saveHotelTags(token, { hotel_id: hotel.id, tags: next });
      const saved = r?.tags || next;
      setTags(saved);
      const all = await loadAll(token).catch(() => null);
      if (all) all[String(hotel.id)] = saved;
      invalidateChingMemory(); // Ching picks by these: let it see the change
    } catch (err) {
      setTags(tags);
      toast.error(err?.message || "Couldn’t save the tag");
    } finally {
      setSaving("");
    }
  };

  const ticked = tags || [];
  const shown = open ? TAG_GROUPS : TAG_GROUPS.map((g) => ({ ...g, tags: g.tags.filter((t) => ticked.includes(t) || fromName.includes(t)) })).filter((g) => g.tags.length);

  return (
    <div className="mt-6 pt-6 border-t border-black/5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8a93a2]">
          <Tag className="w-3 h-3" /> What it’s like
        </h3>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] font-bold text-ink/60 hover:text-ink">
          {open ? "Done" : ticked.length ? "Edit tags" : "Add tags"}
        </button>
      </div>
      <p className="text-[11px] text-[#9aa3b2] font-medium mb-3">
        Ching uses these when a client asks for a view, a quiet place, somewhere for a family…
      </p>
      {tags === null ? (
        <p className="text-xs text-slate-300 font-medium">Loading…</p>
      ) : !shown.length ? (
        <p className="text-xs text-slate-400 font-medium">No tags yet.</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((g) => (
            <div key={g.id}>
              {open && <p className="text-[9px] font-black uppercase tracking-widest text-[#b3bac6] mb-1">{g.label}</p>}
              <div className="flex flex-wrap gap-1.5">
                {g.tags.map((t) => {
                  const on = ticked.includes(t);
                  const guessed = !on && fromName.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!!saving}
                      onClick={() => toggle(t)}
                      aria-pressed={on}
                      title={guessed ? "Read from the hotel’s name. Tick to confirm" : undefined}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        on
                          ? "bg-ink text-white"
                          : guessed
                            ? "bg-white text-ink/70 border border-dashed border-ink/30"
                            : "bg-[#f7f7f8] text-ink/60 hover:text-ink"
                      } ${saving === t ? "opacity-60" : ""}`}
                    >
                      {tagLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {!open && fromName.some((t) => !ticked.includes(t)) && (
        <p className="text-[10px] text-[#9aa3b2] font-medium mt-2">Dashed tags are read from the name; Ching already uses them.</p>
      )}
    </div>
  );
};

export default HotelTags;
