// "Export Budget + Premium": the same trip as two itineraries that differ only
// in their hotels. Days, activities, guests, rooms, beds, meal plans, cabs and
// dates are the trip's own; each stay just gets the hotel picked for that tier,
// priced from that hotel's own rate sheet (same room type + meal plan + date).
// Pure, no React — the Trip Builder renders each tier into its live preview
// and exports it.

import {
  hotelRoomTypes,
  toRoomTypeSlug,
  rateSectionFor,
  bedPricesFromSection,
  hotelCategoryLabel,
} from "./hotelRates.js";
import { hotelOptionsOf } from "./hotelOptions.js";

export const TIERS = [
  { key: "budget", label: "Budget" },
  { key: "premium", label: "Premium" },
];

/** "d-m-Y" or "Y-m-d" → "Y-m-d" (what the rate sheet's seasons compare), else "". */
export const isoDate = (value) => {
  const s = String(value || "").slice(0, 10);
  const p = s.split("-");
  if (p.length !== 3) return "";
  return p[0].length === 4 ? s : `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/\b(?:city|town|district)\b/g, "")
    .replace(/[^a-z]/g, "");
/** Same town? ("Srinagar City" = "Srinagar", "Pahalgam, Kashmir" = "Pahalgam") */
export const sameCity = (a, b) => !!norm(a) && norm(a) === norm(b);

const stars = (h) => Number(String(h?.category ?? "").match(/[1-5]/)?.[0]) || 0;
const available = (h) => h && h.is_available !== false;
const hotelIdOf = (stay) => stay?.hotelId ?? stay?.hotel_id;

/** The stays an itinerary shows (cancelled and guest-booked ones left out). */
export const tierStays = (accommodations) =>
  (accommodations || []).filter((a) => a && !a.cancelled && !a.cancelledAt && a.id !== "booked-by-guest");

/** The agency's hotels in the stay's town, the stay's own hotel included. */
export const hotelsForStay = (stay, hotels) => {
  const list = (hotels || []).filter((h) => available(h) && sameCity(h.city, stay.city));
  const own = (hotels || []).find((h) => String(h.id) === String(hotelIdOf(stay)));
  if (own && !list.includes(own)) list.unshift(own);
  return list;
};

/** What one room-night of `hotel` costs for this stay (its room type / meal plan / date). */
export const roomRate = (stay, hotel) => {
  const types = hotelRoomTypes(hotel);
  const roomType = types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(stay.roomType)) || types[0] || stay.roomType;
  return Number(rateSectionFor(hotel, roomType, isoDate(stay.checkIn), stay.mealPlan).price) || 0;
};

/**
 * The stay with another hotel: everything about the stay is kept (dates,
 * rooms, beds, meal plan, margin); the hotel, its room type (the same one when
 * it has it), the rate and the bed prices come from the new hotel. Its
 * "Hotel A or B" options are dropped — each tier's itinerary shows one hotel.
 */
export const swapStayHotel = (stay, hotel) => {
  if (!hotel || String(hotel.id) === String(hotelIdOf(stay))) return { ...stay, alternateOptions: [] };
  const types = hotelRoomTypes(hotel);
  const roomType = types.find((t) => toRoomTypeSlug(t) === toRoomTypeSlug(stay.roomType)) || types[0] || stay.roomType;
  const section = rateSectionFor(hotel, roomType, isoDate(stay.checkIn), stay.mealPlan);
  return {
    ...stay,
    hotelId: hotel.id,
    name: hotel.name,
    city: stay.city || hotel.city,
    category: hotelCategoryLabel(hotel.category) || stay.category,
    roomType,
    pricePerRoom: section.price || 0,
    bedPrices: bedPricesFromSection(section),
    photo: hotel.image_url || hotel.image_path || null,
    alternateOptions: [],
  };
};

/**
 * Starting picks, per stay id: Budget = the hotel on the trip now; Premium =
 * the stay's own upgrade option when it has one (its highest package), else
 * the agency's next better hotel in that town (more stars, or the same stars
 * at a higher rate), else the same hotel (nothing better listed).
 */
export const defaultTierPicks = (accommodations, hotels) => {
  const picks = { budget: {}, premium: {} };
  for (const stay of tierStays(accommodations)) {
    const id = String(stay.id);
    const own = (hotels || []).find((h) => String(h.id) === String(hotelIdOf(stay)));
    picks.budget[id] = own ? own.id : null;
    const pool = hotelsForStay(stay, hotels);
    // 1. An upgrade the agency already offers on this stay (Deluxe / Luxury package).
    const upgrade = hotelOptionsOf(stay)
      .filter((o) => (parseInt(o.package, 10) || 0) > 0)
      .sort((a, b) => (parseInt(b.package, 10) || 0) - (parseInt(a.package, 10) || 0))
      .map((o) => pool.find((h) => (o.hotelId && String(h.id) === String(o.hotelId)) || norm(h.name) === norm(o.name)))
      .find(Boolean);
    if (upgrade) {
      picks.premium[id] = upgrade.id;
      continue;
    }
    // 2. The next better hotel in town.
    const baseStars = own ? stars(own) : stars(stay);
    const baseRate = own ? roomRate(stay, own) : Number(stay.pricePerRoom) || 0;
    const better = pool
      .filter((h) => String(h.id) !== String(hotelIdOf(stay)))
      .map((h) => ({ h, s: stars(h), r: roomRate(stay, h) }))
      .filter((x) => x.s > baseStars || (x.s === baseStars && x.r > baseRate))
      .sort((a, b) => a.s - b.s || a.r - b.r);
    picks.premium[id] = better[0]?.h.id ?? (own ? own.id : null);
  }
  return picks;
};

/** The trip's stays for one tier (stay id → hotel id picks); unpicked stays keep their hotel. */
export const tierAccommodations = (accommodations, picks = {}, hotels = []) =>
  (accommodations || []).map((stay) => {
    if (!tierStays([stay]).length) return stay;
    const id = picks[String(stay.id)];
    const hotel = id != null ? (hotels || []).find((h) => String(h.id) === String(id)) : null;
    return swapStayHotel(stay, hotel);
  });

/** "TRP592618 Premium Itinerary.pdf" */
export const tierFileName = (tripId, tierLabel) =>
  `${String(tripId || "Trip").trim()} ${tierLabel} Itinerary.pdf`.replace(/[\\/:*?"<>|]+/g, "-");

/** "Kashmir Explorer" → "Kashmir Explorer (Premium)"; an existing tier tag is replaced. */
export const tierTitle = (title, tierLabel) => {
  const base = String(title || "").replace(/\s*\((?:Budget|Premium)\)\s*$/i, "").trim();
  return base ? `${base} (${tierLabel})` : `${tierLabel} Itinerary`;
};
