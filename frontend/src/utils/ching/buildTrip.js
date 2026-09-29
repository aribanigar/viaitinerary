// Turns a confirmed ChingCommand into a complete, priced trip and saves it
// through the same POST /api/trips contract the Trip Builder uses, so the
// result opens in the builder fully editable like a hand-built trip.
//
// Pricing mirrors TripBuilder.jsx's formula exactly (hotels + cabs, each
// marked up by the trip margin, then GST on top), so the saved cost matches
// what the builder shows the moment the trip is opened.
import { createTrip } from "../../api/trips";
import {
  hotelRoomTypes,
  findRoomTypeSection,
  bedPricesFromSection,
  hotelCategoryLabel,
} from "../hotelRates";
import { destinationActivityLabels } from "../destinationActivities";

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" + n days, in local calendar terms (no timezone drift). */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const sameName = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** Hotel stay → the builder's accommodation shape, priced off the rate sheet. */
function stayAccommodation(stay, hotel, checkIn, command) {
  const roomType = hotelRoomTypes(hotel)[0] || "Deluxe";
  const section = findRoomTypeSection(hotel, roomType, checkIn);
  return {
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
    checkIn,
    checkOut: addDays(checkIn, stay.nights),
  };
}

function hotelCost(acc) {
  const rooms = parseInt(acc.rooms || 1, 10);
  const cnbPrice = parseFloat(acc.bedPrices.find((bp) => bp.category === "cnb")?.price || 0);
  const nights = Math.round((new Date(acc.checkOut) - new Date(acc.checkIn)) / 86400000) || 1;
  return parseFloat(acc.pricePerRoom || 0) * rooms * nights + cnbPrice * parseInt(acc.cnbCount || 0, 10) * nights;
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

/** Pure: ChingCommand + /api/builder/init payload → POST /api/trips body. */
export function buildChingTripPayload(command, init) {
  const hotels = init.hotels || [];
  const vehicles = init.vehicles || [];
  const destinations = init.destinations || [];
  const settings = init.settings || {};

  const nights = Math.max(1, Number(command.nights) || 1);
  const days = nights + 1;
  const start = command.startDate;
  const cities = nightlyCities({ ...command, nights }, hotels);
  const lastCity = cities[cities.length - 1] || command.destinationName || "";
  const destinationFor = (city) => destinations.find((d) => sameName(d.name, city));

  // ── Hotels: one accommodation per stay, back to back from the start date.
  const accommodations = [];
  let cursor = start;
  for (const stay of command.stays || []) {
    const hotel = hotels.find((h) => h.id === stay.hotelId);
    if (hotel && stay.nights > 0) accommodations.push(stayAccommodation(stay, hotel, cursor, command));
    cursor = addDays(cursor, stay.nights || 0);
  }

  // ── Day-wise plan: arrival, moves between cities, local days, departure.
  const itineraries = [];
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
    const labels = day === days ? [] : destinationActivityLabels(dest?.activities);
    itineraries.push({
      id: null,
      day_number: day,
      title: `Day ${day}: ${title}`,
      location,
      destination_id: dest?.id ?? null,
      description: labels.join("\n"),
      image: dest?.image_url || dest?.image_path || null,
    });
  }

  // ── Cab: per-trip rate → one booking; otherwise (per day / unset) one per day.
  const vehicle = vehicles.find((v) => v.id === command.vehicleId);
  const transportations = [];
  if (vehicle) {
    const entry = (dayNumber, tripType, route) => ({
      id: null,
      vehicleId: vehicle.id,
      trip_type: tripType,
      destination: cities[dayNumber - 1] ?? lastCity,
      route,
      date: addDays(start, dayNumber - 1),
      vehicle_type: vehicle.name,
      quantity: 1,
      remarks: "",
      day_number: dayNumber,
      markup_percentage: null,
    });
    if (vehicle.rate_type === "per_trip") {
      transportations.push(entry(1, "Transfer", `Full trip: ${[...new Set(cities)].join(" → ")}`));
    } else {
      itineraries.forEach((it) => {
        const route = it.title.replace(/^Day \d+: /, "").replace(" to ", " → ");
        const type = /Sightseeing/.test(route) ? "Sightseeing" : "Transfer";
        transportations.push(entry(it.day_number, type, route));
      });
    }
  }

  // ── Price, identical to the builder: marked-up items, then GST.
  const margin = Number(settings.profit_percentage) || 0;
  const gstPct = Number(settings.gst_percentage) || 0;
  const includeGst = settings.include_gst ?? true;
  const net =
    accommodations.reduce((s, a) => s + hotelCost(a), 0) +
    transportations.reduce((s, t) => s + (parseFloat(vehicle?.price || 0) * (t.quantity || 1)), 0);
  const marked = net * (1 + margin / 100);
  const gst = includeGst ? marked * (gstPct / 100) : 0;

  const place = command.destinationName || [...new Set(cities)].join(" - ") || "Holiday";
  const destination = destinationFor(command.destinationName) || destinationFor(cities[0]);

  return {
    tripTitle: `${place} ${nights}N/${days}D`,
    destination: command.destinationName || cities[0] || "",
    destinationId: command.destinationId ?? destination?.id ?? null,
    clientName: command.clientName,
    clientPhone: command.clientPhone || "",
    clientEmail: command.clientEmail || "",
    adults: command.adults,
    kidsUpto5: command.infants || 0,
    kids5to12: command.children || 0,
    startDate: start,
    duration: String(nights),
    cost: String(Math.max(0, Math.round(marked + gst))),
    currency: settings.currency || "INR (₹)",
    image: settings.default_trip_image_url || destination?.image_url || "",
    tagline: settings.tagline || undefined,
    status: "pending",
    template: "ModernTemplate",
    include_gst: includeGst,
    gst_amount: Number(gst.toFixed(2)),
    gst_percentage: gstPct,
    profit_margin_percentage: margin,
    use_flight: false,
    transport_details: [],
    itineraries,
    accommodations: accommodations.map((a) => ({
      id: null,
      hotelId: a.hotelId,
      name: a.name,
      city: a.city,
      category: a.category,
      rooms: a.rooms,
      cnb_count: a.cnbCount,
      extra_beds_5_to_12_count: a.extraBeds5To12Count,
      extra_beds_above_12_count: a.extraBedsAbove12Count,
      extra_adult_count: a.extraAdultCount,
      meal_plan: a.mealPlan,
      room_type: a.roomType,
      price_per_room: a.pricePerRoom,
      bed_prices: a.bedPrices,
      check_in: a.checkIn,
      check_out: a.checkOut,
      image: a.photo,
      cancelled_at: null,
      cancellation_charge: null,
      cancellation_note: null,
      alternate_options: [],
      markup_percentage: null,
    })),
    transportations,
    trip_activities: [],
    other_costs: [],
    inclusions: [],
    exclusions: [],
  };
}

/** Save a confirmed command as a real trip. Resolves to { tripId }. */
export async function createChingTrip({ token, command, init }) {
  const created = await createTrip(token, buildChingTripPayload(command, init));
  const tripId = created?.trip_id || created?.tripId;
  if (!tripId) throw new Error("The trip was not created. Please try again.");
  return { tripId };
}
