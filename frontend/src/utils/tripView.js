// Saved trip (API, snake_case) → the Trip Builder's in-memory shapes, which
// are exactly what ModernTemplate/ClassicTemplate render. Shared by the Trip
// Builder and the public client proposal page so both read a trip the same way.

/** Absolute URL for a stored image path (data:/http URLs pass through). */
export function formatTripImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;

  // Clean up the path (remove leading slashes)
  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  // Construct base URL from API_URL (removing /api and any trailing slashes)
  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:8000/api"
  ).replace(/\/$/, ""); // Remove trailing slash if any

  return `${apiBase}/storage/${cleanPath}`;
}

/** Fill the extra-bed / cancellation fields from either shape (and legacy rows). */
export function normalizeAccommodation(item = {}) {
  const legacyCnbSelected =
    (item.extraBedCategory || item.extra_bed_category) === "cnb";
  const legacyAbove12Selected =
    (item.extraBedCategory || item.extra_bed_category) === "above_12";
  const cnbCount =
    item.cnbCount ??
    item.cnb_count ??
    (legacyCnbSelected ? item.beds || "0" : "0");
  const extraBeds5To12Count =
    item.extraBeds5To12Count ??
    item.extra_beds_5_to_12_count ??
    (!legacyCnbSelected && !legacyAbove12Selected ? item.beds || "0" : "0");
  const extraBedsAbove12Count =
    item.extraBedsAbove12Count ??
    item.extra_beds_above_12_count ??
    (legacyAbove12Selected ? item.beds || "0" : "0");

  return {
    ...item,
    cnbCount,
    extraBeds5To12Count,
    extraBedsAbove12Count,
    extraAdultCount: item.extraAdultCount ?? item.extra_adult_count ?? "0",
    cancelledAt: item.cancelledAt ?? item.cancelled_at ?? null,
    cancellationCharge: item.cancellationCharge ?? item.cancellation_charge ?? "",
    cancellationNote: item.cancellationNote ?? item.cancellation_note ?? "",
    alternateOptions: item.alternateOptions ?? item.alternate_options ?? [],
    markupPercentage: item.markupPercentage ?? item.markup_percentage ?? "",
  };
}

/** /api/builder/init `settings` → the templates' `agencySettings`. */
export function mapAgencySettings(settings, configuredDefaultTripImage) {
  return {
    agencyName: settings.agency_name,
    phone: settings.contact_phone,
    website: settings.website,
    companyAddress: settings.company_address || "",
    email: settings.contact_email,
    whatsapp: settings.whatsapp,
    brandColor: settings.brand_color,
    secondaryColor: settings.secondary_color,
    fontFamily: settings.font_family,
    logo: settings.logo_url || settings.logo_path,
    tagline:
      settings.tagline ||
      "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
    greetingMessage: settings.greeting_message,
    beneficiaryName: settings.beneficiary_name,
    bankName: settings.bank_name || settings.bankName,
    accountNumber: settings.account_number,
    ifscCode: settings.ifsc_code,
    currency: settings.currency || "INR (₹)",
    defaultTripImage: configuredDefaultTripImage || null,
  };
}

/** /api/builder/init `policies` → the templates' `policies`. */
export function mapPolicies(policies) {
  return {
    termsConditions: policies.terms_conditions || "",
    mustHaves: policies.must_haves || "",
    rolesResponsibilities:
      policies.roles_responsibilities || "",
    cancellationPolicy: policies.cancellation_policy || "",
    additionalExpenses: policies.additional_expenses || "",
    defaultInclusions: policies.default_inclusions || [],
    defaultExclusions: policies.default_exclusions || [],
  };
}

/**
 * `initData.trip` → { tripInfo, includeGST, inclusions, exclusions, otherCosts,
 * itinerary, accommodations, transportation, tripActivities, gstPercentage,
 * profitMarginPercentage }, or null when there is no trip.
 */
export function mapSavedTrip(
  initData,
  { formatImageUrl = formatTripImageUrl, configuredDefaultTripImage = "" } = {},
) {
  const savedTrip = initData.trip;
  if (!savedTrip) return null;
  const out = {};
  out.tripInfo = {
    tripId: savedTrip.trip_id || savedTrip.tripId,
    tripTitle: savedTrip.trip_title || savedTrip.tripTitle,
    destination: savedTrip.destination || "",
    destinationId:
      savedTrip.destination_id || savedTrip.destinationId || null,
    clientName: savedTrip.client_name || savedTrip.clientName,
    clientPhone: savedTrip.client_phone || savedTrip.clientPhone || "",
    clientEmail: savedTrip.client_email || savedTrip.clientEmail || "",
    locked: savedTrip.locked ?? false,
    adults: savedTrip.adults || 2,
    kidsUpto5: savedTrip.kids_cnb || 0,
    kids5to12: savedTrip.kids_5_to_12 || 0,
    startDate:
      savedTrip.start_date ||
      savedTrip.startDate ||
      new Date().toISOString().split("T")[0],
    duration: savedTrip.duration,
    cost: savedTrip.cost || "0",
    currency:
      savedTrip.currency || initData.settings?.currency || "INR (₹)",
    image:
      formatImageUrl(
        savedTrip.image_url || savedTrip.image_path || savedTrip.image,
      ) ||
      configuredDefaultTripImage ||
      "",
    status: savedTrip.status,
    template: savedTrip.template || "ModernTemplate",
    useFlight: savedTrip.use_flight ?? false,
    tagline:
      savedTrip.tagline ||
      initData.settings?.tagline ||
      "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
    transportDetails: (savedTrip.transport_details || []).map(
      (transport) => ({
        ...transport,
        departureDateTime: transport.departure_date_time
          ? new Date(
              new Date(transport.departure_date_time).getTime() -
                new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)
          : "",
        arrivalDateTime: transport.arrival_date_time
          ? new Date(
              new Date(transport.arrival_date_time).getTime() -
                new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)
          : "",
      }),
    ),
  };

  out.includeGST = savedTrip.include_gst ?? true;
  out.inclusions = savedTrip.inclusions || [];
  out.exclusions = savedTrip.exclusions || [];

  if (savedTrip.other_costs) {
    out.otherCosts = (
      (typeof savedTrip.other_costs === "string"
        ? JSON.parse(savedTrip.other_costs)
        : savedTrip.other_costs) || []
    ).map((c, idx) => ({
      id: c.id || Date.now() + idx,
      name: c.name || "",
      price: c.price || 0,
    }));
  } else {
    out.otherCosts = [];
  }

  const mappedItinerary = (
    savedTrip.itineraries ||
    savedTrip.itinerary ||
    []
  ).map((item) => ({
    id: item.id,
    day: item.day_number || item.day,
    title: item.title,
    location: item.location,
    destinationId:
      item.destination_id ||
      (initData.destinations || []).find((d) => d.name === item.location)?.id ||
      null,
    description: item.description,
    activities:
      item.description && typeof item.description === "string"
        ? item.description.split("\n").filter((a) => a.trim() !== "")
        : [],
    photo: formatImageUrl(
      item.image_url || item.image_path || item.photo,
    ),
  }));
  out.itinerary = mappedItinerary;

  const mappedAccommodations = (savedTrip.accommodations || []).map(
    (item) =>
      normalizeAccommodation({
        id: item.id,
        hotelId: item.hotel_id || item.hotelId,
        name: item.hotel?.name ?? item.name,
        city: item.hotel?.city ?? item.city,
        category: item.category,
        rooms: item.rooms || "1",
        mealPlan: item.meal_plan || item.mealPlan,
        roomType: item.room_type || item.roomType || "Deluxe",
        pricePerRoom: item.price_per_room || item.pricePerRoom || "",
        cnbCount: item.cnb_count || item.cnbCount || "0",
        extraBeds5To12Count:
          item.extra_beds_5_to_12_count ||
          item.extraBeds5To12Count ||
          "0",
        extraBedsAbove12Count:
          item.extra_beds_above_12_count ||
          item.extraBedsAbove12Count ||
          "0",
        bedPrices: item.bed_prices || item.bedPrices || [],
        checkIn: item.check_in || item.checkIn,
        checkOut: item.check_out || item.checkOut,
        photo: formatImageUrl(
          item.image_url || item.image_path || item.photo,
        ),
        extra_adult_count: item.extra_adult_count,
        cancelled_at: item.cancelled_at,
        cancellation_charge: item.cancellation_charge,
        cancellation_note: item.cancellation_note,
        alternate_options: item.alternate_options,
        markup_percentage: item.markup_percentage,
      }),
  );
  out.accommodations = mappedAccommodations;

  const mappedTransportation = (
    savedTrip.transportations ||
    savedTrip.transportation ||
    []
  ).map((item) => ({
    id: item.id,
    vehicleId: item.vehicle_id || item.vehicleId,
    tripType: item.trip_type || item.tripType || "Transfer",
    destination: item.destination,
    route: item.route,
    date: item.date,
    vehicleType: item.vehicle_type || item.vehicleType,
    quantity: item.quantity || 1,
    remarks: item.remarks,
    markupPercentage: item.markup_percentage ?? item.markupPercentage ?? "",
  }));
  out.transportation = mappedTransportation;

  const mappedTripActivities = (savedTrip.trip_activities || []).map(
    (item) => ({
      id: item.id,
      activityId: item.activity_id ?? item.activityId ?? null,
      name: item.name,
      location: item.location || "",
      dayNumber: item.day_number ?? item.dayNumber ?? "",
      ticketCount: item.ticket_count ?? item.ticketCount ?? 1,
      pricePerTicket: item.price_per_ticket ?? item.pricePerTicket ?? "",
      markupPercentage: item.markup_percentage ?? item.markupPercentage ?? "",
      notes: item.notes || "",
    }),
  );
  out.tripActivities = mappedTripActivities;

  // Restore this trip's own GST%/margin% so the Pricing tab shows
  // what was actually quoted. Trips saved before these columns
  // existed have neither stored — fall back to the agency's
  // configured defaults for display only; the auto-cost effect
  // won't touch the trip's saved cost regardless, until the agent
  // edits pricing themselves (see pricingTouched).
  out.gstPercentage = savedTrip.gst_percentage != null
    ? Number(savedTrip.gst_percentage)
    : Number(initData.settings?.gst_percentage ?? 0);
  out.profitMarginPercentage = savedTrip.profit_margin_percentage != null
    ? Number(savedTrip.profit_margin_percentage)
    : Number(initData.settings?.profit_percentage ?? 0);
  return out;
}
