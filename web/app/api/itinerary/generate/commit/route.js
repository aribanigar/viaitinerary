import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";
import { canCreateTrip, incrementTripsUsed } from "@/lib/subscription";
import { computeItineraryTiers } from "@/lib/itineraryEngine";
import { loadItineraryCatalogs, parseGenerateInput } from "@/lib/itineraryGenerate";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
const TIER_KEYS = ["budget", "recommended", "premium"];

function slugify(s) {
  return String(s || "trip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
const rand = () => Math.random().toString(36).slice(2, 8);
const fmtDate = (d) => (d ? d.toISOString().slice(0, 10) : null);

/** Map one computed tier + the original wizard input onto the exact payload
 * shape `buildTripScalars`/`syncTripRelations` (web/lib/trips.js) expect —
 * the same contract the manual "New Trip" flow already POSTs. */
function tierToTripPayload(tier, input, catalogs) {
  const destName = catalogs.destination.name;
  const nights = tier.nights;
  const checkIn = input.startDate ? new Date(input.startDate) : null;
  const checkOut = checkIn ? new Date(checkIn.getTime() + nights * 86400000) : null;
  const dayCount = tier.activitiesByDay.length;

  const itineraries = tier.activitiesByDay.map((acts, i) => ({
    day_number: i + 1,
    title:
      i === 0
        ? `Day 1: Arrival in ${destName}`
        : i === dayCount - 1
          ? `Day ${i + 1}: Departure`
          : `Day ${i + 1}: ${destName}`,
    location: destName,
    description: acts.join("\n"),
  }));

  const accommodations = tier.hotel
    ? [
        {
          hotelId: tier.hotel.id,
          name: tier.hotel.name,
          city: tier.hotel.city,
          category: tier.hotel.category,
          rooms: String(tier.rooms),
          meal_plan: tier.hotelMealPlan,
          room_type: tier.hotelRoomType || "Deluxe",
          check_in: fmtDate(checkIn),
          check_out: fmtDate(checkOut),
          price_per_room: tier.hotelNightlyPrice,
        },
      ]
    : [];

  const transportations = tier.vehicle
    ? [
        {
          vehicleId: tier.vehicle.id,
          vehicle_type: tier.vehicle.name,
          trip_type: "outstation",
          destination: destName,
          date: fmtDate(checkIn),
          quantity: 1,
          remarks: "Auto-generated for the full trip",
        },
      ]
    : [];

  // Complementary items + (when the agency's costActivities setting is on)
  // activity cost become real "other cost" line items, so the created
  // trip's Pricing tab total matches what was previewed — and each stays a
  // normal, editable/removable row, no new UI needed.
  const otherCosts = [
    ...tier.complementary.map((s) => ({ name: s.name, price: Number(s.selling_price) || 0 })),
    ...(tier.costBreakdown.activityCost > 0
      ? [{ name: "Activities", price: Math.round(tier.costBreakdown.activityCost) }]
      : []),
  ];

  const inclusions = [
    tier.hotel ? { content: `${nights} night${nights === 1 ? "" : "s"} at ${tier.hotel.name}` } : null,
    tier.vehicle ? { content: `Private transport by ${tier.vehicle.name}` } : null,
    ...tier.complementary.map((s) => ({ content: s.name })),
  ].filter(Boolean);

  return {
    tripTitle: `${destName} — ${tier.label} Package`,
    destination: destName,
    destinationId: input.destinationId,
    clientName: input.clientName || null,
    clientPhone: input.clientPhone || null,
    clientEmail: input.clientEmail || null,
    adults: input.adults,
    kidsUpto5: input.kidsCnb,
    kids5to12: input.kids5to12,
    startDate: fmtDate(checkIn),
    duration: String(nights),
    cost: Math.round(tier.costBreakdown.sellingPrice),
    gst_amount: tier.costBreakdown.gstAmount.toFixed(2),
    include_gst: catalogs.includeGst,
    itineraries,
    accommodations,
    transportations,
    other_costs: otherCosts,
    inclusions,
  };
}

/**
 * POST /api/itinerary/generate/commit — recomputes the chosen tier
 * server-side (never trusts a client-supplied plan/cost — generation is
 * deterministic, so recomputing from the same inputs is cheap and safe) and
 * creates a real Trip from it via the same buildTripScalars/syncTripRelations
 * path POST /api/trips uses, including the same subscription gate.
 */
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);
  const teamId = teamIdOf(user);

  const body = await request.json().catch(() => ({}));
  const parsed = parseGenerateInput(body);
  if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 422 });

  const tierKey = TIER_KEYS.includes(body.tier_key) ? body.tier_key : null;
  if (!tierKey) {
    return NextResponse.json({ message: "tier_key must be budget, recommended, or premium." }, { status: 422 });
  }

  const catalogs = await loadItineraryCatalogs(adminId, parsed.data.destinationId);
  if (!catalogs.destination) {
    return NextResponse.json({ message: "Destination not found." }, { status: 404 });
  }

  const gate = await canCreateTrip(user);
  if (!gate.allowed) return NextResponse.json({ message: gate.reason }, { status: gate.status });

  const { tiers } = computeItineraryTiers(parsed.data, catalogs);
  const tier = tiers.find((t) => t.key === tierKey);
  if (!tier) return NextResponse.json({ message: "Could not compute that plan." }, { status: 500 });

  const input = {
    ...parsed.data,
    startDate: body.start_date || null,
    clientName: body.client_name,
    clientPhone: body.client_phone,
    clientEmail: body.client_email,
  };
  const payload = tierToTripPayload(tier, input, catalogs);

  let tripId;
  do {
    tripId = `TRP${Math.floor(100000 + Math.random() * 900000)}`;
  } while (await prisma.trip.findUnique({ where: { tripId } }));

  const scalars = await buildTripScalars(payload);
  const trip = await prisma.trip.create({
    data: {
      ...scalars,
      userId: adminId,
      teamId,
      tripId,
      slug: `${slugify(payload.tripTitle)}-${rand()}`,
    },
  });
  await syncTripRelations(trip.id, payload);
  await incrementTripsUsed(adminId);

  const full = await prisma.trip.findUnique({ where: { id: trip.id }, include: TRIP_INCLUDE });
  return NextResponse.json(serializeTrip(full), { status: 201 });
}
