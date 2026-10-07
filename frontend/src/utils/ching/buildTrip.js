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
import { destinationForCity, rankHotelsForCity } from "./places.js";

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" + n days, in local calendar terms (no timezone drift). */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const sameName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const stars = (h) => Number(String(h?.category ?? "").replace(/\D/g, "")) || null;

/**
 * Stays where only a city was said ("2 nights in Gulmarg") get the agency's
 * best-ranked hotel there — same star rating as the rest of the trip, then
 * cheapest for the date (places.js rankHotelsForCity). Returns the stays with
 * hotelId filled in, plus what was picked so the agent can be told.
 */
export function pickHotelsForCityStays(command, hotels) {
  const named = (command.stays || []).map((s) => hotels.find((h) => h.id === s.hotelId)).filter(Boolean);
  const counts = new Map();
  named.forEach((h) => stars(h) && counts.set(stars(h), (counts.get(stars(h)) || 0) + 1));
  const category = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const picked = [];
  let cursor = /^\d{4}-\d{2}-\d{2}$/.test(command.startDate || "") ? command.startDate : "";
  const stays = (command.stays || []).map((stay) => {
    const date = cursor;
    if (cursor) cursor = addDays(cursor, stay.nights || 0);
    if (stay.hotelId != null || String(stay.hotelName || "").trim() || !stay.city) return stay;
    const hotel = rankHotelsForCity(stay.city, hotels, { category, date })[0];
    if (!hotel) return stay;
    picked.push({ city: stay.city, name: hotel.name });
    return { ...stay, hotelId: hotel.id, hotelName: hotel.name, city: hotel.city || stay.city };
  });
  return { stays, picked };
}

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
  const start = /^\d{4}-\d{2}-\d{2}$/.test(command.startDate || "") ? command.startDate : "";
  const cities = nightlyCities({ ...command, nights }, hotels);
  const lastCity = cities[cities.length - 1] || command.destinationName || "";
  const destinationFor = (city) => destinationForCity(city, destinations);

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
  const vehicle = vehicles.find((v) => v.id === command.vehicleId);
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

  return { tripInfo, itinerary, accommodations, transportation, vehicle };
}
