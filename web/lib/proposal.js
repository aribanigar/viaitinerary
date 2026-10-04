import crypto from "crypto";
import prisma from "@/lib/prisma";
import { currencySymbol } from "@/lib/serialize";

// Client proposal links (/p/:token). The page is public — anyone holding the
// link can open it — so everything served there is built from an ALLOWLIST of
// what the itinerary templates display. Never pass serializeTrip() output
// through: it carries room rates, markups, margin, vehicle prices and payments.

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);
const num = (v) => (v == null ? null : Number(v));

/** 32 url-safe chars, ~190 bits: unguessable, so the link itself is the key. */
export const newProposalToken = () => crypto.randomBytes(24).toString("base64url");

/** Give the trip a proposal token if it has none (or a fresh one). */
export async function ensureProposalToken(trip, { regenerate = false } = {}) {
  if (trip.proposalToken && !regenerate) return trip.proposalToken;
  const proposalToken = newProposalToken();
  await prisma.trip.update({ where: { id: trip.id }, data: { proposalToken } });
  return proposalToken;
}

/** Agent-facing proposal status (for the builder / trip list). */
export function proposalStatus(trip) {
  return {
    token: trip.proposalToken ?? null,
    path: trip.proposalToken ? `/p/${trip.proposalToken}` : null,
    sent_at: iso(trip.proposalSentAt),
    viewed_at: iso(trip.proposalViewedAt),
    view_count: trip.proposalViewCount ?? 0,
    response: trip.proposalResponse ?? null,
    responded_at: iso(trip.proposalRespondedAt),
    message: trip.proposalMessage ?? null,
    responder: trip.proposalResponder ?? null,
  };
}

/** Trip (with TRIP_INCLUDE) → the public, price-free shape mapSavedTrip reads. */
export function publicTrip(trip) {
  return {
    trip_id: trip.tripId,
    trip_title: trip.tripTitle,
    destination: trip.destination,
    destination_id: trip.destinationId,
    client_name: trip.clientName,
    adults: trip.adults,
    kids_cnb: trip.kidsCnb,
    kids_5_to_12: trip.kids5to12,
    start_date: dateOnly(trip.startDate),
    duration: trip.duration,
    cost: num(trip.cost),
    currency: trip.currency,
    currency_symbol: currencySymbol(trip.currency),
    image_url: trip.imagePath,
    status: trip.status,
    template: trip.template,
    include_gst: trip.includeGst,
    use_flight: trip.useFlight,
    tagline: trip.tagline,
    inclusions: trip.inclusions ?? [],
    exclusions: trip.exclusions ?? [],
    transport_details: trip.transportDetails ?? [],
    itineraries: (trip.itineraries || []).map((it) => ({
      id: it.id,
      day_number: it.dayNumber,
      title: it.title,
      location: it.location,
      destination_id: it.destinationId,
      description: it.description,
      image_url: it.imagePath,
    })),
    accommodations: (trip.accommodations || [])
      .filter((a) => !a.cancelledAt)
      .map((a) => ({
        id: a.id,
        name: a.hotel?.name ?? a.name,
        city: a.hotel?.city ?? a.city,
        category: a.category,
        rooms: a.rooms,
        cnb_count: a.cnbCount,
        extra_beds_5_to_12_count: a.extraBeds5To12Count,
        extra_beds_above_12_count: a.extraBedsAbove12Count,
        extra_adult_count: a.extraAdultCount ?? 0,
        meal_plan: a.mealPlan,
        room_type: a.roomType,
        check_in: dateOnly(a.checkIn),
        check_out: dateOnly(a.checkOut),
        image_url: a.imagePath,
      })),
    transportations: (trip.transportations || []).map((t) => ({
      id: t.id,
      trip_type: t.tripType,
      destination: t.destination,
      route: t.route,
      date: dateOnly(t.date),
      vehicle_type: t.vehicleType,
      quantity: t.quantity,
      remarks: t.remarks,
    })),
    trip_activities: (trip.tripActivities || []).map((a) => ({
      id: a.id,
      name: a.name,
      location: a.location ?? null,
      day_number: a.dayNumber,
      ticket_count: a.ticketCount,
      child_count: a.childCount ?? 0,
      notes: a.notes,
    })),
  };
}

/** Agency branding/contact for the public page. Bank details are included
 * because the templates' payment section prints them (as the PDF does); SMTP,
 * API keys and pricing defaults are not. */
export function publicSettings(s) {
  if (!s) return {};
  return {
    agency_name: s.agencyName,
    contact_phone: s.contactPhone,
    contact_email: s.contactEmail,
    whatsapp: s.whatsapp,
    website: s.website,
    company_address: s.companyAddress,
    brand_color: s.brandColor,
    secondary_color: s.secondaryColor,
    font_family: s.fontFamily,
    logo_url: s.logoPath,
    tagline: s.tagline,
    greeting_message: s.greetingMessage,
    beneficiary_name: s.beneficiaryName,
    bank_name: s.bankName,
    account_number: s.accountNumber,
    ifsc_code: s.ifscCode,
    currency: s.currency || "INR (₹)",
    default_trip_image_url: s.defaultTripImagePath,
  };
}

/** Policies the templates print (terms, must-haves, cancellation…). */
export function publicPolicies(p) {
  if (!p) return null;
  const flat = (v) => (Array.isArray(v) ? v.join("\n") : v ?? "");
  return {
    terms_conditions: flat(p.termsConditions),
    must_haves: flat(p.mustHaves),
    roles_responsibilities: flat(p.rolesResponsibilities),
    cancellation_policy: flat(p.cancellationPolicy),
    additional_expenses: flat(p.additionalExpenses),
    default_inclusions: p.defaultInclusions ?? [],
    default_exclusions: p.defaultExclusions ?? [],
  };
}
