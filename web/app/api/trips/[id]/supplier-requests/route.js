import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { mailerForAdminId } from "@/lib/mailer";
import { appOrigin } from "@/lib/followups";
import {
  requestSupplierConfirmations,
  cabGroups,
  isLive,
  publicBooking,
  supplierContact,
  supplierWhatsappText,
  ymd,
} from "@/lib/operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadTrip(request, params) {
  const user = await userFromRequest(request);
  if (!user) return { error: NextResponse.json({ message: "Unauthenticated." }, { status: 401 }) };
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { trip, adminId };
}

const waLink = (phone, text) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}` : null;
};

// GET /api/trips/:tripId/supplier-requests — every hotel stay and cab (grouped
// by vehicle, with its days) and where its supplier confirmation stands.
export async function GET(request, { params }) {
  const { trip, adminId, error } = await loadTrip(request, params);
  if (error) return error;
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
  const origin = appOrigin(request);
  const link = (row) => (row.supplierToken ? `${origin}/s/${row.supplierToken}` : null);

  const hotels = trip.accommodations
    .filter(isLive)
    .sort((a, b) => new Date(a.checkIn || 0) - new Date(b.checkIn || 0))
    .map((a) => {
      const c = supplierContact("hotel", a);
      const url = link(a);
      return {
        kind: "hotel",
        id: a.id,
        name: a.name,
        city: a.city,
        check_in: ymd(a.checkIn),
        check_out: ymd(a.checkOut),
        status: a.supplierStatus || null,
        requested_at: a.supplierRequestedAt?.toISOString() || null,
        responded_at: a.supplierRespondedAt?.toISOString() || null,
        reference: a.supplierRef || null,
        note: a.supplierNote || null,
        email: c.email,
        phone: c.phone,
        link: url,
        whatsapp_url: url ? waLink(c.phone, supplierWhatsappText({ kind: "hotel", booking: publicBooking({ kind: "hotel", row: a, trip, settings }), url, settings })) : null,
      };
    });
  const cabs = cabGroups(trip.transportations.filter(isLive)).map((group) => {
    const lead = group[0];
    const c = supplierContact("cab", lead);
    const url = link(lead);
    return {
      kind: "cab",
      id: lead.id,
      name: lead.vehicleType || lead.vehicle?.name || "Cab",
      status: lead.supplierStatus || null,
      requested_at: lead.supplierRequestedAt?.toISOString() || null,
      responded_at: lead.supplierRespondedAt?.toISOString() || null,
      reference: lead.supplierRef || null,
      note: lead.supplierNote || null,
      email: c.email,
      phone: c.phone,
      link: url,
      whatsapp_url: url ? waLink(c.phone, supplierWhatsappText({ kind: "cab", booking: publicBooking({ kind: "cab", row: lead, siblings: group, trip, settings }), url, settings })) : null,
      days: group.map((t) => ({
        id: t.id,
        date: ymd(t.date),
        route: t.route,
        driver_name: t.driverName || null,
        driver_phone: t.driverPhone || null,
        vehicle_number: t.vehicleNumber || null,
      })),
    };
  });
  return NextResponse.json({ hotels, cabs, client_phone: trip.clientPhone, client_name: trip.clientName });
}

// POST /api/trips/:tripId/supplier-requests { kinds?: ["hotel","cab"], ids?: { hotel: [], cab: [] }, email?: true, force?: false }
// Creates the confirm links, emails suppliers that have an email (agency SMTP),
// marks the bookings "requested" and returns WhatsApp links for the rest.
export async function POST(request, { params }) {
  const { trip, adminId, error } = await loadTrip(request, params);
  if (error) return error;
  const b = await request.json().catch(() => ({}));
  const kinds = (Array.isArray(b.kinds) ? b.kinds : ["hotel", "cab"]).filter((k) => k === "hotel" || k === "cab");
  if (!kinds.length) return NextResponse.json({ message: "Nothing to request." }, { status: 422 });
  const { settings, mailer } = await mailerForAdminId(adminId);
  const rows = await requestSupplierConfirmations(trip, {
    kinds,
    ids: b.ids && typeof b.ids === "object" ? b.ids : null,
    email: b.email !== false,
    origin: appOrigin(request),
    mailer,
    settings,
    force: !!b.force,
  });
  const sent = rows.filter((r) => !r.skipped);
  const emailed = sent.filter((r) => r.emailed).length;
  const whatsappOnly = sent.filter((r) => !r.emailed && r.whatsapp_url).length;
  const parts = [];
  if (emailed) parts.push(`${emailed} emailed`);
  if (whatsappOnly) parts.push(`${whatsappOnly} to send on WhatsApp`);
  const noContact = sent.filter((r) => !r.emailed && !r.whatsapp_url).length;
  if (noContact) parts.push(`${noContact} with no supplier email or phone — copy the link`);
  return NextResponse.json({
    message: sent.length
      ? `Booking requests: ${parts.join(", ")}.${!mailer && b.email !== false ? " (Email isn't set up in Settings.)" : ""}`
      : rows.length
        ? "Everything is already confirmed."
        : "This trip has no hotel or cab bookings yet.",
    requests: rows,
  });
}
