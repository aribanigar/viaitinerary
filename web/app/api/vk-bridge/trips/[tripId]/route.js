import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminIdOf } from "@/lib/scope";
import { currentInternalAccount } from "@/lib/viaKashmirCatalog";
import { accommodationCost, transportationCost } from "@/lib/accounting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/vk-bridge/trips/:tripId  (e.g. TRP669570)
 *
 * Called server-to-server by viakashmir.in when the team converts a lead
 * into a booking ("Import from itinerary builder"). Returns one trip of Via
 * Kashmir's own internal account - client, dates, pax, day plan, every hotel
 * stay / cab / activity with its NET cost (same formulas as the accounting
 * ledger, lib/accounting.js) and the client price. Read-only.
 *
 * Auth: VK_INTERNAL_BRIDGE_SECRET in x-vk-internal-secret (never the DMC
 * secret). Scope: only trips owned by the internal account's tenant - a DMC
 * partner's trips are never reachable here.
 */
function denied(request) {
  const expected = process.env.VK_INTERNAL_BRIDGE_SECRET;
  const provided = request.headers.get("x-vk-internal-secret") || "";
  if (!expected) return NextResponse.json({ message: "Internal bridge not configured." }, { status: 503 });
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  return null;
}

const num = (v) => (v == null ? 0 : Number(v));
const iso = (d) => (d ? new Date(d).toISOString() : null);

export async function GET(request, { params }) {
  const d = denied(request);
  if (d) return d;
  const { tripId } = await params;
  const code = String(tripId || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return NextResponse.json({ message: "Invalid trip id." }, { status: 400 });

  const internal = await currentInternalAccount();
  if (!internal) return NextResponse.json({ message: "No Via Kashmir internal account is set in the builder." }, { status: 503 });
  const owner = await prisma.user.findUnique({ where: { id: internal.id } });
  const tenantId = await adminIdOf(owner);

  const trip = await prisma.trip.findFirst({
    where: { tripId: code, userId: tenantId },
    include: {
      itineraries: { orderBy: { dayNumber: "asc" } },
      accommodations: { include: { hotel: { select: { name: true, city: true, email: true, phone: true, externalSource: true, externalId: true } } }, orderBy: { checkIn: "asc" } },
      transportations: { include: { vehicle: { select: { name: true, price: true, email: true, phone: true, externalSource: true, externalId: true } } }, orderBy: { date: "asc" } },
      tripActivities: { orderBy: { dayNumber: "asc" } },
    },
  });
  if (!trip) return NextResponse.json({ message: `Trip ${code} was not found in the Via Kashmir builder account.` }, { status: 404 });

  const total = num(trip.cost);
  const gst = trip.includeGst ? num(trip.gstAmount) : 0;
  return NextResponse.json({
    trip: {
      tripId: trip.tripId,
      title: trip.tripTitle,
      status: trip.status,
      destination: trip.destination,
      client: { name: trip.clientName, phone: trip.clientPhone, email: trip.clientEmail },
      adults: trip.adults,
      children: num(trip.kidsCnb) + num(trip.kids5to12),
      startDate: iso(trip.startDate),
      duration: trip.duration,
      price: { total, gst, gstPercent: trip.includeGst ? num(trip.gstPercentage) : 0, beforeGst: Math.max(0, total - gst) },
      days: trip.itineraries.map((it, i) => ({ day: it.dayNumber ?? i + 1, title: it.title, location: it.location, description: it.description })),
      hotels: trip.accommodations.map((a) => ({
        name: a.name || a.hotel?.name,
        city: a.city || a.hotel?.city,
        websiteListingId: a.hotel?.externalSource === "viakashmir" ? a.hotel.externalId : null,
        supplierEmail: a.hotel?.email || null,
        supplierPhone: a.hotel?.phone || null,
        checkIn: iso(a.checkIn),
        checkOut: iso(a.checkOut),
        rooms: num(a.rooms) || 1,
        roomType: a.roomType,
        mealPlan: a.mealPlan,
        extraBeds: num(a.extraBeds5To12Count) + num(a.extraBedsAbove12Count) + num(a.extraAdultCount),
        cancelled: !!a.cancelledAt,
        netCost: Math.round(accommodationCost(a) * 100) / 100,
      })),
      cabs: trip.transportations.map((t) => ({
        vehicleType: t.vehicleType || t.vehicle?.name,
        supplierName: t.vehicle?.name || t.vehicleType,
        websiteListingId: t.vehicle?.externalSource === "viakashmir" ? t.vehicle.externalId : null,
        supplierEmail: t.vehicle?.email || null,
        supplierPhone: t.vehicle?.phone || null,
        date: iso(t.date),
        route: t.route || t.destination,
        quantity: t.quantity,
        driver: t.driverName ? { name: t.driverName, phone: t.driverPhone, vehicleNumber: t.vehicleNumber } : null,
        netCost: Math.round(transportationCost(t) * 100) / 100,
      })),
      activities: trip.tripActivities.map((a) => ({
        name: a.name,
        location: a.location,
        day: a.dayNumber,
        tickets: a.ticketCount,
        children: a.childCount,
        netCost: Math.round((num(a.costPerTicket ?? a.pricePerTicket) * num(a.ticketCount) + num(a.childCost ?? a.childPrice) * num(a.childCount)) * 100) / 100,
      })),
      otherCosts: Array.isArray(trip.otherCosts) ? trip.otherCosts : [],
    },
  });
}
