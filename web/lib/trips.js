import prisma from "@/lib/prisma";
import { persistImage } from "@/lib/storage";
import { bookingChanged } from "@/lib/operations";

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

// Trip column → the request keys that set it (for partial updates).
const SCALAR_SOURCES = {
  tripTitle: ["tripTitle"],
  destination: ["destination"],
  destinationId: ["destinationId"],
  clientName: ["clientName"],
  clientPhone: ["clientPhone"],
  clientEmail: ["clientEmail"],
  adults: ["adults"],
  kidsCnb: ["kidsUpto5", "kids_cnb"],
  kids5to12: ["kids5to12", "kids_5_to_12"],
  startDate: ["startDate"],
  duration: ["duration"],
  cost: ["cost"],
  gstAmount: ["gst_amount"],
  gstPercentage: ["gst_percentage"],
  profitMarginPercentage: ["profit_margin_percentage"],
  currency: ["currency"],
  template: ["template"],
  status: ["status"],
  includeGst: ["include_gst"],
  useFlight: ["useFlight", "use_flight"],
  tagline: ["tagline"],
  hotelPackageNames: ["hotelPackageNames", "hotel_package_names"],
  inclusions: ["inclusions"],
  exclusions: ["exclusions"],
  otherCosts: ["other_costs"],
  transportDetails: ["transport_details", "transportDetails"],
};

// Up to 10 short names. Not an array → undefined (column left as is; Prisma
// rejects a plain null on Json columns). Templates fall back to "Package A".
const packageNames = (value) =>
  Array.isArray(value) ? value.slice(0, 10).map((n) => String(n ?? "").trim().slice(0, 40)) : undefined;

/**
 * Map the builder payload to Trip scalar columns (excludes user/team/tripId).
 * `partial: true` (updates) writes only the columns whose keys are in the
 * body — e.g. My Trips' `{ status }` change must not blank the client name,
 * dates and price, and the builder no longer re-sends a stale status.
 */
export async function buildTripScalars(body, { partial = false } = {}) {
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
    gstPercentage: dec(body.gst_percentage),
    profitMarginPercentage: dec(body.profit_margin_percentage),
    currency: body.currency ?? "INR (Rs)",
    template: body.template ?? "ModernTemplate",
    status: body.status ?? "pending",
    includeGst: body.include_gst ?? true,
    useFlight: body.useFlight ?? body.use_flight ?? false,
    tagline: body.tagline ?? null,
    hotelPackageNames: packageNames(body.hotelPackageNames ?? body.hotel_package_names),
    inclusions: body.inclusions ?? [],
    exclusions: body.exclusions ?? [],
    otherCosts: body.other_costs ?? [],
    transportDetails: body.transport_details ?? body.transportDetails ?? [],
  };
  if (body.refunded_amount !== undefined) data.refundedAmount = dec(body.refunded_amount) ?? 0;
  if (partial) {
    for (const [col, keys] of Object.entries(SCALAR_SOURCES)) {
      if (!keys.some((k) => body[k] !== undefined)) delete data[col];
    }
  }
  const img = await imageValue(body.image, "trips");
  if (img !== undefined) data.imagePath = img;
  return data;
}

/** Sync a trip's children: delete the ones no longer sent, upsert the rest. */
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
    const existingAcc = new Map(
      (await prisma.accommodation.findMany({ where: { tripId: tripDbId, supplierStatus: { not: null } } })).map((a) => [a.id, a]),
    );
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
        extraAdultCount: int(item.extra_adult_count, 0),
        mealPlan: item.meal_plan ?? null,
        roomType: item.room_type ?? "Deluxe",
        checkIn: parseDate(item.check_in),
        checkOut: parseDate(item.check_out),
        pricePerRoom: dec(item.price_per_room),
        bedPrices: item.bed_prices ?? [],
        cancelledAt: item.cancelled_at !== undefined ? parseDate(item.cancelled_at) : undefined,
        cancellationCharge: item.cancellation_charge !== undefined ? dec(item.cancellation_charge) : undefined,
        cancellationNote: item.cancellation_note !== undefined ? item.cancellation_note : undefined,
        alternateOptions: item.alternate_options !== undefined ? item.alternate_options : undefined,
        markupPercentage: item.markup_percentage !== undefined ? dec(item.markup_percentage) : undefined,
      };
      const img = await imageValue(item.image, "accommodations");
      if (img !== undefined) data.imagePath = img;
      if (typeof item.id === "number") {
        // A booking the hotel was asked to confirm (or confirmed) changed → re-confirm.
        const before = existingAcc.get(item.id);
        if (before && ["requested", "confirmed"].includes(before.supplierStatus) && bookingChanged("hotel", before, { ...before, ...data, cancelledAt: data.cancelledAt === undefined ? before.cancelledAt : data.cancelledAt })) {
          data.supplierStatus = "changed";
        }
        await prisma.accommodation.update({ where: { id: item.id }, data });
      } else {
        await prisma.accommodation.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }

  // Transportations
  if (Array.isArray(body.transportations)) {
    const keepIds = body.transportations.map((i) => i.id).filter((v) => typeof v === "number");
    const existingCab = new Map(
      (await prisma.transportation.findMany({ where: { tripId: tripDbId, supplierStatus: { not: null } } })).map((t) => [t.id, t]),
    );
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
        markupPercentage: item.markup_percentage !== undefined ? dec(item.markup_percentage) : undefined,
      };
      if (typeof item.id === "number") {
        const before = existingCab.get(item.id);
        if (before && ["requested", "confirmed"].includes(before.supplierStatus) && bookingChanged("cab", before, { ...before, ...data })) {
          data.supplierStatus = "changed";
        }
        await prisma.transportation.update({ where: { id: item.id }, data });
      } else {
        await prisma.transportation.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }

  // Trip Activities
  if (Array.isArray(body.tripActivities ?? body.trip_activities)) {
    const items = body.tripActivities ?? body.trip_activities;
    const keepIds = items.map((i) => i.id).filter((v) => typeof v === "number");
    await prisma.tripActivity.deleteMany({
      where: { tripId: tripDbId, id: { notIn: keepIds.length ? keepIds : [-1] } },
    });
    for (const item of items) {
      const activityId = item.activityId ?? item.activity_id ?? null;
      const data = {
        activityId: activityId ? int(activityId, null) : null,
        name: item.name ?? "Activity",
        location: item.location ? String(item.location).trim() || null : null,
        dayNumber: item.day_number !== undefined && item.day_number !== "" ? int(item.day_number, null) : null,
        ticketCount: int(item.ticket_count, 1) || 1,
        pricePerTicket: dec(item.price_per_ticket) ?? 0,
        // Children and the B2B cost (absent from older clients → left as stored).
        childCount: item.child_count !== undefined ? Math.max(0, int(item.child_count, 0) || 0) : undefined,
        childPrice: item.child_price !== undefined ? dec(item.child_price) : undefined,
        costPerTicket: item.cost_per_ticket !== undefined ? dec(item.cost_per_ticket) : undefined,
        childCost: item.child_cost !== undefined ? dec(item.child_cost) : undefined,
        rateOption: item.rate_option !== undefined ? (item.rate_option ? String(item.rate_option) : null) : undefined,
        markupPercentage: item.markup_percentage !== undefined ? dec(item.markup_percentage) : undefined,
        notes: item.notes ?? null,
      };
      if (typeof item.id === "number") {
        await prisma.tripActivity.update({ where: { id: item.id }, data });
      } else {
        await prisma.tripActivity.create({ data: { ...data, tripId: tripDbId } });
      }
    }
  }
}

const TRIP_INCLUDE = {
  itineraries: { orderBy: { dayNumber: "asc" } },
  accommodations: { include: { hotel: true } },
  transportations: { include: { vehicle: true } },
  tripActivities: { include: { activity: true } },
};

export { TRIP_INCLUDE };

/** Nested `create` payload to clone a trip's children (itineraries/logistics). */
export function cloneTripChildren(src) {
  return {
    itineraries: {
      create: (src.itineraries || []).map((i) => ({
        dayNumber: i.dayNumber,
        title: i.title,
        location: i.location,
        description: i.description,
        imagePath: i.imagePath,
      })),
    },
    accommodations: {
      create: (src.accommodations || []).map((a) => ({
        hotelId: a.hotelId,
        name: a.name,
        city: a.city,
        category: a.category,
        rooms: a.rooms,
        beds: a.beds,
        cnbCount: a.cnbCount,
        extraBeds5To12Count: a.extraBeds5To12Count,
        extraBedsAbove12Count: a.extraBedsAbove12Count,
        mealPlan: a.mealPlan,
        roomType: a.roomType,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        pricePerRoom: a.pricePerRoom,
        bedPrices: a.bedPrices ?? [],
        imagePath: a.imagePath,
        extraAdultCount: a.extraAdultCount,
        alternateOptions: a.alternateOptions ?? [],
        markupPercentage: a.markupPercentage,
        // Cancellation state is a booking-event fact about the *original*
        // trip's stay, not reusable config — a fresh clone starts
        // un-cancelled (cancelledAt/cancellationCharge/cancellationNote
        // intentionally omitted, defaulting to null).
      })),
    },
    transportations: {
      create: (src.transportations || []).map((t) => ({
        vehicleId: t.vehicleId,
        tripType: t.tripType,
        destination: t.destination,
        route: t.route,
        date: t.date,
        vehicleType: t.vehicleType,
        quantity: t.quantity,
        remarks: t.remarks,
        markupPercentage: t.markupPercentage,
      })),
    },
    tripActivities: {
      create: (src.tripActivities || []).map((a) => ({
        activityId: a.activityId,
        name: a.name,
        location: a.location,
        dayNumber: a.dayNumber,
        ticketCount: a.ticketCount,
        pricePerTicket: a.pricePerTicket,
        childCount: a.childCount ?? 0,
        childPrice: a.childPrice,
        costPerTicket: a.costPerTicket,
        childCost: a.childCost,
        rateOption: a.rateOption,
        markupPercentage: a.markupPercentage,
        notes: a.notes,
      })),
    },
  };
}
