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

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" + n days, in local calendar terms (no timezone drift). */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const sameName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * The city the travellers are in on each night (index 0 = night of day 1),
 * from the stays in order; nights beyond the stays reuse the last city.
 */
function nightlyCities(command, hotels) {
  const cities = [];
  for (const stay of command.stays || []) {
    const hotel = hotels.find((h) => h.id === stay.hotelId);
    const city = hotel?.city || stay.city || command.destinationName || "";
    for (let i = 0; i < (stay.nights || 0); i += 1) cities.push(city);
  }
  const fallback = cities[cities.length - 1] || command.destinationName || "";
  while (cities.length < command.nights) cities.push(fallback);
  return cities.slice(0, command.nights);
}


const firstPrice = (h) => Number((h.price_sections || [])[0]?.price) || 0;

/** What the agent said about hotel class: { stars, tier: "budget"|"luxury"|null }. */
function hotelPreference(text) {
  const t = String(text || "").toLowerCase();
  const m = /\b([1-7])\s*-?\s*star\b/.exec(t);
  const tier = /\b(budget|cheap|cheapest|economy|affordable)\b/.test(t)
    ? "budget"
    : /\b(luxury|luxurious|premium|best|top|5\s*star)\b/.test(t)
      ? "luxury"
      : null;
  return { stars: m ? m[1] : null, tier };
}

/**
 * A sensible hotel in `city` when the agent named only the place: available
 * ones, the spoken star rating if any, then cheapest (budget) / dearest
 * (luxury) / the middle of the range (default).
 */
export function pickHotel(city, hotels, pref = {}) {
  let pool = hotels.filter((h) => sameName(h.city, city) && h.is_available !== false);
  if (!pool.length) return null;
  if (pref.stars) {
    const starred = pool.filter((h) => String(h.category || "").startsWith(pref.stars));
    if (starred.length) pool = starred;
  }
  const priced = pool.slice().sort((a, b) => firstPrice(a) - firstPrice(b) || String(a.name).localeCompare(String(b.name)));
  if (pref.tier === "budget") return priced[0];
  if (pref.tier === "luxury") return priced[priced.length - 1];
  return priced[Math.floor((priced.length - 1) / 2)];
}

/** Smallest available cab that seats the group (cheapest among equals), or null. */
export function pickVehicle(vehicles, guests) {
  const fits = vehicles
    .filter((v) => v.is_available !== false && Number(v.price) > 0 && Number(v.seating_capacity) >= guests)
    .sort((a, b) => Number(a.seating_capacity) - Number(b.seating_capacity) || Number(a.price) - Number(b.price));
  return fits[0] || null;
}

/**
 * Stays with a hotel for every one: a stay that named only a city gets an
 * auto-picked hotel there; a trip with nights and a destination but no stays
 * gets one stay for all nights. → { stays, autoPicked: [{ city, hotel }] }
 */
function resolveStays(command, hotels, nights, destinations = []) {
  const pref = hotelPreference(command.transcript);
  const autoPicked = [];
  let stays = (command.stays || []).map((st) => {
    if (st.hotelId || !st.city) return st;
    const h = pickHotel(st.city, hotels, pref);
    if (!h) return st;
    autoPicked.push({ city: h.city, hotel: h.name });
    return { ...st, hotelId: h.id, hotelName: h.name, city: h.city };
  });
  if (!stays.length && nights > 0) {
    const route = planRoute(command, hotels, destinations, nights);
    stays = route
      .map(({ city, nights: n }) => {
        const h = pickHotel(city, hotels, pref);
        if (!h) return null;
        autoPicked.push({ city: h.city, hotel: h.name, routed: route.length > 1 });
        return { nights: n, hotelId: h.id, hotelName: h.name, city: h.city };
      })
      .filter(Boolean);
  }
  return { stays, autoPicked };
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
function planRoute(command, hotels, destinations, nights) {
  const hotelCities = [...new Set(hotels.filter((h) => h.city && h.is_available !== false).map((h) => h.city))];
  const text = String(command.transcript || "").toLowerCase();
  const said = hotelCities
    .map((c) => ({ c, at: text.search(new RegExp(`\\b${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c);
  if (said.length) return splitNights(said, nights);

  const dest = command.destinationName;
  if (!dest) return [];
  if (hotelCities.some((c) => sameName(c, dest))) return [{ city: hotelCities.find((c) => sameName(c, dest)), nights }];

  const region = destinations.find((d) => sameName(d.name, dest));
  const regionKey = String(region?.state || region?.name || dest).toLowerCase();
  const inRegion = (city) => {
    const d = destinations.find((x) => sameName(x.name, city) || sameName(x.city, city));
    return d && [d.state, d.city, d.name].some((v) => v && String(v).toLowerCase().includes(regionKey.replace(/^jammu (?:and|&) /, "")));
  };
  const count = (city) => hotels.filter((h) => sameName(h.city, city)).length;
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
  let seq = Date.now();
  const newId = () => (seq += 1); // > 1e9: the builder saves these as new rows

  const nights = Math.max(0, Number(command.nights) || 0);
  const days = nights ? nights + 1 : 0;
  const resolved = resolveStays(command, hotels, nights, destinations);
  command = { ...command, stays: resolved.stays };
  const autoPicked = [...resolved.autoPicked];
  const start = /^\d{4}-\d{2}-\d{2}$/.test(command.startDate || "") ? command.startDate : "";
  const cities = nightlyCities({ ...command, nights }, hotels);
  const lastCity = cities[cities.length - 1] || command.destinationName || "";
  const destinationFor = (city) => destinations.find((d) => sameName(d.name, city));

  // ── Hotels: one stay per hotel, back to back from the start date.
  const accommodations = [];
  if (start) {
    let cursor = start;
    for (const stay of command.stays || []) {
      const hotel = hotels.find((h) => h.id === stay.hotelId);
      if (hotel && stay.nights > 0) {
        const roomType = hotelRoomTypes(hotel)[0] || "Deluxe";
        const section = findRoomTypeSection(hotel, roomType, cursor);
        accommodations.push({
          id: newId(),
          hotelId: hotel.id,
          name: hotel.name,
          city: hotel.city,
          category: hotelCategoryLabel(hotel.category) || "4 Star",
          roomType,
          rooms: String(Math.max(1, Math.ceil((command.adults || 1) / 2))),
          // Kids 5–12 share the parents' room (child-no-bed rate); under-5s are free.
          cnbCount: String(command.children || 0),
          extraBeds5To12Count: "0",
          extraBedsAbove12Count: "0",
          extraAdultCount: "0",
          mealPlan: command.mealPlan || "",
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
  const itinerary = [];
  for (let day = 1; day <= days; day += 1) {
    const here = cities[day - 1] ?? lastCity;
    const prev = day > 1 ? cities[day - 2] : null;
    let title;
    if (day === 1) title = `Arrival in ${here}`;
    else if (day === days) title = `Departure from ${lastCity}`;
    else if (prev && !sameName(prev, here)) title = `${prev} to ${here}`;
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

  // ── Cab: per-trip rate → one booking; otherwise (per day / unset) one per day.
  let vehicle = vehicles.find((v) => v.id === command.vehicleId);
  // No cab named: pick the smallest one that seats the group (unless "no cab").
  if (!vehicle && !/\b(no|without)\s+(cab|car|taxi|vehicle|transport)\b/i.test(command.transcript || "")) {
    const guests = (Number(command.adults) || 0) + (Number(command.children) || 0);
    vehicle = guests > 0 ? pickVehicle(vehicles, guests) : null;
    if (vehicle) autoPicked.push({ cab: vehicle.name, guests });
  }
  const transportation = [];
  if (vehicle && start && days) {
    const booking = (day, tripType, route) => ({
      id: newId(),
      vehicleId: vehicle.id,
      tripType,
      route,
      destination: cities[day - 1] ?? lastCity,
      date: addDays(start, day - 1),
      vehicleType: vehicle.name,
      quantity: 1,
      remarks: "",
      markupPercentage: "",
    });
    if (vehicle.rate_type === "per_trip") {
      transportation.push(booking(1, "Transfer", `Full trip: ${[...new Set(cities)].join(" → ")}`));
    } else {
      itinerary.forEach((it) => {
        const route = it.title.replace(/^Day \d+: /, "").replace(" to ", " → ");
        transportation.push(booking(it.day, /Sightseeing/.test(route) ? "Sightseeing" : "Transfer", route));
      });
    }
  }

  const place = command.destinationName || [...new Set(cities)].filter(Boolean).join(" - ");
  const destination = destinationFor(command.destinationName) || destinationFor(cities[0]);
  const tripInfo = {
    ...(command.clientName ? { clientName: command.clientName } : {}),
    ...(command.clientPhone ? { clientPhone: command.clientPhone } : {}),
    ...(command.clientEmail ? { clientEmail: command.clientEmail } : {}),
    adults: command.adults || 2,
    kids5to12: command.children || 0,
    kidsUpto5: command.infants || 0,
    ...(start ? { startDate: start } : {}),
    ...(nights ? { duration: String(nights) } : {}),
    ...(place ? { destination: place, destinationId: command.destinationId ?? destination?.id ?? null } : {}),
    ...(place && nights ? { tripTitle: `${place} ${nights}N/${days}D` } : {}),
  };

  return { tripInfo, itinerary, accommodations, transportation, vehicle, autoPicked };
}
