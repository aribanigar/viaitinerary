import prisma from "@/lib/prisma";
import { mailerForAdminId, sendMail, demoRequestAdminHtml, demoRequestCustomerHtml } from "@/lib/mailer";

export const DEMO_STATUSES = ["pending", "contacted", "completed", "cancelled"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function serializeDemoRequest(d) {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    contact_number: d.contactNumber,
    invite_guests: d.inviteGuests,
    company_name: d.companyName,
    no_of_employees: d.noOfEmployees,
    agency_type: d.agencyType,
    destinations: d.destinations,
    processes: d.processes ?? [],
    office_location: d.officeLocation,
    referral_source: d.referralSource,
    scheduled_at: wallClockText(d.scheduledAt),
    status: d.status,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

// The form sends the visitor's clock time with no zone ("2026-12-01 10:30" or
// "01-12-2026 10:30"). It is kept as that wall-clock time (stored as UTC
// parts, as before) and sent back as "DD-MM-YYYY HH:mm", which the admin page
// reads as the time to show.
export function parseWallClock(v) {
  const s = String(v ?? "").trim();
  let m;
  let y, mo, d, h = 0, mi = 0;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/))) [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? 0, m[5] ?? 0].map(Number);
  else if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/))) [d, mo, y, h, mi] = [m[1], m[2], m[3], m[4] ?? 0, m[5] ?? 0].map(Number);
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && h < 24 && mi < 60 ? dt : null;
}

export function wallClockText(dt) {
  if (!dt) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(dt.getUTCDate())}-${p(dt.getUTCMonth() + 1)}-${dt.getUTCFullYear()} ${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}`;
}

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

/** Validate the public form (same rules as before). → { data } | { errors } */
export function parseDemoRequest(b = {}) {
  const errors = {};
  const need = (key, label, max = 255) => {
    const v = str(b[key]);
    if (!v) errors[key] = [`The ${label} field is required.`];
    else if (v.length > max) errors[key] = [`The ${label} may not be greater than ${max} characters.`];
    return v;
  };
  const name = need("name", "name");
  const email = need("email", "email");
  if (email && !EMAIL_RE.test(email)) errors.email = ["The email must be a valid email address."];
  const contact = need("contact_number", "contact number", 40);
  if (contact && contact.replace(/\D/g, "").length < 7) errors.contact_number = ["The contact number must be a valid phone number."];
  const company = need("company_name", "company name");
  const employees = parseInt(b.no_of_employees, 10);
  if (!Number.isInteger(employees) || employees < 1) errors.no_of_employees = ["The number of employees must be at least 1."];
  const agencyType = need("agency_type", "agency type");
  const destinations = need("destinations", "destinations", 5000);
  if (!Array.isArray(b.processes)) errors.processes = ["The processes field is required."];
  const office = need("office_location", "office location");
  const referral = need("referral_source", "referral source");
  const guests = str(b.invite_guests);
  if (guests.length > 255) errors.invite_guests = ["The invite guests may not be greater than 255 characters."];
  const scheduledAt = str(b.scheduled_at) ? parseWallClock(b.scheduled_at) : null;
  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      name,
      email,
      contactNumber: contact,
      inviteGuests: guests || null,
      companyName: company,
      noOfEmployees: String(employees),
      agencyType,
      destinations,
      processes: b.processes.map((p) => String(p)).slice(0, 50),
      officeLocation: office,
      referralSource: referral,
      scheduledAt,
    },
  };
}

/** Alert the platform and confirm to the requester. Never throws. */
export async function emailDemoRequest(d) {
  try {
    const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin" }, select: { id: true, email: true } });
    const { mailer } = await mailerForAdminId(superAdmin?.id);
    if (!mailer) return;
    const adminTo = process.env.ADMIN_ALERT_EMAIL || superAdmin?.email;
    const sends = [];
    if (adminTo) {
      sends.push(sendMail(mailer, { to: adminTo, replyTo: d.email, subject: `New demo request: ${d.companyName}`, html: demoRequestAdminHtml(d) }));
    }
    if (d.email && EMAIL_RE.test(d.email)) {
      sends.push(sendMail(mailer, { to: d.email, subject: "We have your demo request", html: demoRequestCustomerHtml(d, mailer.fromName) }));
    }
    (await Promise.allSettled(sends)).forEach((r) => {
      if (r.status === "rejected") console.error("demo request email failed:", r.reason?.message || r.reason);
    });
  } catch (e) {
    console.error("demo request email failed:", e?.message || e);
  }
}
