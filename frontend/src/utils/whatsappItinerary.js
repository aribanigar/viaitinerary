import { addDays, format, isValid, parseISO } from "date-fns";

export const DEFAULT_GREETING =
  "Greetings from {agencyName}! Thank you for your interest. Please find below the itinerary for your {tripTitle}.";
export const DEFAULT_CLOSING =
  "Please review the plan and let us know if you would like any changes. We will be happy to customise it for you.";

const stripHtml = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export const toLines = (value) =>
  stripHtml(value)
    .split("\n")
    .map((line) => line.replace(/^[\s•\-*✅❌]+/, "").trim())
    .filter(Boolean);

// "INR (₹)" -> "₹"; anything without brackets is used as is.
export const currencySymbol = (currency) => {
  const match = String(currency || "").match(/\(([^)]+)\)/);
  return match ? match[1] : String(currency || "₹").trim();
};

const formatMoney = (amount, currency) => {
  const n = Math.round(Number(amount) || 0);
  return `${currencySymbol(currency)}${n.toLocaleString("en-IN")}`;
};

// Accepts "2026-12-10" and the API's "10-12-2026"; returns "2026-12-10".
const toIso = (value) => {
  const s = String(value || "").slice(0, 10);
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

const toDate = (value) => {
  const iso = toIso(value);
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;

export const fillPlaceholders = (text, values) =>
  String(text || "").replace(/\{(\w+)\}/g, (all, key) =>
    values[key] != null && values[key] !== "" ? values[key] : all,
  );

export const totalTravellers = (form) =>
  (Number(form.adults) || 0) + (Number(form.children) || 0);

// Builds the plain WhatsApp message (WhatsApp renders *bold* and _italic_).
export const buildWhatsAppMessage = (form, agency = {}) => {
  const nights = Math.max(0, Number(form.nights) || 0);
  const days = nights + 1;
  const adults = Number(form.adults) || 0;
  const children = Number(form.children) || 0;
  const pax = adults + children;
  const start = form.withDates ? toDate(form.startDate) : null;
  const tripTitle =
    form.tripTitle?.trim() ||
    (form.destination?.trim() ? `${form.destination.trim()} Tour` : "Trip Itinerary");

  const values = {
    name: form.clientName?.trim() || "Guest",
    agencyName: agency.agencyName || "",
    tripTitle,
    destination: form.destination || "",
  };

  const out = [];
  out.push(`Dear ${values.name},`, "");
  if (form.greeting?.trim()) out.push(fillPlaceholders(form.greeting.trim(), values), "");

  out.push(`*${tripTitle}*`);
  if (form.destination?.trim()) out.push(`📍 Destination: ${form.destination.trim()}`);
  out.push(`🗓️ Duration: ${plural(nights, "Night")} / ${plural(days, "Day")}`);
  if (start) {
    const end = addDays(start, nights);
    out.push(`📅 Travel Dates: ${format(start, "dd MMM yyyy")} to ${format(end, "dd MMM yyyy")}`);
  }
  if (pax > 0) {
    const parts = [plural(adults, "Adult")];
    if (children > 0) parts.push(children === 1 ? "1 Child" : `${children} Children`);
    out.push(`👥 Travellers: ${parts.join(", ")} (${people(pax)})`);
  }

  const price = Number(form.price) || 0;
  if (price > 0) {
    if (form.priceMode === "per_person") {
      out.push(`💰 Package Cost: *${formatMoney(price, form.currency)} per person*`);
      if (pax > 1) out.push(`     (Total ${formatMoney(price * pax, form.currency)} for ${people(pax)})`);
    } else {
      out.push(`💰 Package Cost: *${formatMoney(price, form.currency)} total*${pax > 0 ? ` for ${people(pax)}` : ""}`);
    }
    if (form.priceNote?.trim()) out.push(`     ${form.priceNote.trim()}`);
  }

  const dayList = (form.days || []).filter(
    (d) => d.title?.trim() || d.route?.trim() || d.details?.trim(),
  );
  if (dayList.length) {
    out.push("", "*Day-wise Itinerary*");
    dayList.forEach((day, index) => {
      const date = start ? addDays(start, index) : null;
      const heading = `*Day ${index + 1}${date ? ` (${format(date, "EEE, dd MMM")})` : ""}${day.title?.trim() ? `: ${day.title.trim()}` : ""}*`;
      out.push("", heading);
      if (day.route?.trim()) out.push(`🚗 Route: ${day.route.trim()}`);
      toLines(day.details).forEach((line) => out.push(`• ${line}`));
    });
  }

  const section = (title, text, bullet) => {
    const lines = toLines(text);
    if (!lines.length) return;
    out.push("", `*${title}*`);
    lines.forEach((line) => out.push(`${bullet} ${line}`));
  };
  if (form.showHotels) section("Hotels", form.hotels, "🏨");
  if (form.showInclusions) section("Inclusions", form.inclusions, "✅");
  if (form.showExclusions) section("Exclusions", form.exclusions, "❌");

  if (form.closing?.trim()) out.push("", fillPlaceholders(form.closing.trim(), values));

  out.push("", "Thank you,");
  if (agency.agencyName) out.push(`*${agency.agencyName}*`);
  if (agency.phone) out.push(`📞 ${agency.phone}`);
  if (agency.whatsapp && agency.whatsapp !== agency.phone) out.push(`💬 WhatsApp: ${agency.whatsapp}`);
  if (agency.email) out.push(`✉️ ${agency.email}`);
  if (agency.website) out.push(`🌐 ${agency.website}`);

  return out.join("\n");
};

// wa.me needs digits only, with country code. No number opens WhatsApp's chat picker.
export const whatsappUrl = (phone, text) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

const dayFromItinerary = (item) => ({
  title: item.title || "",
  route: item.location || "",
  details: toLines(item.description).join("\n"),
});

const sortByDay = (list) =>
  [...(list || [])].sort(
    (a, b) => (Number(a.day_number) || 0) - (Number(b.day_number) || 0),
  );

const contentLines = (list) =>
  (list || [])
    .map((i) => (typeof i === "string" ? i : i?.content || ""))
    .filter(Boolean)
    .join("\n");

const hotelLine = (h, nights) => {
  const name = h.hotel?.name ?? h.name;
  if (!name) return null;
  const city = h.hotel?.city ?? h.city;
  const extra = [nights ? `${nights}N` : null, h.meal_plan].filter(Boolean).join(", ");
  return `${city ? `${city}: ` : ""}${name}${extra ? ` (${extra})` : ""}`;
};

// Saved trip (GET /trips/:id) -> form fields.
export const formFromTrip = (trip) => {
  const adults = Number(trip.adults) || 0;
  const children = (Number(trip.kids_cnb) || 0) + (Number(trip.kids_5_to_12) || 0);
  const nights = Number.parseInt(trip.duration, 10);
  const hotels = (trip.accommodations || [])
    .map((h) => {
      const a = toDate(h.check_in);
      const b = toDate(h.check_out);
      const n = a && b ? Math.round((b - a) / 86400000) : null;
      return hotelLine(h, n);
    })
    .filter(Boolean);
  return {
    clientName: trip.client_name || "",
    clientPhone: trip.client_phone || "",
    tripTitle: trip.trip_title || "",
    destination: trip.destination || "",
    adults,
    children,
    nights: Number.isFinite(nights) ? nights : 0,
    startDate: toIso(trip.start_date),
    withDates: !!trip.start_date,
    currency: trip.currency || "INR (₹)",
    priceMode: "total",
    price: Math.round(Number(trip.cost) || 0) || "",
    days: sortByDay(trip.itineraries).map(dayFromItinerary),
    hotels: hotels.join("\n"),
    inclusions: contentLines(trip.inclusions),
    exclusions: contentLines(trip.exclusions),
  };
};

// Package (GET /packages/:code): stored as a trip, so read it like one,
// without the client or dates.
export const formFromPackage = (pkg) => {
  const form = formFromTrip(pkg);
  return {
    ...form,
    clientName: "",
    clientPhone: "",
    adults: form.adults || 2,
    startDate: "",
    withDates: false,
  };
};
