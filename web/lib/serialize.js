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
    meal_plan: a.mealPlan,
    room_type: a.roomType,
    price_per_room: num(a.pricePerRoom),
    bed_prices: a.bedPrices ?? [],
    check_in: dateOnly(a.checkIn),
    check_out: dateOnly(a.checkOut),
    image_path: a.imagePath,
    image_url: a.imagePath,
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
  return { id: h.id, name: h.name, city: h.city, price_sections: h.priceSections ?? [], image_path: h.imagePath, image_url: h.imagePath };
}
export function serializeVehicle(v) {
  return { id: v.id, name: v.name, price: num(v.price) };
}

const userLite = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

// --- Management (catalog page) full shapes, including owner + timestamps ---
export function catalogDestination(d) {
  return {
    id: d.id, user_id: d.userId, name: d.name, activities: d.activities ?? [],
    image_path: d.imagePath, image_url: d.imagePath, user: userLite(d.user),
    created_at: iso(d.createdAt), updated_at: iso(d.updatedAt),
  };
}
export function catalogHotel(h) {
  return {
    id: h.id, user_id: h.userId, name: h.name, city: h.city, email: h.email, phone: h.phone,
    price_sections: h.priceSections ?? [], image_path: h.imagePath, image_url: h.imagePath,
    user: userLite(h.user), created_at: iso(h.createdAt), updated_at: iso(h.updatedAt),
  };
}
export function catalogVehicle(v) {
  return {
    id: v.id, user_id: v.userId, name: v.name, email: v.email, phone: v.phone, price: num(v.price),
    user: userLite(v.user), created_at: iso(v.createdAt), updated_at: iso(v.updatedAt),
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
    greetingMessage: s.greetingMessage,
    confirmationMessage: s.confirmationMessage,
    confirmationPdfMessage: s.confirmationPdfMessage,
    paymentVoucherEmailMessage: s.paymentVoucherEmailMessage,
    invoiceEmailMessage: s.invoiceEmailMessage,
    confirmationHeroImage: s.confirmationHeroImage,
    defaultTripImage: s.defaultTripImagePath,
    gstPercentage: num(s.gstPercentage),
    profitMarginPercentage: num(s.profitMarginPercentage),
    smtpEmail: s.smtpEmail,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpEncryption: s.smtpEncryption || "tls",
    hasSmtpPassword: !!s.smtpAppPassword,
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
  smtpEmail: null,
  smtpHost: null,
  smtpPort: 587,
  smtpEncryption: "tls",
  hasSmtpPassword: false,
};
