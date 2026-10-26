import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Tag } from "lucide-react";
import { fetchHotelTags, saveHotelTags, fetchPlaceTags, savePlaceTags } from "../../api/ching";
import { TAG_GROUPS, tagLabel, inferHotelTags } from "../../utils/ching/meaning";
import { PLACE_TAG_GROUPS, inferPlaceTags } from "../../utils/ching/whereTo";
import { invalidateChingMemory } from "../../utils/ching/memoryStore";

// What a hotel (or a destination) is like — ticked here, searched by Ching
// when a client asks for "riverside", "something quiet", "where is good for
// snow?" (utils/ching/meaning.js, whereTo.js). One picker, two kinds:
//  - hotel: the ticked tags ADD to what Ching reads off the hotel's name;
//  - place: the ticked tags REPLACE what Ching knows about the town, so the
//    picker starts from that and the first change saves the whole set.
// One fetch of the agency's tags is shared by everything opened in this visit.
const KINDS = {
  hotel: {
    groups: TAG_GROUPS,
    infer: inferHotelTags,
    fetchAll: fetchHotelTags,
    save: (token, id, tags) => saveHotelTags(token, { hotel_id: id, tags }),
    replaces: false,
    hint: "Ching uses these when a client asks for a view, a quiet place, somewhere for a family…",
    guessed: "Read from the hotel’s name. Tick to confirm",
    foot: "Dashed tags are read from the name; Ching already uses them.",
  },
  place: {
    groups: PLACE_TAG_GROUPS,
    infer: inferPlaceTags,
    fetchAll: fetchPlaceTags,
    save: (token, id, tags) => savePlaceTags(token, { destination_id: id, tags }),
    replaces: true,
    hint: "Ching uses these when a client asks where to go: “somewhere with snow”, “shopping and a lake”…",
    guessed: "What Ching already knows about this place. Change anything to make the list your own",
    foot: "Dashed tags are what Ching already knows about this place. Change any and the list becomes yours.",
  },
};
const caches = {}; // kind → { token, promise }
const loadAll = (kind, token) => {
  if (caches[kind]?.token !== token) caches[kind] = { token, promise: KINDS[kind].fetchAll(token).then((r) => r?.tags || {}) };
  return caches[kind].promise;
};

const TagPicker = ({ kind = "hotel", item, token, className = "mt-6 pt-6 border-t border-black/5" }) => {
  const K = KINDS[kind];
  const hotel = item;
  const [tags, setTags] = useState(null); // null = loading
  const [saving, setSaving] = useState("");
  const [open, setOpen] = useState(false);
  const fromName = K.infer(hotel);

  useEffect(() => {
    let live = true;
    setTags(null);
    if (!hotel?.id || !token) return undefined;
    loadAll(kind, token)
      .then((all) => live && setTags(all[String(hotel.id)] || []))
      .catch(() => {
        caches[kind] = null;
        if (live) setTags([]);
      });
    return () => {
      live = false;
    };
  }, [hotel?.id, token, kind]);

  const toggle = async (tag) => {
    if (!tags || saving) return;
    // A place's own list starts from what Ching already knows about it.
    const from = K.replaces && !tags.length ? fromName : tags;
    const next = from.includes(tag) ? from.filter((t) => t !== tag) : [...from, tag];
    setSaving(tag);
    setTags(next);
    try {
      const r = await K.save(token, hotel.id, next);
      const saved = r?.tags || next;
      setTags(saved);
      const all = await loadAll(kind, token).catch(() => null);
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
  const shown = open ? K.groups : K.groups.map((g) => ({ ...g, tags: g.tags.filter((t) => ticked.includes(t) || fromName.includes(t)) })).filter((g) => g.tags.length);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8a93a2]">
          <Tag className="w-3 h-3" /> What it’s like
        </h3>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] font-bold text-ink/60 hover:text-ink">
          {open ? "Done" : ticked.length ? "Edit tags" : "Add tags"}
        </button>
      </div>
      <p className="text-[11px] text-[#9aa3b2] font-medium mb-3">
        {K.hint}
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
                  const guessed = !on && fromName.includes(t) && !(K.replaces && ticked.length);
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!!saving}
                      onClick={() => toggle(t)}
                      aria-pressed={on}
                      title={guessed ? K.guessed : undefined}
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
      {!open && fromName.some((t) => !ticked.includes(t)) && !(K.replaces && ticked.length) && (
        <p className="text-[10px] text-[#9aa3b2] font-medium mt-2">{K.foot}</p>
      )}
    </div>
  );
};

const HotelTags = ({ hotel, token }) => <TagPicker kind="hotel" item={hotel} token={token} />;
/** The same picker for a destination (Destinations → edit). */
export const PlaceTags = ({ destination, token, className }) => <TagPicker kind="place" item={destination} token={token} className={className} />;

export default HotelTags;
