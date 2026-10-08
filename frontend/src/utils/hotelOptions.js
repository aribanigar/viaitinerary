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
    .map((o) => `${o.name}|${o.room_type || ""}|${parseInt(o.package, 10) || 0}`)
    .join(";");

/** "4 Star" / "4" / 4 → "★★★★☆"; unrated → "". */
export const starsLabel = (category) => {
  const n = Number(String(category ?? "").match(/[1-5]/)?.[0]) || 0;
  return n ? "★".repeat(n).padEnd(5, "☆") : "";
};

/** "d-m-Y", "Y-m-d", ISO string or Date → Date (local midnight), or null. */
const parseStayDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b, c] = parts.map(Number);
    return parts[0].length === 4 ? new Date(a, b - 1, c) : new Date(c, b - 1, a);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Nights between check-in and check-out ("d-m-Y" or "Y-m-d"); at least 1. */
export const stayNights = (checkIn, checkOut) => {
  const start = parseStayDate(checkIn);
  const end = parseStayDate(checkOut);
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

/** Package names when the agency hasn't named them for this trip. */
export const DEFAULT_PACKAGE_NAMES = ["Standard", "Deluxe", "Luxury"];

/**
 * The trip's package names: the agency's names over the defaults, at least
 * the three defaults long. Index 0 is the package the quote is priced on.
 */
export const packageNamesOf = (names) => {
  const custom = Array.isArray(names) ? names : [];
  const length = Math.max(DEFAULT_PACKAGE_NAMES.length, custom.length);
  return Array.from({ length }, (_, i) =>
    String(custom[i] || "").trim() || DEFAULT_PACKAGE_NAMES[i] || `Package ${String.fromCharCode(65 + i)}`,
  );
};

/** An optional hotel's package index (older options without one → 0). */
const packageOf = (opt) => {
  const n = parseInt(opt?.package, 10);
  return n > 0 ? n : 0;
};

const isNum = (v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));

/**
 * One stay's hotel choices grouped by package. Within a package the first
 * hotel sets the package's price (for package 0 that's the stay's main
 * hotel); every other hotel in it carries `diff` — what the client pays on
 * top of that first hotel (negative = cheaper; null = unknown).
 *
 * → [{ index, name, hotels: [{ name, category, room_type, photo, isMain, diff, supplement }] }],
 *   only packages that have a hotel in this stay, in package order.
 */
export const stayPackageGroups = (stay, names) => {
  const pkgNames = packageNamesOf(names);
  const options = hotelOptionsOf(stay);
  const maxIndex = Math.max(0, ...options.map(packageOf));
  const groups = [];
  for (let k = 0; k <= maxIndex; k++) {
    const members = options.filter((o) => packageOf(o) === k);
    const hotels =
      k === 0
        ? [{ name: stay.name, category: stay.category, room_type: stay.roomType, photo: stay.photo, isMain: true, supplement: 0 }, ...members]
        : members;
    if (!hotels.length) continue;
    const ref = hotels[0];
    groups.push({
      index: k,
      name: pkgNames[k] || `Package ${String.fromCharCode(65 + k)}`,
      hotels: hotels.map((h, i) => ({
        ...h,
        isMain: !!h.isMain,
        diff:
          i === 0
            ? null
            : isNum(h.supplement) && isNum(ref.supplement)
              ? Math.round(Number(h.supplement)) - Math.round(Number(ref.supplement))
              : null,
      })),
    });
  }
  return groups;
};

/**
 * Hotel packages across the whole trip (Standard / Deluxe / Luxury…). Each
 * package's total is the quoted price (package 0) plus, for every stay, the
 * client-facing difference of that package's first hotel over the stay's main
 * hotel; a stay with no hotel in a package uses its main hotel. A total is
 * null when one of those differences is unknown (an option without a rate).
 *
 * → null unless at least two packages have hotels, else
 *   { stays: [{ city, nights }], packages: [{ index, name, cells: [{ hotels, fallback }], total }] }
 */
export const hotelPackages = (accommodations, { basePrice, names } = {}) => {
  const stays = (accommodations || [])
    .filter((a) => a && !a.cancelled && !a.cancelledAt && a.id !== "booked-by-guest")
    .map((a) => ({ stay: a, at: parseStayDate(a.checkIn)?.getTime() ?? Infinity }))
    .sort((x, y) => x.at - y.at)
    .map((x) => x.stay);
  const groupsPerStay = stays.map((a) => stayPackageGroups(a, names));
  const used = new Set(groupsPerStay.flatMap((gs) => gs.map((g) => g.index)));
  if (used.size < 2) return null;

  const pkgNames = packageNamesOf(names);
  const base = Math.round(Number(basePrice) || 0);
  const packages = [...used].sort((a, b) => a - b).map((k) => {
    let total = base;
    const cells = groupsPerStay.map((groups) => {
      const own = groups.find((g) => g.index === k);
      const group = own || groups.find((g) => g.index === 0);
      if (own && k > 0 && total != null) {
        const ref = own.hotels[0].supplement;
        total = isNum(ref) ? total + Math.round(Number(ref)) : null;
      }
      return { hotels: group.hotels, fallback: !own };
    });
    return { index: k, name: pkgNames[k] || `Package ${String.fromCharCode(65 + k)}`, cells, total };
  });
  return {
    stays: stays.map((a) => ({ city: a.city || "", nights: stayNights(a.checkIn, a.checkOut) })),
    packages,
  };
};

/** "₹20,213" for a package total, or "On request" when unknown. */
export const packageTotalLabel = (total, currency) =>
  total == null ? "On request" : `${currencySymbolOf(currency)}${Math.round(total).toLocaleString("en-IN")}`;

/** "+₹1,500" / "₹800 less" / "same price" for a within-package difference; "" when unknown. */
export const diffLabel = (diff, currency) => {
  if (!isNum(diff)) return "";
  const n = Math.round(Number(diff));
  if (n === 0) return "same price";
  const amount = `${currencySymbolOf(currency)}${Math.abs(n).toLocaleString("en-IN")}`;
  return n > 0 ? `+${amount}` : `${amount} less`;
};
