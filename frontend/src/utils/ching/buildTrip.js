// Turns a ChingCommand (a spoken new-trip request) into the Trip Builder's
// own state — hotels back to back from the start date, a day-wise plan, cab
// bookings — so Ching can fill the open builder form live. Nothing is saved
// here: pricing is the builder's own (it recomputes the total from these
// items), and the agent presses Save / Export when happy.
import {
  hotelRoomTypes,
  findRoomTypeSection,
  bedPricesFromSection,
  hotelCategoryLabel,
} from "../hotelRates.js";
import { destinationActivityLabels } from "../destinationActivities.js";
import { hotelInCity, findDestinationFor, placeKey, samePlace } from "./places.js";
import { dayWiseCabs } from "./cabPlan.js";

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" + n days, in local calendar terms (no timezone drift). */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The city the travellers are in on each night (index 0 = night of day 1),
 * from the stays in order; nights beyond the stays reuse the last city.
 */
function nightlyCities(command, hotels, destinations = []) {
  const cities = [];
  for (const stay of command.stays || []) {
    const hotel = hotels.find((h) => String(h.id) === String(stay.hotelId));
    const city = displayCity(stay.city || hotel?.city || command.destinationName || "", destinations);
    for (let i = 0; i < (stay.nights || 0); i += 1) cities.push(city);
  }
  const fallback = cities[cities.length - 1] || command.destinationName || "";
  while (cities.length < command.nights) cities.push(fallback);
  return cities.slice(0, command.nights);
}


/**
 * A clean city name for titles and cards: the typed city without ", State" /
 * stray spaces ("Pahalgam, Kashmir" → "Pahalgam", "gulmarg " → "Gulmarg").
 */
// eslint-disable-next-line no-unused-vars
export function displayCity(city, destinations = []) {
  const raw = String(city || "").trim();
  if (!raw) return "";
  const head = raw.split(",")[0].trim().replace(/\s+/g, " ").replace(/\s+(?:city|town)$/i, "");
  return head ? head.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : raw;
}

const firstPrice = (h) => Number((h.price_sections || [])[0]?.price) || 0;

/**
 * What the agent said about hotel class/budget:
 * { stars, tier: "budget"|"luxury"|null, maxPrice } — "4 star", "cheapest",
 * "luxury", "under 6000", "below ₹6k", "within 5,500 per night".
 */
export function hotelPreference(text) {
  const t = String(text || "").toLowerCase();
  const m = /\b([1-7])\s*-?\s*star\b/.exec(t);
  const tier = /\b(budget|cheap|cheapest|economy|affordable)\b/.test(t)
    ? "budget"
    : /\b(luxury|luxurious|premium|best|top|5\s*star)\b/.test(t)
      ? "luxury"
      : null;
  const cap = /\b(?:under|below|less\s+than|within|upto|up\s+to|max(?:imum)?|not\s+more\s+than|budget\s+(?:of|is))\s*(?:rs\.?|₹|inr|rupees)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/.exec(t);
  let maxPrice = null;
  if (cap) {
    const n = Number(cap[1].replace(/,/g, "")) * (cap[2] ? 1000 : 1);
    if (n >= 300) maxPrice = n; // "under 5" is nights, not rupees
  }
  return { stars: m ? m[1] : null, tier, maxPrice };
}

/** Learned favourites for a city (memory.hotels: { placeKey: [hotelId…] }, most used first). */
const favouritesIn = (memory, city) => {
  const map = memory?.hotels || {};
  const k = placeKey(city);
  return map[k] || Object.entries(map).find(([c]) => samePlace(c, city))?.[1] || [];
};

/**
 * A sensible hotel in `city` when the agent named only the place: available
 * ones, the spoken star rating / budget cap if any, then the agency's own
 * favourite there (learned from its saved trips), then cheapest (budget) /
 * dearest (luxury) / the middle of the range (default).
 * → the hotel, or null. `why` (optional out-param object) says how it was chosen.
 */
export function pickHotel(city, hotels, pref = {}, memory = null, why = {}) {
  let pool = hotels.filter((h) => hotelInCity(h, city) && h.is_available !== false);
  if (!pool.length) pool = hotels.filter((h) => hotelInCity(h, city));
  if (!pool.length) return null;
  if (pref.stars) {
    const starred = pool.filter((h) => String(h.category || "").startsWith(pref.stars));
    if (starred.length) pool = starred;
  }
  if (pref.maxPrice) {
    const within = pool.filter((h) => firstPrice(h) > 0 && firstPrice(h) <= pref.maxPrice);
    if (within.length) pool = within;
    else why.overBudget = true;
  }
  const priced = pool.slice().sort((a, b) => firstPrice(a) - firstPrice(b) || String(a.name).localeCompare(String(b.name)));
  if (pref.tier === "budget") return priced[0];
  if (pref.tier === "luxury") return priced[priced.length - 1];
  const fav = favouritesIn(memory, city).map((id) => pool.find((h) => String(h.id) === String(id))).find(Boolean);
  if (fav) {
    why.favourite = true;
    return fav;
  }
  // With a budget cap, the best one that still fits it.
  if (pref.maxPrice && !why.overBudget) return priced[priced.length - 1];
  return priced[Math.floor((priced.length - 1) / 2)];
}

/**
 * The cab for a group: the agency's usual one for this group size when it
 * fits (memory.vehicles: [{ id, minGuests, maxGuests, n }]), else the smallest
 * available cab that seats everyone — per-day rates before per-trip ones,
 * cheapest among equals. → vehicle or null.
 */
export function pickVehicle(vehicles, guests, memory = null, why = {}) {
  const usable = vehicles.filter((v) => v.is_available !== false && Number(v.price) > 0);
  const seats = (v) => Number(v.seating_capacity) || 0;
  const learned = (memory?.vehicles || [])
    .filter((m) => guests >= (m.minGuests || 0) - 1 && guests <= (m.maxGuests || 99) + 1)
    .sort((a, b) => (b.n || 0) - (a.n || 0))
    .map((m) => usable.find((v) => String(v.id) === String(m.id)))
    .find((v) => v && (!seats(v) || seats(v) >= guests));
  if (learned) {
    why.favourite = true;
    return learned;
  }
  const fits = usable
    .filter((v) => seats(v) >= guests)
    .sort(
      (a, b) =>
        (a.rate_type === "per_trip") - (b.rate_type === "per_trip") ||
        seats(a) - seats(b) ||
        Number(a.price) - Number(b.price),
    );
  return fits[0] || null;
}

/**
 * Stays with a hotel for every one: a stay that named only a city gets an
 * auto-picked hotel there; a trip with nights and a destination but no stays
 * gets one stay for all nights. → { stays, autoPicked: [{ city, hotel }] }
 */
function resolveStays(command, hotels, nights, destinations = [], memory = null) {
  const pref = hotelPreference(command.transcript);
  const autoPicked = [];
  const missing = [];
  const pick = (city, extra = {}) => {
    const why = {};
    const h = pickHotel(city, hotels, pref, memory, why);
    if (!h) {
      missing.push(city);
      return null;
    }
    autoPicked.push({ city: h.city || city, hotel: h.name, favourite: !!why.favourite, overBudget: !!why.overBudget, ...extra });
    return h;
  };
  let stays = (command.stays || []).map((st) => {
    if (st.hotelId || !st.city) return st;
    const h = pick(st.city);
    if (!h) return st;
    return { ...st, hotelId: h.id, hotelName: h.name, city: displayCity(st.city || h.city, destinations) };
  });
  if (!stays.length && nights > 0) {
    const route = planRoute(command, hotels, destinations, nights, memory);
    stays = route.map(({ city, nights: n }) => {
      const h = pick(city, { routed: route.length > 1 });
      // No hotel there: keep the city in the plan so the day-wise
      // itinerary and cabs still follow the route; Logistics shows the gap.
      return h
        ? { nights: n, hotelId: h.id, hotelName: h.name, city: displayCity(city, destinations) }
        : { nights: n, city: displayCity(city, destinations) };
    });
  }
  return { stays, autoPicked, missing: [...new Set(missing)], pref };
}

/** How many cities a trip of `nights` nights comfortably covers. */
const citiesFor = (nights) => (nights <= 2 ? 1 : nights <= 3 ? 2 : nights <= 6 ? 3 : 4);

/** Split `nights` over `cities`: even shares, the extra nights to the first ones. */
function splitNights(cities, nights) {
  const k = Math.min(cities.length, citiesFor(nights), nights);
  const base = Math.floor(nights / k);
  return cities.slice(0, k).map((city, i) => ({ city, nights: base + (i < nights % k ? 1 : 0) }));
}

/**
 * No stays were spoken — plan them: the hotel cities said in the sentence (in
 * the order said), else the destination itself if it has hotels, else the
 * hotel cities of that region (same state as the destination, busiest first).
 * → [{ city, nights }]
 */
function planRoute(command, hotels, destinations, nights, memory = null) {
  const hotelCities = [...new Set(hotels.filter((h) => h.city && h.is_available !== false).map((h) => String(h.city).trim()))];
  const destNames = destinations.map((d) => d.name).filter(Boolean);
  const places = [...new Set([...hotelCities, ...destNames])];
  const text = String(command.transcript || "").toLowerCase();
  const esc = (c) => c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const said = places
    .map((c) => ({ c, at: text.search(new RegExp(`\\b${esc(placeKey(c) || c)}\\b`)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c)
    .filter((c, i, arr) => arr.findIndex((y) => samePlace(y, c)) === i);
  const dest = command.destinationName;
  // A region ("Kashmir") isn't a stop; the cities named with it are.
  const stops = said.filter((c) => !(dest && samePlace(c, dest) && !hotelCities.some((h) => samePlace(h, c))));
  if (stops.length) return splitNights(stops, nights);

  if (!dest) return [];
  // The agency's usual split for this destination and length (learned).
  const learned = memory?.routes?.[`${placeKey(dest)}|${nights}`];
  if (Array.isArray(learned) && learned.length && learned.reduce((n, r) => n + (Number(r.nights) || 0), 0) === nights) {
    return learned.map((r) => ({ city: r.city, nights: Number(r.nights) }));
  }
  if (hotelCities.some((c) => samePlace(c, dest))) return [{ city: hotelCities.find((c) => samePlace(c, dest)), nights }];

  const region = findDestinationFor(destinations, dest);
  const regionKey = String(region?.state || region?.name || dest).toLowerCase().replace(/^jammu (?:and|&) /, "");
  const inRegion = (city) => {
    const d = findDestinationFor(destinations, city);
    const hs = hotels.filter((h) => samePlace(h.city, city));
    return (
      (d && [d.state, d.city, d.name].some((v) => v && String(v).toLowerCase().includes(regionKey))) ||
      hs.some((h) => [h.state, h.address].some((v) => v && String(v).toLowerCase().includes(regionKey)))
    );
  };
  const count = (city) => hotels.filter((h) => samePlace(h.city, city)).length;
  const cities = hotelCities.filter(inRegion).sort((a, b) => count(b) - count(a));
  return cities.length ? splitNights(cities, nights) : [];
}

/**
 * Pure: ChingCommand + catalog → the builder's state for that trip:
 * { tripInfo (fields to merge), itinerary, accommodations, transportation }.
 * Partial commands (still being spoken) give partial trips: no start date →
 * no dated hotels/cabs yet, no nights → no day plan yet.
 * catalog = { hotels, destinations, vehicles }.
 */
export function buildChingTripParts(command, catalog) {
  const hotels = catalog.hotels || [];
  const vehicles = catalog.vehicles || [];
  const destinations = catalog.destinations || [];
  const memory = catalog.memory || null;
  let seq = Date.now();
  const newId = () => (seq += 1); // > 1e9: the builder saves these as new rows

  const nights = Math.max(0, Number(command.nights) || 0);
  const days = nights ? nights + 1 : 0;
  const resolved = resolveStays(command, hotels, nights, destinations, memory);
  command = { ...command, stays: resolved.stays };
  const autoPicked = [...resolved.autoPicked];
  const remembered = [];
  // The agency's usual meal plan when none was said (learned from its trips).
  let mealPlan = command.mealPlan || "";
  if (!mealPlan && memory?.mealPlan && (command.stays || []).length) {
    mealPlan = memory.mealPlan;
    remembered.push({ meal: mealPlan });
  }
  // A returning client: phone / email from their last trip when not said.
  const known = command.clientName ? recallClient(memory, command.clientName) : null;
  if (known) {
    if (!command.clientPhone && known.phone) remembered.push({ phone: known.phone, client: known.name });
    if (!command.clientEmail && known.email) remembered.push({ email: known.email, client: known.name });
  }
  const start = /^\d{4}-\d{2}-\d{2}$/.test(command.startDate || "") ? command.startDate : "";
  const cities = nightlyCities({ ...command, nights }, hotels, destinations);
  const lastCity = cities[cities.length - 1] || command.destinationName || "";
  const destinationFor = (city) => findDestinationFor(destinations, city);

  // ── Hotels: one stay per hotel, back to back from the start date.
  const accommodations = [];
  if (start) {
    let cursor = start;
    for (const stay of command.stays || []) {
      const hotel = hotels.find((h) => String(h.id) === String(stay.hotelId));
      if (hotel && stay.nights > 0) {
        const roomType = hotelRoomTypes(hotel)[0] || "Deluxe";
        const section = findRoomTypeSection(hotel, roomType, cursor);
        accommodations.push({
          id: newId(),
          hotelId: hotel.id,
          name: hotel.name,
          city: displayCity(stay.city || hotel.city, destinations),
          category: hotelCategoryLabel(hotel.category) || "4 Star",
          roomType,
          rooms: String(Math.max(1, Math.ceil((command.adults || 1) / 2))),
          // Kids 5–12 share the parents' room (child-no-bed rate); under-5s are free.
          cnbCount: String(command.children || 0),
          extraBeds5To12Count: "0",
          extraBedsAbove12Count: "0",
          extraAdultCount: "0",
          mealPlan,
          pricePerRoom: section.price || 0,
          bedPrices: bedPricesFromSection(section),
          photo: hotel.image_url || hotel.image_path || null,
          checkIn: cursor,
          checkOut: addDays(cursor, stay.nights),
          cancelled: false,
          cancellationCharge: "",
          cancellationNote: "",
          alternateOptions: [],
          markupPercentage: "",
        });
      }
      cursor = addDays(cursor, stay.nights || 0);
    }
  }

  // ── Day-wise plan: arrival, moves between cities, local days, departure.
  // Each day's destination (the Itinerary tab's picker) is the city the
  // travellers end that day in; the sightseeing lines come from it.
  const itinerary = [];
  for (let day = 1; day <= days; day += 1) {
    const here = cities[day - 1] ?? lastCity;
    const prev = day > 1 ? cities[day - 2] : null;
    let title;
    if (day === 1) title = `Arrival in ${here}`;
    else if (day === days) title = `Departure from ${lastCity}`;
    else if (prev && !samePlace(prev, here)) title = `${prev} to ${here}`;
    else title = `${here} Sightseeing`;
    const location = day === days ? lastCity : here;
    const dest = destinationFor(location);
    const activities = day === days ? [] : destinationActivityLabels(dest?.activities);
    itinerary.push({
      id: newId(),
      day,
      title: `Day ${day}: ${title}`,
      location,
      destination: dest?.name || location,
      destinationId: dest?.id ?? null,
      description: activities.join("\n"),
      activities,
      photo: dest?.image_url || dest?.image_path || null,
    });
  }

  // ── Cab: one booking per day (a per-trip rate is priced once — see cabPlan.js).
  let vehicle = vehicles.find((v) => String(v.id) === String(command.vehicleId));
  // No cab named: the agency's usual one for this group, else the smallest that seats everyone.
  if (!vehicle && !/\b(no|without)\s+(cab|car|taxi|vehicle|transport)\b/i.test(command.transcript || "")) {
    const guests = (Number(command.adults) || 0) + (Number(command.children) || 0);
    const why = {};
    vehicle = guests > 0 ? pickVehicle(vehicles, guests, memory, why) : null;
    if (vehicle) autoPicked.push({ cab: vehicle.name, guests, favourite: !!why.favourite });
  }
  const transportation =
    vehicle && start && days
      ? dayWiseCabs({ days: itinerary, vehicle, dateOf: (n) => addDays(start, n - 1), newId })
      : [];

  const place = command.destinationName || [...new Set(cities)].filter(Boolean).join(" - ");
  const destination = destinationFor(command.destinationName) || destinationFor(cities[0]);
  const phone = command.clientPhone || (known?.phone ?? "");
  const email = command.clientEmail || (known?.email ?? "");
  const tripInfo = {
    ...(command.clientName ? { clientName: known?.name || command.clientName } : {}),
    ...(phone ? { clientPhone: phone } : {}),
    ...(email ? { clientEmail: email } : {}),
    adults: command.adults || 2,
    kids5to12: command.children || 0,
    kidsUpto5: command.infants || 0,
    ...(start ? { startDate: start } : {}),
    ...(nights ? { duration: String(nights) } : {}),
    ...(place ? { destination: place, destinationId: command.destinationId ?? destination?.id ?? null } : {}),
    ...(place && nights ? { tripTitle: `${place} ${nights}N/${days}D` } : {}),
  };

  return {
    tripInfo,
    itinerary,
    accommodations,
    transportation,
    vehicle,
    autoPicked,
    remembered,
    missingHotels: resolved.missing,
    budget: resolved.pref.maxPrice,
  };
}

/**
 * A returning client from memory.clients ([{ name, phone, email, trips }]):
 * the same full name, or a unique match on a single spoken first name.
 */
export function recallClient(memory, name) {
  const list = memory?.clients || [];
  if (!list.length || !name) return null;
  const k = placeKey(name).replace(/\b(?:mr|mrs|ms|dr)\b/g, "").trim();
  if (!k) return null;
  const exact = list.filter((c) => placeKey(c.name) === k);
  if (exact.length) return exact.sort((a, b) => (b.trips || 0) - (a.trips || 0))[0];
  if (k.split(" ").length === 1) {
    const first = list.filter((c) => placeKey(c.name).split(" ")[0] === k);
    if (first.length === 1) return first[0];
  }
  return null;
}
