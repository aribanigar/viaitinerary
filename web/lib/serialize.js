// Convert Prisma records (camelCase) into the snake_case JSON shapes the
// React frontend reads (the API's response contract).

const num = (d) => (d == null ? null : Number(d));
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);

/** Extract a currency symbol from strings like "INR (₹)" / "USD ($)". */
export function currencySymbol(currency) {
  if (!currency) return "₹";
  const m = String(currency).match(/\((.*?)\)/);
  return m ? m[1].trim() : String(currency).trim();
}

export function serializeTripRevision(r) {
  return {
    id: r.id,
    version_number: r.versionNumber,
    trigger: r.trigger,
    change_summary: r.changeSummary ?? [],
    created_at: iso(r.createdAt),
  };
}

export function serializeItinerary(it) {
  return {
    id: it.id,
    day_number: it.dayNumber,
    title: it.title,
    location: it.location,
    description: it.description,
    image_path: it.imagePath,
    image_url: it.imagePath,
  };
}

export function serializeAccommodation(a) {
  return {
    id: a.id,
    hotel_id: a.hotelId,
    name: a.name,
    city: a.city,
    category: a.category,
    rooms: a.rooms,
    cnb_count: a.cnbCount,
    extra_beds_5_to_12_count: a.extraBeds5To12Count,
    extra_beds_above_12_count: a.extraBedsAbove12Count,
    extra_adult_count: a.extraAdultCount ?? 0,
    meal_plan: a.mealPlan,
    room_type: a.roomType,
    price_per_room: num(a.pricePerRoom),
    bed_prices: a.bedPrices ?? [],
    check_in: dateOnly(a.checkIn),
    check_out: dateOnly(a.checkOut),
    image_path: a.imagePath,
    image_url: a.imagePath,
    cancelled_at: iso(a.cancelledAt),
    cancellation_charge: num(a.cancellationCharge),
    cancellation_note: a.cancellationNote ?? null,
    alternate_options: a.alternateOptions ?? [],
    markup_percentage: num(a.markupPercentage),
    supplier_status: a.supplierStatus ?? null,
    supplier_token: a.supplierToken ?? null,
    supplier_requested_at: iso(a.supplierRequestedAt),
    supplier_responded_at: iso(a.supplierRespondedAt),
    supplier_ref: a.supplierRef ?? null,
    supplier_note: a.supplierNote ?? null,
    hotel: a.hotel ? { id: a.hotel.id, name: a.hotel.name, city: a.hotel.city, email: a.hotel.email ?? null, phone: a.hotel.phone ?? null } : null,
  };
}

export function serializeTransportation(t) {
  return {
    id: t.id,
    vehicle_id: t.vehicleId,
    trip_type: t.tripType,
    destination: t.destination,
    route: t.route,
    date: dateOnly(t.date),
    vehicle_type: t.vehicleType,
    quantity: t.quantity,
    remarks: t.remarks,
    markup_percentage: num(t.markupPercentage),
    supplier_status: t.supplierStatus ?? null,
    supplier_token: t.supplierToken ?? null,
    supplier_requested_at: iso(t.supplierRequestedAt),
    supplier_responded_at: iso(t.supplierRespondedAt),
    supplier_ref: t.supplierRef ?? null,
    supplier_note: t.supplierNote ?? null,
    driver_name: t.driverName ?? null,
    driver_phone: t.driverPhone ?? null,
    vehicle_number: t.vehicleNumber ?? null,
    vehicle: t.vehicle ? { id: t.vehicle.id, name: t.vehicle.name, price: num(t.vehicle.price), email: t.vehicle.email ?? null, phone: t.vehicle.phone ?? null } : null,
  };
}

export function serializeTripActivity(a) {
  return {
    id: a.id,
    activity_id: a.activityId,
    name: a.name,
    location: a.location ?? null,
    day_number: a.dayNumber,
    ticket_count: a.ticketCount,
    price_per_ticket: num(a.pricePerTicket),
    child_count: a.childCount ?? 0,
    child_price: num(a.childPrice),
    cost_per_ticket: num(a.costPerTicket),
    child_cost: num(a.childCost),
    rate_option: a.rateOption ?? null,
    total_cost: num(a.pricePerTicket) * (a.ticketCount ?? 1) + (num(a.childPrice) || 0) * (a.childCount ?? 0),
    markup_percentage: num(a.markupPercentage),
    notes: a.notes,
    activity: a.activity ? { id: a.activity.id, name: a.activity.name, selling_price: num(a.activity.sellingPrice) } : null,
  };
}

export function serializeTrip(trip) {
  if (!trip) return null;
  return {
    id: trip.id,
    trip_id: trip.tripId,
    trip_title: trip.tripTitle,
    destination: trip.destination,
    destination_id: trip.destinationId,
    client_name: trip.clientName,
    client_phone: trip.clientPhone,
    client_email: trip.clientEmail,
    adults: trip.adults,
    kids_cnb: trip.kidsCnb,
    kids_5_to_12: trip.kids5to12,
    start_date: dateOnly(trip.startDate),
    duration: trip.duration,
    cost: num(trip.cost),
    gst_amount: num(trip.gstAmount),
    gst_percentage: num(trip.gstPercentage),
    profit_margin_percentage: num(trip.profitMarginPercentage),
    paid_amount: num(trip.paidAmount),
    refunded_amount: num(trip.refundedAmount),
    currency: trip.currency,
    currency_symbol: currencySymbol(trip.currency),
    image_path: trip.imagePath,
    image_url: trip.imagePath,
    status: trip.status,
    template: trip.template,
    slug: trip.slug,
    is_package: trip.isPackage ?? false,
    locked: trip.locked ?? false,
    include_gst: trip.includeGst,
    use_flight: trip.useFlight,
    tagline: trip.tagline,
    inclusions: trip.inclusions ?? [],
    exclusions: trip.exclusions ?? [],
    other_costs: trip.otherCosts ?? [],
    transport_details: trip.transportDetails ?? [],
    proposal_token: trip.proposalToken ?? null,
    proposal_sent_at: iso(trip.proposalSentAt),
    proposal_viewed_at: iso(trip.proposalViewedAt),
    proposal_view_count: trip.proposalViewCount ?? 0,
    proposal_response: trip.proposalResponse ?? null,
    proposal_responded_at: iso(trip.proposalRespondedAt),
    proposal_message: trip.proposalMessage ?? null,
    proposal_responder: trip.proposalResponder ?? null,
    created_at: iso(trip.createdAt),
    updated_at: iso(trip.updatedAt),
    itineraries: (trip.itineraries ?? []).map(serializeItinerary),
    accommodations: (trip.accommodations ?? []).map(serializeAccommodation),
    transportations: (trip.transportations ?? []).map(serializeTransportation),
    trip_activities: (trip.tripActivities ?? []).map(serializeTripActivity),
  };
}

export function serializeSettings(s) {
  if (!s) return null;
  return {
    id: s.id,
    agency_name: s.agencyName,
    contact_phone: s.contactPhone,
    contact_email: s.contactEmail,
    whatsapp: s.whatsapp,
    website: s.website,
    company_address: s.companyAddress,
    brand_color: s.brandColor,
    secondary_color: s.secondaryColor,
    font_family: s.fontFamily,
    logo_path: s.logoPath,
    logo_url: s.logoPath,
    tagline: s.tagline,
    greeting_message: s.greetingMessage,
    confirmation_message: s.confirmationMessage,
    beneficiary_name: s.beneficiaryName,
    bank_name: s.bankName,
    account_number: s.accountNumber,
    ifsc_code: s.ifscCode,
    currency: s.currency || "INR (₹)",
    default_trip_image_path: s.defaultTripImagePath,
    default_trip_image_url: s.defaultTripImagePath,
    gst_percentage: num(s.gstPercentage),
    profit_percentage: num(s.profitMarginPercentage),
    include_gst: s.includeGst,
  };
}

// --- Builder/init lite shapes ---
export function serializeDestination(d) {
  return {
    id: d.id, name: d.name, activities: d.activities ?? [],
    country: d.country ?? null, state: d.state ?? null, city: d.city ?? null,
    image_path: d.imagePath, image_url: d.imagePath,
  };
}
export function serializeActivityLite(a) {
  return {
    id: a.id, name: a.name, destination_id: a.destinationId ?? null,
    selling_price: num(a.sellingPrice), duration_hours: num(a.durationHours),
    // For the Trip Builder's activity picker (priced like a hotel's rate sheet).
    cost: num(a.cost), child_price: num(a.childPrice), child_cost: num(a.childCost),
    price_sections: a.priceSections ?? [], category: a.category ?? null,
    city: a.city ?? null, image_url: a.imagePath ?? null, description: a.description ?? null,
  };
}
export function serializeHotel(h) {
  return {
    id: h.id, name: h.name, city: h.city, category: h.category,
    is_available: h.isAvailable ?? true,
    // Map pin, when the agency set one — Ching uses it to order a trip's hotels by road distance.
    latitude: h.latitude ?? null, longitude: h.longitude ?? null,
    price_sections: h.priceSections ?? [], image_path: h.imagePath, image_url: h.imagePath,
  };
}
export function serializeVehicle(v) {
  return {
    id: v.id, name: v.name, price: num(v.price), rate_type: v.rateType ?? null,
    // For Ching's auto-pick (smallest available cab that seats the group).
    seating_capacity: v.seatingCapacity ?? null, vehicle_type: v.vehicleType ?? null, is_available: v.isAvailable ?? true,
  };
}

const userLite = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

// --- Management (catalog page) full shapes, including owner + timestamps ---
export function catalogDestination(d) {
  return {
    id: d.id, user_id: d.userId, name: d.name, activities: d.activities ?? [],
    country: d.country ?? null, state: d.state ?? null, city: d.city ?? null,
    image_path: d.imagePath, image_url: d.imagePath, user: userLite(d.user),
    created_at: iso(d.createdAt), updated_at: iso(d.updatedAt),
  };
}
export function catalogComplementaryService(s) {
  return {
    id: s.id, user_id: s.userId, name: s.name, cost: num(s.cost),
    selling_price: num(s.sellingPrice), description: s.description,
    is_active: s.isActive ?? true, user: userLite(s.user),
    created_at: iso(s.createdAt), updated_at: iso(s.updatedAt),
  };
}
export function catalogActivity(a) {
  return {
    id: a.id, user_id: a.userId, destination_id: a.destinationId ?? null,
    destination_name: a.destination?.name ?? null,
    name: a.name, description: a.description, cost: num(a.cost),
    selling_price: num(a.sellingPrice), duration_hours: num(a.durationHours),
    is_active: a.isActive ?? true,
    image_path: a.imagePath ?? null, image_url: a.imagePath ?? null,
    category: a.category ?? null, supplier_name: a.supplierName ?? null,
    email: a.email ?? null, phone: a.phone ?? null, address: a.address ?? null,
    city: a.city ?? null, state: a.state ?? null, country: a.country ?? null,
    child_cost: num(a.childCost), child_price: num(a.childPrice),
    price_sections: a.priceSections ?? [], capacity_per_day: a.capacityPerDay ?? null,
    inclusions: a.inclusions ?? null, cancellation_policy: a.cancellationPolicy ?? null,
    blackouts: Array.isArray(a.blackouts) ? a.blackouts.map(catalogActivityBlackout) : undefined,
    user: userLite(a.user),
    created_at: iso(a.createdAt), updated_at: iso(a.updatedAt),
  };
}
export function catalogActivityBlackout(b) {
  return {
    id: b.id, activity_id: b.activityId, type: b.type,
    start_date: dateOnly(b.startDate), end_date: dateOnly(b.endDate), note: b.note,
  };
}
export function catalogHotel(h) {
  return {
    id: h.id, user_id: h.userId, name: h.name, address: h.address, city: h.city, state: h.state, country: h.country,
    category: h.category, is_available: h.isAvailable ?? true, email: h.email, phone: h.phone,
    latitude: num(h.latitude), longitude: num(h.longitude),
    price_sections: h.priceSections ?? [], image_path: h.imagePath, image_url: h.imagePath,
    total_rooms: h.totalRooms ?? null, request_count: h.requestCount ?? 0,
    last_requested_at: iso(h.lastRequestedAt),
    market_prices: h.marketPrices ?? [], payment_terms: h.paymentTerms ?? null,
    external_source: h.externalSource ?? null, external_id: h.externalId ?? null,
    last_synced_at: iso(h.lastSyncedAt),
    blackouts: Array.isArray(h.blackouts) ? h.blackouts.map(catalogHotelBlackout) : undefined,
    user: userLite(h.user), created_at: iso(h.createdAt), updated_at: iso(h.updatedAt),
  };
}
export function catalogHotelBlackout(b) {
  return {
    id: b.id, hotel_id: b.hotelId, room_type: b.roomType, type: b.type,
    start_date: dateOnly(b.startDate), end_date: dateOnly(b.endDate), note: b.note,
    created_at: iso(b.createdAt),
  };
}
export function catalogVehicle(v) {
  return {
    id: v.id, user_id: v.userId, name: v.name, email: v.email, phone: v.phone, price: num(v.price),
    vehicle_type: v.vehicleType, is_ac: v.isAc, seating_capacity: v.seatingCapacity ?? null,
    luggage_capacity: v.luggageCapacity ?? null, fuel_type: v.fuelType, registration_number: v.registrationNumber,
    city: v.city, state: v.state, country: v.country, is_available: v.isAvailable ?? true,
    image_path: v.imagePath, image_url: v.imagePath, rate_type: v.rateType,
    extra_km_rate: num(v.extraKmRate), extra_hour_rate: num(v.extraHourRate),
    driver_allowance: num(v.driverAllowance), night_halt_charges: num(v.nightHaltCharges),
    min_km_per_day: v.minKmPerDay ?? null, toll_parking_included: v.tollParkingIncluded,
    features: v.features ?? [], notes: v.notes,
    request_count: v.requestCount ?? 0, last_requested_at: iso(v.lastRequestedAt),
    blackouts: Array.isArray(v.blackouts) ? v.blackouts.map(catalogVehicleBlackout) : undefined,
    user: userLite(v.user), created_at: iso(v.createdAt), updated_at: iso(v.updatedAt),
  };
}
export function catalogVehicleBlackout(b) {
  return {
    id: b.id, vehicle_id: b.vehicleId, type: b.type,
    start_date: dateOnly(b.startDate), end_date: dateOnly(b.endDate), note: b.note,
    created_at: iso(b.createdAt),
  };
}

// --- /settings camelCase shape (GET /api/settings) ---
export function settingsToCamel(s) {
  return {
    agencyName: s.agencyName,
    phone: s.contactPhone,
    website: s.website,
    companyAddress: s.companyAddress,
    email: s.contactEmail,
    whatsapp: s.whatsapp,
    brandColor: s.brandColor,
    secondaryColor: s.secondaryColor,
    fontFamily: s.fontFamily,
    logo: s.logoPath,
    beneficiaryName: s.beneficiaryName,
    bankName: s.bankName,
    accountNumber: s.accountNumber,
    ifscCode: s.ifscCode,
    currency: s.currency || "INR (₹)",
    greetingMessage: s.greetingMessage,
    confirmationMessage: s.confirmationMessage,
    confirmationPdfMessage: s.confirmationPdfMessage,
    paymentVoucherEmailMessage: s.paymentVoucherEmailMessage,
    invoiceEmailMessage: s.invoiceEmailMessage,
    confirmationHeroImage: s.confirmationHeroImage,
    defaultTripImage: s.defaultTripImagePath,
    gstPercentage: num(s.gstPercentage),
    profitMarginPercentage: num(s.profitMarginPercentage),
    costActivities: s.costActivities ?? false,
    smtpEmail: s.smtpEmail,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpEncryption: s.smtpEncryption || "tls",
    hasSmtpPassword: !!s.smtpAppPassword,
    googleMapsApiKey: s.googleMapsApiKey || "",
    razorpayKeyId: s.razorpayKeyId || "",
    hasRazorpaySecret: !!s.razorpayKeySecret, // the secret itself never leaves the server
    upiId: s.upiId || "",
    advancePercentage: s.advancePercentage == null ? null : num(s.advancePercentage),
    balanceDueDays: s.balanceDueDays ?? 15,
    autoConfirmOnPayment: s.autoConfirmOnPayment ?? true,
    followUpsEnabled: s.followUpsEnabled ?? true,
    followUpAfterHours: s.followUpAfterHours ?? 24,
    maxFollowUps: s.maxFollowUps ?? 2,
    paymentRemindersEnabled: s.paymentRemindersEnabled ?? true,
    paymentReminderAfterDays: s.paymentReminderAfterDays ?? 2,
    supplierRemindersEnabled: s.supplierRemindersEnabled ?? true,
    preArrivalEnabled: s.preArrivalEnabled ?? true,
    driverDetailsEnabled: s.driverDetailsEnabled ?? true,
    feedbackRequestsEnabled: s.feedbackRequestsEnabled ?? true,
    reviewUrl: s.reviewUrl || "",
  };
}

export const SETTINGS_DEFAULTS = {
  agencyName: "TravelAgency",
  phone: "+1 234 567 890",
  website: "www.youragency.com",
  companyAddress: "",
  email: "contact@agency.com",
  whatsapp: "+1 234 567 890",
  brandColor: "#F4A229",
  secondaryColor: "#0D2D2D",
  fontFamily: "Montserrat",
  logo: null,
  beneficiaryName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  currency: "INR (₹)",
  greetingMessage:
    "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.",
  confirmationMessage:
    "Thank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.",
  confirmationPdfMessage:
    "Thank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.",
  paymentVoucherEmailMessage:
    "Dear {clientName},\n\nThank you for your payment of {currencySymbol}{paymentAmount}. Please find your payment receipt attached below.\n\nRegards,\n{agencyName}",
  invoiceEmailMessage:
    "Dear {clientName},\n\nPlease find your invoice attached for trip {tripId}.\n\nRegards,\n{agencyName}",
  confirmationHeroImage: null,
  defaultTripImage: null,
  gstPercentage: 5.0,
  profitMarginPercentage: 10.0,
  costActivities: false,
  smtpEmail: null,
  smtpHost: null,
  smtpPort: 587,
  smtpEncryption: "tls",
  hasSmtpPassword: false,
  googleMapsApiKey: "",
  razorpayKeyId: "",
  hasRazorpaySecret: false,
  upiId: "",
  advancePercentage: 30,
  balanceDueDays: 15,
  autoConfirmOnPayment: true,
  followUpsEnabled: true,
  followUpAfterHours: 24,
  maxFollowUps: 2,
  paymentRemindersEnabled: true,
  paymentReminderAfterDays: 2,
  supplierRemindersEnabled: true,
  preArrivalEnabled: true,
  driverDetailsEnabled: true,
  feedbackRequestsEnabled: true,
  reviewUrl: "",
};
