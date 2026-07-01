import prisma from "@/lib/prisma";
import { persistImage } from "@/lib/storage";

/** Parse "YYYY-MM-DD" or "DD-MM-YYYY" (or anything Date understands) to a Date. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/))) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalise an incoming image value and offload data URLs to Supabase Storage.
 *   undefined → undefined (not provided, don't touch)
 *   falsy     → null (explicitly cleared)
 *   data URL  → uploaded, returns public URL
 *   URL       → unchanged
 */
async function imageValue(image, prefix = "trips") {
  if (image === undefined) return undefined;
  if (!image) return null;
  return persistImage(String(image), prefix);
}

const int = (v, d = 0) => (v === undefined || v === null || v === "" ? d : parseInt(v, 10) || d);
const dec = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

/** Map the builder payload to Trip scalar columns (excludes user/team/tripId). */
export async function buildTripScalars(body) {
  const data = {
    tripTitle: body.tripTitle,
    destination: body.destination ?? null,
    destinationId: body.destinationId ? int(body.destinationId, null) : null,
    clientName: body.clientName ?? null,
    clientPhone: body.clientPhone ?? null,
    clientEmail: body.clientEmail ?? null,
    adults: int(body.adults, 2),
    kidsCnb: int(body.kidsUpto5 ?? body.kids_cnb, 0),
    kids5to12: int(body.kids5to12 ?? body.kids_5_to_12, 0),
    startDate: parseDate(body.startDate),
    duration: body.duration != null ? String(body.duration) : null,
    cost: dec(body.cost),
    gstAmount: dec(body.gst_amount) ?? 0,
    currency: body.currency ?? "INR (Rs)",
    template: body.template ?? "ModernTemplate",
    status: body.status ?? "pending",
    includeGst: body.include_gst ?? true,
    useFlight: body.useFlight ?? body.use_flight ?? false,
    tagline: body.tagline ?? null,
    inclusions: body.inclusions ?? [],
    exclusions: body.exclusions ?? [],
    otherCosts: body.other_costs ?? [],
    transportDetails: body.transport_details ?? body.transportDetails ?? [],
  };
  const img = await imageValue(body.image, "trips");
  if (img !== undefined) data.imagePath = img;
  return data;
}

/** Replicate the Laravel syncRelations: delete-missing + upsert each child. */
export async function syncTripRelations(tripDbId, body) {
  // Itineraries
  if (Array.isArray(body.itineraries)) {
    const keepIds = body.itineraries.map((i) => i.id).filter((v) => typeof v === "number");
    await prisma.itinerary.deleteMany({
      where: { tripId: tripDbId, id: { notIn: keepIds.length ? keepIds : [-1] } },
    });
    for (const item of body.itineraries) {
      const data = {
        dayNumber: item.day_number ?? null,
        title: item.title ?? null,
        location: item.location ?? null,
        description: item.description ?? null,
      };
      const img = await imageValue(item.image, "itineraries");
      if (img !== undefined) data.imagePath = img;
      if (typeof item.id === "number") {
        await prisma.itinerary.update({ where: { id: item.id }, data });
      } else {
        await prisma.itinerary.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }

  // Accommodations
  if (Array.isArray(body.accommodations)) {
    const keepIds = body.accommodations.map((i) => i.id).filter((v) => typeof v === "number");
    await prisma.accommodation.deleteMany({
      where: { tripId: tripDbId, id: { notIn: keepIds.length ? keepIds : [-1] } },
    });
    for (const item of body.accommodations) {
      const hotelId = item.hotelId ?? item.hotel_id ?? null;
      const data = {
        hotelId: hotelId ? int(hotelId, null) : null,
        name: item.name ?? "Hotel",
        city: item.city ?? null,
        category: item.category ?? null,
        rooms: item.rooms != null ? String(item.rooms) : null,
        beds: int(item.extra_beds_5_to_12_count, 0) + int(item.extra_beds_above_12_count, 0),
        cnbCount: int(item.cnb_count, 0),
        extraBeds5To12Count: int(item.extra_beds_5_to_12_count, 0),
        extraBedsAbove12Count: int(item.extra_beds_above_12_count, 0),
        mealPlan: item.meal_plan ?? null,
        roomType: item.room_type ?? "Deluxe",
        checkIn: parseDate(item.check_in),
        checkOut: parseDate(item.check_out),
        pricePerRoom: dec(item.price_per_room),
        bedPrices: item.bed_prices ?? [],
      };
      const img = await imageValue(item.image, "accommodations");
      if (img !== undefined) data.imagePath = img;
      if (typeof item.id === "number") {
        await prisma.accommodation.update({ where: { id: item.id }, data });
      } else {
        await prisma.accommodation.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }

  // Transportations
  if (Array.isArray(body.transportations)) {
    const keepIds = body.transportations.map((i) => i.id).filter((v) => typeof v === "number");
    await prisma.transportation.deleteMany({
      where: { tripId: tripDbId, id: { notIn: keepIds.length ? keepIds : [-1] } },
    });
    for (const item of body.transportations) {
      const data = {
        vehicleId: item.vehicleId ?? item.vehicle_id ? int(item.vehicleId ?? item.vehicle_id, null) : null,
        tripType: item.trip_type ?? null,
        destination: item.destination ?? null,
        route: item.route ?? null,
        date: parseDate(item.date),
        vehicleType: item.vehicle_type ?? null,
        quantity: int(item.quantity, 1),
        remarks: item.remarks ?? null,
      };
      if (typeof item.id === "number") {
        await prisma.transportation.update({ where: { id: item.id }, data });
      } else {
        await prisma.transportation.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }
}

const TRIP_INCLUDE = {
  itineraries: { orderBy: { dayNumber: "asc" } },
  accommodations: { include: { hotel: true } },
  transportations: { include: { vehicle: true } },
};

export { TRIP_INCLUDE };
