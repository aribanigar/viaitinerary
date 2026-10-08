// Optional hotels ("Hotel A or Hotel B") attached to one accommodation stay,
// stored on Accommodation.alternateOptions. Shared by the itinerary templates.

/** The stay's optional hotels that actually have a name. */
export const hotelOptionsOf = (hotel) =>
  (hotel?.alternateOptions || hotel?.alternate_options || []).filter((o) =>
    String(o?.name || "").trim(),
  );

/** Grouping key so stays only merge when they offer the same options. */
export const hotelOptionsKey = (hotel) =>
  hotelOptionsOf(hotel)
    .map((o) => `${o.name}|${o.room_type || ""}`)
    .join(";");

/** "4 Star" / "4" / 4 → "★★★★☆"; unrated → "". */
export const starsLabel = (category) => {
  const n = Number(String(category ?? "").match(/[1-5]/)?.[0]) || 0;
  return n ? "★".repeat(n).padEnd(5, "☆") : "";
};
