import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

// Phase 3 — operations: supplier confirmations, drivers, the daily board.
//
// A hotel stay or a cab is "requested" from its supplier by email (and/or a
// WhatsApp link the agent sends) carrying a no-login link /s/:token. The
// supplier confirms (with their confirmation number / driver details) or
// declines there. Cabs are booked one row per day, so one request covers all
// the days a vehicle serves on a trip: the token lives on the earliest row and
// a response applies to every row of that vehicle ("siblings").
//
// The public side sees an ALLOWLIST (publicBooking) — never prices, margins or
// the client's contact details.

export const SUPPLIER_STATUSES = ["requested", "confirmed", "declined", "changed"];
export const newSupplierToken = () => crypto.randomBytes(18).toString("base64url");
export const SUPPLIER_TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "").trim()) ? String(c).trim() : "#181c22");

export const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
export function fmtDay(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
const nights = (a) =>
  a.checkIn && a.checkOut ? Math.max(0, Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000)) : 0;
export const isLive = (row) => !row.cancelledAt;

const MEAL = {
  "Only Room": "Room only (EP)",
  "Only Room + Breakfast": "Breakfast (CP)",
  "Breakfast + Dinner": "Breakfast & dinner (MAP)",
  "Breakfast + Lunch + Dinner": "All meals (AP)",
};
export const mealLabel = (m) => MEAL[m] || m || "—";

/** The cab rows one request covers: same trip, same vehicle (by name — per-trip days carry no vehicleId). */
export function cabGroupKey(t) {
  return String(t.vehicleType || t.vehicle?.name || `vehicle-${t.vehicleId || "none"}`).trim().toLowerCase();
}
export function cabGroups(transportations) {
  const groups = new Map();
  for (const t of (transportations || []).slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))) {
    const k = cabGroupKey(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  return [...groups.values()];
}

/** Supplier contact for a booking row (hotel / vehicle catalog entry). */
export function supplierContact(kind, row) {
  const s = kind === "hotel" ? row.hotel : row.vehicle;
  return { email: s?.email || null, phone: s?.phone || null, name: s?.name || row.name || row.vehicleType || null };
}

const guestLine = (trip) => {
  const parts = [`${trip.adults || 0} adult${trip.adults === 1 ? "" : "s"}`];
  if (trip.kids5to12) parts.push(`${trip.kids5to12} child${trip.kids5to12 === 1 ? "" : "ren"} (5–12)`);
  if (trip.kidsCnb) parts.push(`${trip.kidsCnb} child${trip.kidsCnb === 1 ? "" : "ren"} under 5`);
  return parts.join(", ");
};

/** Public, price-free view of one request (hotel stay, or a cab with all its days). */
export function publicBooking({ kind, row, siblings, trip, settings }) {
  const base = {
    kind,
    status: row.supplierStatus || "requested",
    responded_at: row.supplierRespondedAt ? row.supplierRespondedAt.toISOString() : null,
    reference: row.supplierRef || null,
    note: row.supplierNote || null,
    trip_id: trip.tripId,
    guest_name: trip.clientName || "Guest",
    guests: guestLine(trip),
    agency: {
      name: settings?.agencyName || "Travel agency",
      phone: settings?.contactPhone || settings?.whatsapp || null,
      email: settings?.contactEmail || null,
      logo: settings?.logoPath || null,
      brand_color: safeColor(settings?.brandColor),
    },
  };
  if (kind === "hotel") {
    return {
      ...base,
      hotel: row.name || row.hotel?.name || "Hotel",
      city: row.city || row.hotel?.city || null,
      room_type: row.roomType || null,
      rooms: row.rooms || null,
      meal_plan: mealLabel(row.mealPlan),
      check_in: ymd(row.checkIn),
      check_out: ymd(row.checkOut),
      nights: nights(row),
      extra_beds: (row.extraBeds5To12Count || 0) + (row.extraBedsAbove12Count || 0),
      extra_adults: row.extraAdultCount || 0,
      children_no_bed: row.cnbCount || 0,
    };
  }
  const days = (siblings || [row]).filter(isLive).map((t) => ({
    date: ymd(t.date),
    route: t.route || t.destination || "—",
    type: t.tripType || null,
    quantity: t.quantity || 1,
  }));
  const first = (siblings || [row]).find((t) => t.driverName || t.driverPhone || t.vehicleNumber) || row;
  return {
    ...base,
    vehicle: row.vehicleType || row.vehicle?.name || "Vehicle",
    days,
    driver_name: first.driverName || null,
    driver_phone: first.driverPhone || null,
    vehicle_number: first.vehicleNumber || null,
  };
}

/** { subject, html, text } for a supplier request. */
export function supplierRequestEmail({ kind, booking, url, settings, resend = false }) {
  const agency = settings?.agencyName || "Our travel agency";
  const brand = safeColor(settings?.brandColor);
  const rows =
    kind === "hotel"
      ? [
          ["Guest", booking.guest_name],
          ["Guests", booking.guests],
          ["Hotel", booking.hotel],
          ["Check-in", fmtDay(booking.check_in)],
          ["Check-out", fmtDay(booking.check_out)],
          ["Nights", String(booking.nights)],
          ["Room", [booking.rooms && `${booking.rooms} ×`, booking.room_type].filter(Boolean).join(" ") || "—"],
          ["Meal plan", booking.meal_plan],
          ["Extra beds", booking.extra_beds ? String(booking.extra_beds) : ""],
          ["Our reference", booking.trip_id],
        ]
      : [
          ["Guest", booking.guest_name],
          ["Guests", booking.guests],
          ["Vehicle", booking.vehicle],
          ["Days", `${booking.days.length} (${fmtDay(booking.days[0]?.date)} – ${fmtDay(booking.days[booking.days.length - 1]?.date)})`],
          ["Our reference", booking.trip_id],
        ];
  const table = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#666;width:40%">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`)
    .join("");
  const dayRows =
    kind === "cab"
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">${booking.days
          .map((d) => `<tr><td style="padding:5px 0;border-top:1px solid #eee;width:38%">${esc(fmtDay(d.date))}</td><td style="padding:5px 0;border-top:1px solid #eee">${esc(d.route)}</td></tr>`)
          .join("")}</table>`
      : "";
  const what = kind === "hotel" ? `a room booking at ${booking.hotel}` : `a ${booking.vehicle} for ${booking.days.length} day${booking.days.length === 1 ? "" : "s"}`;
  const subject = `${resend ? "Reminder: " : ""}Booking request ${booking.trip_id} — ${kind === "hotel" ? booking.hotel : booking.vehicle} (${agency})`;
  const ask = kind === "hotel" ? "confirm the booking and add your confirmation number" : "confirm and add the driver's name, phone and vehicle number";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#181c22;max-width:560px;line-height:1.5">
    <p>Hello,</p>
    <p>${esc(agency)} would like to book ${esc(what)} for our guest <b>${esc(booking.guest_name)}</b>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">${table}</table>
    ${dayRows}
    <p style="margin:28px 0"><a href="${esc(url)}" style="background:${esc(brand)};color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:bold">Confirm or decline</a></p>
    <p style="font-size:13px;color:#666">One tap — no login needed. Please ${esc(ask)}. If the button doesn't work, open:<br>${esc(url)}</p>
    <p>Thank you,<br>${esc(agency)}${settings?.contactPhone ? `<br>${esc(settings.contactPhone)}` : ""}</p>
  </div>`;
  const text = `${agency} would like to book ${what} for ${booking.guest_name} (${booking.trip_id}). Please confirm or decline here: ${url}`;
  return { subject, html, text };
}

/** WhatsApp text for the same request (the agent sends it from their phone). */
export function supplierWhatsappText({ kind, booking, url, settings }) {
  const agency = settings?.agencyName || "our agency";
  if (kind === "hotel") {
    return `Hello from ${agency}! Booking request for ${booking.guest_name} (${booking.guests}) at ${booking.hotel}: ${fmtDay(booking.check_in)} to ${fmtDay(booking.check_out)}, ${booking.rooms || 1} × ${booking.room_type || "room"}, ${booking.meal_plan}. Ref ${booking.trip_id}. Please confirm here (one tap): ${url}`;
  }
  return `Hello from ${agency}! Cab request for ${booking.guest_name}: ${booking.vehicle}, ${booking.days.length} day${booking.days.length === 1 ? "" : "s"} from ${fmtDay(booking.days[0]?.date)}. Ref ${booking.trip_id}. Please confirm with driver details here: ${url}`;
}

const waLink = (phone, text) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}` : null;
};

/**
 * Request confirmations for a trip's bookings.
 * opts: { kinds: ["hotel","cab"], ids?: { hotel: [id], cab: [id] }, email: bool, origin, mailer, settings, force }
 * → [{ kind, id, name, date, status, emailed, email, phone, link, whatsapp_url, error? }]
 * Already-confirmed bookings are skipped unless `force`.
 */
export async function requestSupplierConfirmations(trip, opts) {
  const { kinds = ["hotel", "cab"], ids = null, email = true, origin, mailer, settings, force = false } = opts;
  const out = [];
  const now = new Date();
  const want = (kind, id) => !ids || !ids[kind] || ids[kind].map(Number).includes(Number(id));

  const send = async (kind, lead, siblings) => {
    const already = lead.supplierStatus === "confirmed" && !force;
    let token = lead.supplierToken;
    if (!token) {
      token = newSupplierToken();
      await (kind === "hotel" ? prisma.accommodation : prisma.transportation).update({ where: { id: lead.id }, data: { supplierToken: token } });
      lead.supplierToken = token;
    }
    const url = `${origin}/s/${token}`;
    const booking = publicBooking({ kind, row: lead, siblings, trip, settings });
    const contact = supplierContact(kind, lead);
    const row = {
      kind,
      id: lead.id,
      ids: siblings.map((s) => s.id),
      name: kind === "hotel" ? booking.hotel : booking.vehicle,
      date: kind === "hotel" ? booking.check_in : booking.days[0]?.date || null,
      status: lead.supplierStatus || null,
      email: contact.email,
      phone: contact.phone,
      link: url,
      whatsapp_url: waLink(contact.phone, supplierWhatsappText({ kind, booking, url, settings })),
      emailed: false,
    };
    if (already) {
      row.skipped = "already confirmed";
      out.push(row);
      return;
    }
    if (email && mailer && contact.email) {
      try {
        const msg = supplierRequestEmail({ kind, booking, url, settings, resend: lead.supplierStatus === "requested" });
        await sendMail(mailer, { to: contact.email, ...msg });
        row.emailed = true;
      } catch (err) {
        row.error = `Email failed: ${err.message}`;
      }
    }
    // A re-send of an open request is a reminder: count it (the daily cron
    // stops after MAX_SUPPLIER_REMINDERS) and keep the original request time.
    const resend = lead.supplierStatus === "requested" && !!lead.supplierRequestedAt;
    const data = resend
      ? { supplierReminderCount: (lead.supplierReminderCount || 0) + 1, supplierLastReminderAt: now }
      : { supplierStatus: "requested", supplierRequestedAt: now, supplierReminderCount: 0, supplierLastReminderAt: null };
    const model = kind === "hotel" ? prisma.accommodation : prisma.transportation;
    await model.updateMany({ where: { id: { in: siblings.map((s) => s.id) }, tripId: trip.id }, data });
    row.status = "requested";
    out.push(row);
  };

  if (kinds.includes("hotel")) {
    for (const a of trip.accommodations.filter(isLive)) {
      if (want("hotel", a.id)) await send("hotel", a, [a]);
    }
  }
  if (kinds.includes("cab")) {
    for (const group of cabGroups(trip.transportations.filter(isLive))) {
      if (group.some((t) => want("cab", t.id))) await send("cab", group[0], group);
    }
  }
  return out;
}

/**
 * The driver's brief for one cab (all its days): guest + phone, pickup, day-wise
 * route with the night's hotel, and the agency's emergency contact. Plain text
 * for WhatsApp → { text, whatsapp_url } (url only when the driver's phone is known).
 */
export function driverBrief(trip, group, settings) {
  const days = (group || []).filter(isLive).slice().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const lead = days[0] || {};
  const stays = (trip.accommodations || []).filter(isLive);
  const hotelOn = (date) => {
    const d = ymd(date);
    const a = stays.find((x) => ymd(x.checkIn) <= d && ymd(x.checkOut) > d);
    return a ? `${a.name}${a.city ? `, ${a.city}` : ""}` : null;
  };
  const lines = [
    `Namaste ${lead.driverName || ""}! Trip details from ${settings?.agencyName || "the agency"}:`.replace("  ", " "),
    `Guest: ${trip.clientName || "Guest"} (${guestLine(trip)})${trip.clientPhone ? ` · ${trip.clientPhone}` : ""}`,
    `Vehicle: ${lead.vehicleType || lead.vehicle?.name || "—"}${lead.vehicleNumber ? ` ${lead.vehicleNumber}` : ""}`,
    `Ref: ${trip.tripId}`,
    "",
    ...days.map((t) => {
      const hotel = hotelOn(t.date);
      return `${fmtDay(t.date)}: ${t.route || t.destination || "—"}${hotel ? ` (stay: ${hotel})` : ""}`;
    }),
    "",
    `Emergency / agency: ${settings?.contactPhone || settings?.whatsapp || "—"}`,
    "Please confirm you have received this. Thank you!",
  ];
  const text = lines.join("\n");
  return { text, whatsapp_url: waLink(lead.driverPhone, text) };
}

/** Find a booking by its supplier token → { kind, row, siblings, trip } or null. */
export async function bookingByToken(token) {
  const include = { trip: { include: { transportations: { include: { vehicle: true } } } } };
  const acc = await prisma.accommodation.findUnique({ where: { supplierToken: token }, include: { ...include, hotel: true } });
  if (acc) return { kind: "hotel", row: acc, siblings: [acc], trip: acc.trip };
  const cab = await prisma.transportation.findUnique({ where: { supplierToken: token }, include: { ...include, vehicle: true } });
  if (!cab) return null;
  const key = cabGroupKey(cab);
  const siblings = cab.trip.transportations
    .filter((t) => cabGroupKey(t) === key)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return { kind: "cab", row: cab, siblings: siblings.length ? siblings : [cab], trip: cab.trip };
}

/**
 * Fields whose change means a requested/confirmed booking must be re-confirmed
 * (lib/trips.js syncTripRelations marks it "changed").
 */
export function bookingChanged(kind, before, after) {
  const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const s = (v) => String(v ?? "").trim();
  if (kind === "hotel") {
    return (
      d(before.checkIn) !== d(after.checkIn) ||
      d(before.checkOut) !== d(after.checkOut) ||
      String(before.hotelId ?? "") !== String(after.hotelId ?? "") ||
      s(before.rooms) !== s(after.rooms) ||
      s(before.roomType) !== s(after.roomType) ||
      s(before.mealPlan) !== s(after.mealPlan) ||
      (!!before.cancelledAt) !== (!!after.cancelledAt)
    );
  }
  return d(before.date) !== d(after.date) || s(before.vehicleType) !== s(after.vehicleType) || s(before.route) !== s(after.route);
}

// ── daily operations board ───────────────────────────────────────────────

const addDaysYmd = (ymdStr, n) => {
  const [y, m, dd] = ymdStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};
export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const tripLite = (t) => {
  const start = ymd(t.startDate);
  const n = Number(t.duration) || 0;
  return {
    trip_id: t.tripId,
    title: t.tripTitle,
    client_name: t.clientName,
    client_phone: t.clientPhone,
    guests: (t.adults || 0) + (t.kids5to12 || 0) + (t.kidsCnb || 0),
    start_date: start,
    end_date: start && n ? addDaysYmd(start, n) : start,
    status: t.status,
  };
};

/**
 * The operations board for `from` (YYYY-MM-DD) and the next `days` days:
 * { days: [{ date, arrivals, departures, checkins, checkouts, cabs }],
 *   confirmations: [...not yet confirmed, next 30 days],
 *   unpaid: [...balance due, next 30 days / in progress], counts }
 */
export async function operationsBoard(adminId, { from = todayIST(), days = 1 } = {}) {
  const span = Math.min(Math.max(Number(days) || 1, 1), 14);
  const to = addDaysYmd(from, span - 1);
  const horizon = addDaysYmd(from, 30);
  const trips = await prisma.trip.findMany({
    where: {
      userId: adminId,
      isPackage: false,
      status: { notIn: ["cancelled", "rejected"] },
      startDate: { gte: new Date(`${addDaysYmd(from, -45)}T00:00:00Z`), lte: new Date(`${horizon}T23:59:59Z`) },
    },
    include: { accommodations: { include: { hotel: true } }, transportations: { include: { vehicle: true } } },
    orderBy: { startDate: "asc" },
  });
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });

  const dayList = [];
  for (let i = 0; i < span; i += 1) {
    dayList.push({ date: addDaysYmd(from, i), arrivals: [], departures: [], checkins: [], checkouts: [], cabs: [] });
  }
  const byDate = new Map(dayList.map((d) => [d.date, d]));
  const confirmations = [];
  const unpaid = [];

  for (const t of trips) {
    const lite = tripLite(t);
    if (!lite.start_date) continue;
    const inWindow = lite.end_date >= from && lite.start_date <= horizon;
    if (!inWindow) continue;
    byDate.get(lite.start_date)?.arrivals.push(lite);
    if (lite.end_date !== lite.start_date) byDate.get(lite.end_date)?.departures.push(lite);

    for (const a of t.accommodations.filter(isLive)) {
      const row = {
        trip: lite,
        id: a.id,
        hotel: a.name,
        city: a.city,
        rooms: a.rooms,
        room_type: a.roomType,
        meal_plan: mealLabel(a.mealPlan),
        check_in: ymd(a.checkIn),
        check_out: ymd(a.checkOut),
        status: a.supplierStatus || null,
        reference: a.supplierRef || null,
      };
      byDate.get(row.check_in)?.checkins.push(row);
      byDate.get(row.check_out)?.checkouts.push(row);
      if (a.supplierStatus !== "confirmed" && row.check_out >= from) {
        const c = supplierContact("hotel", a);
        confirmations.push({ kind: "hotel", trip: lite, id: a.id, name: a.name, date: row.check_in, status: a.supplierStatus || null, requested_at: a.supplierRequestedAt?.toISOString() || null, email: c.email, phone: c.phone });
      }
    }
    for (const group of cabGroups(t.transportations.filter(isLive))) {
      const brief = driverBrief(t, group, settings);
      for (const c of group) {
        const date = ymd(c.date);
        byDate.get(date)?.cabs.push({
          trip: lite,
          id: c.id,
          route: c.route,
          type: c.tripType,
          vehicle: c.vehicleType || c.vehicle?.name || null,
          driver_name: c.driverName || null,
          driver_phone: c.driverPhone || null,
          vehicle_number: c.vehicleNumber || null,
          status: c.supplierStatus || null,
          driver_brief_url: c.driverPhone ? waLink(c.driverPhone, brief.text) : null,
        });
      }
      const lead = group[0];
      const last = ymd(group[group.length - 1].date);
      if (lead.supplierStatus !== "confirmed" && (!last || last >= from)) {
        const sc = supplierContact("cab", lead);
        confirmations.push({ kind: "cab", trip: lite, id: lead.id, name: lead.vehicleType || lead.vehicle?.name || "Cab", date: ymd(lead.date), days: group.length, status: lead.supplierStatus || null, requested_at: lead.supplierRequestedAt?.toISOString() || null, email: sc.email, phone: sc.phone });
      }
    }
    const cost = Number(t.cost || 0);
    const paid = Number(t.paidAmount || 0) - Number(t.refundedAmount || 0);
    if (cost > 0 && paid < cost - 0.5) unpaid.push({ trip: lite, cost, paid, balance: Math.round((cost - paid) * 100) / 100 });
  }

  confirmations.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  unpaid.sort((a, b) => String(a.trip.start_date).localeCompare(String(b.trip.start_date)));
  const today = dayList[0];
  return {
    from,
    to,
    days: dayList,
    confirmations,
    unpaid,
    counts: {
      arrivals: today.arrivals.length,
      departures: today.departures.length,
      checkins: today.checkins.length,
      cabs: today.cabs.length,
      cabs_without_driver: today.cabs.filter((c) => !c.driver_name).length,
      awaiting_confirmation: confirmations.length,
      declined: confirmations.filter((c) => c.status === "declined").length,
      unpaid: unpaid.length,
    },
  };
}
