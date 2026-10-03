import { sendMail } from "@/lib/mailer";
import { renderVouchersPdf } from "@/lib/pdf";
import { fmtDay, ymd, mealLabel } from "@/lib/operations";

// Operations automation (daily cron /api/cron/operations):
//  - supplier reminders: a hotel/cab request still unanswered after 24 h is
//    re-sent (at most MAX_SUPPLIER_REMINDERS times);
//  - pre-arrival: 2 days before a CONFIRMED trip the client gets their
//    vouchers and a short "see you soon" with the first day's plan;
//  - driver details: the day before a cab day, the client gets the driver's
//    name, phone and vehicle (once the supplier/agent has filled them);
//  - feedback: 1–7 days after the trip ends, a thank-you + review request.
// Decisions are pure (`now` / `today` are parameters) so they can be tested.

const HOUR = 3600000;
export const MAX_SUPPLIER_REMINDERS = 2;
export const SUPPLIER_REMINDER_AFTER_HOURS = 24;
export const PRE_ARRIVAL_DAYS = 2;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "").trim()) ? String(c).trim() : "#181c22");
const ms = (d) => (d ? new Date(d).getTime() : null);
const hasEmail = (trip) => !!String(trip?.clientEmail ?? "").trim();
const isConfirmed = (trip) => ["confirmed", "completed"].includes(String(trip?.status || "").toLowerCase());
export const addDaysYmd = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const tripEnd = (trip) => {
  const start = ymd(trip.startDate);
  return start ? addDaysYmd(start, Number(trip.duration) || 0) : null;
};

export function operationsSettings(settings) {
  return {
    supplierReminders: settings?.supplierRemindersEnabled ?? true,
    preArrival: settings?.preArrivalEnabled ?? true,
    driverDetails: settings?.driverDetailsEnabled ?? true,
    feedback: settings?.feedbackRequestsEnabled ?? true,
  };
}

/** A requested hotel/cab booking that should be chased again now. */
export function supplierNeedsReminder(row, { now = new Date(), today, date } = {}) {
  if (row?.supplierStatus !== "requested" || !row.supplierRequestedAt) return false;
  if ((row.supplierReminderCount || 0) >= MAX_SUPPLIER_REMINDERS) return false;
  if (date && today && date < today) return false; // already past
  const last = Math.max(ms(row.supplierRequestedAt) || 0, ms(row.supplierLastReminderAt) || 0);
  return ms(now) - last >= SUPPLIER_REMINDER_AFTER_HOURS * HOUR;
}

/** Confirmed trip starting in 0..PRE_ARRIVAL_DAYS days, client has email, not sent yet. */
export function preArrivalDue(trip, today) {
  const start = ymd(trip?.startDate);
  if (!start || !isConfirmed(trip) || !hasEmail(trip) || trip.preArrivalSentAt || trip.isPackage) return false;
  return start >= today && start <= addDaysYmd(today, PRE_ARRIVAL_DAYS);
}

/** Tomorrow's cab rows with a driver → send the client the driver's details (once per day). */
export function driverDetailsDue(trip, today) {
  if (!isConfirmed(trip) || !hasEmail(trip) || trip.isPackage) return null;
  const tomorrow = addDaysYmd(today, 1);
  if (trip.driverDetailsSentOn && trip.driverDetailsSentOn >= tomorrow) return null;
  const rows = (trip.transportations || []).filter((t) => ymd(t.date) === tomorrow && t.driverName);
  return rows.length ? { date: tomorrow, rows } : null;
}

/** Trip ended 1–7 days ago, confirmed, not asked yet. */
export function feedbackDue(trip, today) {
  const end = tripEnd(trip);
  if (!end || !isConfirmed(trip) || !hasEmail(trip) || trip.feedbackRequestedAt || trip.isPackage) return false;
  return end <= addDaysYmd(today, -1) && end >= addDaysYmd(today, -7);
}

function shell({ settings, greeting, paragraphs, rows = [], button = null }) {
  const agency = settings?.agencyName || "Your travel agent";
  const brand = safeColor(settings?.brandColor);
  const table = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#666;width:40%">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#181c22;max-width:560px;line-height:1.5">
    <p>Dear ${esc(greeting || "Guest")},</p>
    ${paragraphs.map((p) => `<p>${p}</p>`).join("\n    ")}
    ${table ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">${table}</table>` : ""}
    ${button ? `<p style="margin:26px 0"><a href="${esc(button.url)}" style="background:${esc(brand)};color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:bold">${esc(button.label)}</a></p>` : ""}
    <p>Warm regards,<br>${esc(agency)}${settings?.contactPhone ? `<br>${esc(settings.contactPhone)}` : ""}</p>
  </div>`;
}

/** { subject, html } — pre-arrival with the vouchers attached by the caller. */
export function preArrivalEmail(trip, settings) {
  const stays = (trip.accommodations || []).filter((a) => !a.cancelledAt).sort((a, b) => ms(a.checkIn) - ms(b.checkIn));
  const first = stays[0];
  const day1 = (trip.itineraries || []).slice().sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))[0];
  const cab1 = (trip.transportations || []).filter((t) => ymd(t.date) === ymd(trip.startDate)).find((t) => t.driverName);
  const name = String(trip.clientName || "").split(" ")[0] || "there";
  return {
    subject: `Your ${trip.tripTitle} trip starts ${fmtDay(trip.startDate)} — vouchers inside`,
    html: shell({
      settings,
      greeting: name,
      paragraphs: [
        `Your holiday is almost here! Your hotel and transport vouchers are attached — please keep them handy (on your phone is fine).`,
        day1?.title ? `Day 1: <b>${esc(String(day1.title).replace(/^Day\s*\d+\s*:\s*/i, ""))}</b>.` : "",
        `If anything changes with your travel plans, just reply to this email or call us.`,
      ].filter(Boolean),
      rows: [
        ["Trip", `${trip.tripTitle} (${trip.tripId})`],
        ["Starts", fmtDay(trip.startDate)],
        ["First hotel", first ? `${first.name}${first.city ? `, ${first.city}` : ""} · ${mealLabel(first.mealPlan)}` : ""],
        ["Your driver (day 1)", cab1 ? `${cab1.driverName}${cab1.driverPhone ? ` · ${cab1.driverPhone}` : ""}${cab1.vehicleNumber ? ` · ${cab1.vehicleNumber}` : ""}` : ""],
        ["Emergency contact", settings?.contactPhone || settings?.whatsapp || ""],
      ],
    }),
  };
}

export function driverDetailsEmail(trip, settings, { date, rows }) {
  const name = String(trip.clientName || "").split(" ")[0] || "there";
  const r = rows[0];
  return {
    subject: `Your driver for ${fmtDay(date)} — ${r.driverName}`,
    html: shell({
      settings,
      greeting: name,
      paragraphs: [`Here are your driver's details for tomorrow, ${esc(fmtDay(date))}.`],
      rows: [
        ["Driver", r.driverName],
        ["Phone", r.driverPhone || ""],
        ["Vehicle", [r.vehicleType || r.vehicle?.name, r.vehicleNumber].filter(Boolean).join(" · ")],
        ["Route", rows.map((x) => x.route).filter(Boolean).join(" / ")],
        ["Emergency contact", settings?.contactPhone || settings?.whatsapp || ""],
      ],
    }),
  };
}

export function feedbackEmail(trip, settings) {
  const name = String(trip.clientName || "").split(" ")[0] || "there";
  const agency = settings?.agencyName || "us";
  const review = String(settings?.reviewUrl || "").trim();
  return {
    subject: `How was your ${trip.tripTitle} trip?`,
    html: shell({
      settings,
      greeting: name,
      paragraphs: [
        `Welcome back! We hope ${esc(trip.tripTitle)} was everything you wished for.`,
        review
          ? `Would you take a minute to share how it went? It means a lot to a small team like ${esc(agency)}.`
          : `We'd love to hear how it went — just reply to this email with anything we can do better (or loved!).`,
      ],
      button: /^https?:\/\//i.test(review) ? { url: review, label: "Leave a review" } : null,
    }),
  };
}

/** Send one message, recording nothing (the caller updates the trip). */
export async function sendPreArrival(trip, settings, mailer) {
  const { subject, html } = preArrivalEmail(trip, settings);
  const pdf = await renderVouchersPdf(trip, settings);
  await sendMail(mailer, {
    to: trip.clientEmail,
    subject,
    html,
    attachments: [{ filename: `${trip.tripId}_Vouchers.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}
export async function sendDriverDetails(trip, settings, mailer, due) {
  await sendMail(mailer, { to: trip.clientEmail, ...driverDetailsEmail(trip, settings, due) });
}
export async function sendFeedbackRequest(trip, settings, mailer) {
  await sendMail(mailer, { to: trip.clientEmail, ...feedbackEmail(trip, settings) });
}
