// Convert Prisma records (camelCase) into the snake_case JSON shapes the
// existing React frontend expects from the original Laravel API.

const num = (d) => (d == null ? null : Number(d));
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const iso = (d) => (d ? new Date(d).toISOString() : null);

/** Extract a currency symbol from strings like "INR (₹)" / "USD ($)". */
export function currencySymbol(currency) {
  if (!currency) return "₹";
  const m = String(currency).match(/\((.*?)\)/);
  return m ? m[1].trim() : String(currency).trim();
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
    hotel: a.hotel ? { id: a.hotel.id, name: a.hotel.name, city: a.hotel.city } : null,
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
    vehicle: t.vehicle ? { id: t.vehicle.id, name: t.vehicle.name, price: num(t.vehicle.price) } : null,
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
    created_at: iso(trip.createdAt),
    updated_at: iso(trip.updatedAt),
    itineraries: (trip.itineraries ?? []).map(serializeItinerary),
    accommodations: (trip.accommodations ?? []).map(serializeAccommodation),
    transportations: (trip.transportations ?? []).map(serializeTransportation),
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
  return { id: d.id, name: d.name, activities: d.activities ?? [], image_path: d.imagePath, image_url: d.imagePath };
}
export function serializeHotel(h) {
  return {
    id: h.id, name: h.name, city: h.city, category: h.category,
    is_available: h.isAvailable ?? true,
    price_sections: h.priceSections ?? [], image_path: h.imagePath, image_url: h.imagePath,
  };
}
export function serializeVehicle(v) {
  return { id: v.id, name: v.name, price: num(v.price) };
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

// --- /settings camelCase shape (matches AgencySettingsController::show) ---
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
};
