import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

// Port of App\Support\AgencyMailer + the Mail/* mailables. Each agency configures
// its own SMTP (Gmail app password etc.) in Agency Settings; we build a transport
// from those fields. There is no global fallback mailer in this deploy, so an
// agency must configure SMTP before email features work.

/** Build a nodemailer transport from an AgencySetting row, or null if unset. */
export function transportFromSettings(settings) {
  if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpEmail || !settings.smtpAppPassword) {
    return null;
  }
  const port = Number(settings.smtpPort);
  const enc = (settings.smtpEncryption || "").toLowerCase();
  const secure = enc === "ssl" || port === 465;

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure,
    auth: { user: settings.smtpEmail, pass: settings.smtpAppPassword },
    ...(enc === "tls" && !secure ? { requireTLS: true } : {}),
  });

  const fromName = settings.agencyName || settings.smtpEmail;
  return { transporter, fromEmail: settings.smtpEmail, fromName };
}

export async function mailerForAdminId(adminId) {
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
  return { settings, mailer: transportFromSettings(settings) };
}

export async function sendMail(mailer, { to, subject, html, text, attachments }) {
  return mailer.transporter.sendMail({
    from: `"${mailer.fromName}" <${mailer.fromEmail}>`,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(attachments ? { attachments } : {}),
  });
}

// ── HTML email templates ───────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

function shell(title, bodyRows, agencyName) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#2563eb;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">${esc(title)}</div>
    <div style="padding:24px">${bodyRows}</div>
    <div style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px">Sent by ${esc(agencyName || "ViaItinerary")}</div>
  </div></body></html>`;
}

const row = (label, value) =>
  `<tr><td style="padding:6px 0;color:#6b7280;width:40%">${esc(label)}</td><td style="padding:6px 0;font-weight:600">${esc(value)}</td></tr>`;

export function hotelBookingHtml(trip, acc, settings) {
  const agencyName = settings?.agencyName || "Travel Agency";
  const body = `<p>You have a new booking request from <strong>${esc(agencyName)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Hotel", acc.name || acc.hotel?.name || "—")}
      ${row("Guest", trip.clientName || "Guest")}
      ${row("City", acc.city || "—")}
      ${row("Room type", acc.roomType || "—")}
      ${row("Rooms", acc.rooms || "—")}
      ${row("Check-in", fmtDate(acc.checkIn))}
      ${row("Check-out", fmtDate(acc.checkOut))}
      ${row("Meal plan", acc.mealPlan || "—")}
      ${row("Trip ID", trip.tripId)}
    </table>
    <p style="margin-top:16px;color:#6b7280">Please confirm availability at your earliest convenience.</p>`;
  return { subject: `New Booking Confirmation - ${agencyName}`, html: shell("Hotel Booking Request", body, agencyName) };
}

export function cabBookingHtml(trip, trans, settings) {
  const agencyName = settings?.agencyName || "Travel Agency";
  const body = `<p>You have a new cab service request from <strong>${esc(agencyName)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Vehicle", trans.vehicleType || trans.vehicle?.name || "—")}
      ${row("Guest", trip.clientName || "Guest")}
      ${row("Route", trans.route || trans.destination || "—")}
      ${row("Date", fmtDate(trans.date))}
      ${row("Quantity", trans.quantity ?? 1)}
      ${row("Remarks", trans.remarks || "—")}
      ${row("Trip ID", trip.tripId)}
    </table>
    <p style="margin-top:16px;color:#6b7280">Please confirm availability at your earliest convenience.</p>`;
  return { subject: `New Cab Service Request - ${agencyName}`, html: shell("Cab Service Request", body, agencyName) };
}

export function confirmationHtml(message, agencyName) {
  const body = `<div style="white-space:pre-wrap;font-size:14px;line-height:1.6">${esc(message)}</div>`;
  return shell(`${agencyName} — Booking Confirmation`, body, agencyName);
}
