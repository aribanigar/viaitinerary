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

/** Nights between check-in and check-out ("d-m-Y" or "Y-m-d"); at least 1. */
export const stayNights = (checkIn, checkOut) => {
  const parse = (value) => {
    if (!value) return null;
    const parts = String(value).slice(0, 10).split("-");
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      return parts[0].length === 4 ? new Date(a, b - 1, c) : new Date(c, b - 1, a);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const start = parse(checkIn);
  const end = parse(checkOut);
  if (!start || !end) return 1;
  return Math.round((end - start) / 86400000) || 1;
};

/**
 * What the client pays on top of the quoted price to take this optional hotel
 * instead of the main one, for the whole stay: the room-rate difference ×
 * rooms × nights, with the stay's margin and the trip's GST applied exactly
 * like the quote itself. Negative = the option is cheaper. null = unknown
 * (either rate missing). The quote always prices the main hotel.
 */
export const optionSupplement = (stay, opt, { markupPct = 0, gstPct = 0 } = {}) => {
  const base = parseFloat(stay?.pricePerRoom);
  const price = parseFloat(opt?.price);
  if (!(base > 0) || !(price > 0)) return null;
  const rooms = parseInt(stay.rooms, 10) > 0 ? parseInt(stay.rooms, 10) : 1;
  const net = (price - base) * rooms * stayNights(stay.checkIn, stay.checkOut);
  return Math.round(net * (1 + (markupPct || 0) / 100) * (1 + (gstPct || 0) / 100));
};

/** "INR (₹)" → "₹"; "USD" → "USD ". */
export const currencySymbolOf = (currency) => {
  const s = String(currency || "INR (₹)");
  return s.match(/\(([^)]+)\)/)?.[1] || `${s.split(/\s/)[0]} `;
};

/** Client-facing price line for an optional hotel, or "" when unknown. */
export const supplementLabel = (supplement, currency) => {
  if (supplement == null || supplement === "" || Number.isNaN(Number(supplement))) return "";
  const n = Math.round(Number(supplement));
  const sym = currencySymbolOf(currency);
  if (n === 0) return "Same price";
  const amount = `${sym}${Math.abs(n).toLocaleString("en-IN")}`;
  return n > 0 ? `+${amount} for this stay` : `${amount} less for this stay`;
};
