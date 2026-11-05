import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { storageEnabled, uploadBuffer } from "@/lib/storage";
import { mapHotel, mapVehicle } from "@/lib/catalog";
import { buildTripScalars, syncTripRelations, parseDate } from "@/lib/trips";
import { nightsOf } from "@/lib/duration";
import { generateInquiryId, toInt, toAmount } from "@/lib/leads";
import { canCreateItinerary } from "@/lib/itineraryLimit";

// Account import from ViaKashmir Itinerary (viakashmiritinerary.in, the
// travel-agency app). The agency owner signs in there with the SAME email as
// here; we read their data through that app's normal read-only API and copy it
// into this workspace. Nothing on that side is changed, apart from the sign-in
// session the import itself opens (that app allows one session per account).
//
// The import runs as small steps the browser drives (one page of hotels, ten
// trips, ...) so no request runs long. Every copied row is recorded in
// ImportLink, so running it again only adds what is new. Rows that already
// exist here (same trip code, same hotel name + city, ...) are linked, never
// overwritten.

export const SOURCE = "travel-agency";
export const STEPS = ["settings", "destinations", "hotels", "vehicles", "leads", "trips", "packages"];

export function apiBase() {
  return (process.env.TRAVEL_AGENCY_API_URL || "https://viakashmiritinerary.in/api").replace(/\/+$/, "");
}
const siteOrigin = () => apiBase().replace(/\/api$/, "");

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── the handle the browser holds between steps ─────────────────────────────
// The travel-agency token never reaches the browser readable: it is sealed
// with AES-256-GCM under a key derived from this app's JWT secret, and bound to
// the signed-in user and an expiry.
const HANDLE_TTL_MS = 2 * 60 * 60 * 1000;
const sealKey = () =>
  crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || "dev-insecure-secret-change-me"}:travel-agency-import`)
    .digest();

export function sealHandle(payload, now = Date.now()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...payload, exp: now + HANDLE_TTL_MS }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openHandle(handle, userId, now = Date.now()) {
  try {
    const raw = Buffer.from(String(handle || ""), "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
    if (data.u !== userId || !(data.exp > now)) return null;
    return data;
  } catch {
    return null;
  }
}

// ── talking to the travel-agency API ───────────────────────────────────────
let fetchImpl = (...a) => fetch(...a);
/** Tests swap the network for a fake. */
export function setFetch(fn) {
  fetchImpl = fn;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function taRequest(path, { token, method = "GET", body } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetchImpl(`${apiBase()}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(25000),
      });
    } catch (e) {
      lastErr = new ImportError("Could not reach viakashmiritinerary.in. Please try again.", 502);
      await wait(800 * (attempt + 1));
      continue;
    }
    if ([429, 502, 503, 504].includes(res.status) && attempt < 2) {
      const after = Math.min(5, Number(res.headers?.get?.("retry-after")) || attempt + 1);
      await wait(after * 1000);
      continue;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new ImportError(data?.message || `viakashmiritinerary.in answered ${res.status}.`, res.status);
      err.remote = true;
      throw err;
    }
    return data;
  }
  throw lastErr || new ImportError("viakashmiritinerary.in is busy. Please try again.", 503);
}

const totalOf = (page) => (page && typeof page.total === "number" ? page.total : Array.isArray(page?.data) ? page.data.length : Array.isArray(page) ? page.length : 0);
const rowsOf = (page) => (Array.isArray(page?.data) ? page.data : Array.isArray(page) ? page : []);

// ── small helpers ──────────────────────────────────────────────────────────
const lc = (s) => String(s ?? "").trim().toLowerCase();
const empty = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const json = (v, fallback) => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
const stripId = ({ id, trip_id, created_at, updated_at, ...rest }) => rest;

/** Absolute URL of a travel-agency image (its *_url field, else its stored path). */
export function imageUrlOf(url, path) {
  const pick = !empty(url) ? String(url) : !empty(path) ? String(path) : null;
  if (!pick) return null;
  if (/^(https?:)?\/\//i.test(pick) || pick.startsWith("data:")) return pick;
  const clean = pick.replace(/^\/+/, "").replace(/^(api\/)?storage\//, "");
  return `${siteOrigin()}/api/storage/${clean}`;
}

const IMAGE_MAX = 8 * 1024 * 1024;
/**
 * Copy an image into this app's storage so nothing points back at the old
 * site. Without storage configured (or on any failure) the absolute URL is
 * kept, so the picture still shows.
 */
async function copyImage(url, prefix, cache) {
  if (!url) return null;
  if (cache?.has(url)) return cache.get(url);
  let out = url;
  if (storageEnabled() && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
      const type = (res.headers?.get?.("content-type") || "").split(";")[0].trim();
      if (res.ok && type.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0 && buf.length <= IMAGE_MAX) out = await uploadBuffer(buf, type, prefix);
      }
    } catch {
      out = url;
    }
  }
  cache?.set(url, out);
  return out;
}

// ── import links ───────────────────────────────────────────────────────────
async function linkMap(adminId, kind) {
  const rows = await prisma.importLink.findMany({ where: { userId: adminId, source: SOURCE, kind }, select: { externalId: true, localId: true } });
  return new Map(rows.map((r) => [r.externalId, r.localId]));
}

async function setLink(adminId, kind, externalId, localId) {
  const key = { userId: adminId, source: SOURCE, kind, externalId: String(externalId) };
  await prisma.importLink.upsert({ where: { import_link: key }, create: { ...key, localId }, update: { localId } });
}

const newStats = () => ({ created: 0, linked: 0, skipped: 0, failed: 0 });

// ── connect ────────────────────────────────────────────────────────────────
/**
 * Sign in to the travel-agency app as the same person and count what there is.
 * Only the agency owner (admin) imports: a team member's data belongs to their
 * agency, which the owner brings over.
 */
export async function connect(user, { email, password }) {
  if (!["admin", "super_admin"].includes(user.role)) {
    throw new ImportError("Only the agency owner can import an account. Ask your admin to run it.", 403);
  }
  if (empty(email) || empty(password)) throw new ImportError("Enter the email and password you use on viakashmiritinerary.in.", 422);
  if (lc(email) !== lc(user.email)) {
    throw new ImportError(`Use the same account on both sites: you are signed in here as ${user.email}.`, 422);
  }

  let login;
  try {
    login = await taRequest("/login", { method: "POST", body: { email: String(email).trim(), password: String(password) } });
  } catch (e) {
    // Never 401 back to the browser: this app's client reads 401 as "signed out here".
    if (e.status === 401) throw new ImportError("That email and password didn't work on viakashmiritinerary.in.", 422);
    if (e.status === 429) throw new ImportError("Too many sign-in attempts on viakashmiritinerary.in. Wait a minute and try again.", 429);
    if (e.status === 403) throw new ImportError(e.message || "That account is not active on viakashmiritinerary.in.", 403);
    throw e;
  }
  const token = login?.access_token;
  const remote = login?.user || {};
  if (!token) throw new ImportError("viakashmiritinerary.in did not open a session. Please try again.", 502);
  if (lc(remote.email) !== lc(user.email)) {
    await disconnect({ t: token });
    throw new ImportError("That account's email doesn't match this one.", 422);
  }
  if (!["admin", "super_admin"].includes(remote.role)) {
    await disconnect({ t: token });
    throw new ImportError("Sign in with the agency owner's account on viakashmiritinerary.in (not a team member).", 403);
  }

  const count = async (path) => {
    try {
      return totalOf(await taRequest(path, { token }));
    } catch {
      return null;
    }
  };
  const [trips, hotels, vehicles, destinations, leads, packages] = await Promise.all([
    count("/trips?per_page=1"),
    count("/hotels?per_page=1"),
    count("/vehicles?per_page=1"),
    count("/destinations?per_page=1"),
    count("/lead-inquiries?per_page=1"),
    count("/package-templates"),
  ]);

  return {
    handle: sealHandle({ t: token, u: user.id }),
    account: { name: remote.name ?? null, email: remote.email },
    counts: { settings: 1, destinations, hotels, vehicles, leads, trips, packages },
    steps: STEPS,
  };
}

/** Close the session the import opened on the travel-agency app. */
export async function disconnect(session) {
  if (!session?.t) return;
  try {
    await taRequest("/logout", { token: session.t, method: "POST" });
  } catch {
    /* the token may already be gone */
  }
}

// ── steps ──────────────────────────────────────────────────────────────────
// Each returns { step, stats, next (page number or null when done), notes }.

const SETTINGS_TEXT = [
  ["agencyName", "agency_name"],
  ["contactPhone", "contact_phone"],
  ["contactEmail", "contact_email"],
  ["whatsapp", "whatsapp"],
  ["website", "website"],
  ["companyAddress", "company_address"],
  ["brandColor", "brand_color"],
  ["secondaryColor", "secondary_color"],
  ["fontFamily", "font_family"],
  ["tagline", "tagline"],
  ["greetingMessage", "greeting_message"],
  ["confirmationMessage", "confirmation_message"],
  ["confirmationPdfMessage", "confirmation_pdf_message"],
  ["paymentVoucherEmailMessage", "payment_voucher_email_message"],
  ["invoiceEmailMessage", "invoice_email_message"],
  ["beneficiaryName", "beneficiary_name"],
  ["bankName", "bank_name"],
  ["accountNumber", "account_number"],
  ["ifscCode", "ifsc_code"],
  ["currency", "currency"],
  ["smtpEmail", "smtp_email"],
  ["smtpHost", "smtp_host"],
  ["smtpEncryption", "smtp_encryption"],
];
const SETTINGS_NUM = [
  ["gstPercentage", "gst_percentage"],
  ["profitMarginPercentage", "profit_margin_percentage"],
];
const POLICY_LISTS = [
  ["termsConditions", "terms_conditions"],
  ["mustHaves", "must_haves"],
  ["rolesResponsibilities", "roles_responsibilities"],
  ["cancellationPolicy", "cancellation_policy"],
  ["additionalExpenses", "additional_expenses"],
  ["defaultInclusions", "default_inclusions"],
  ["defaultExclusions", "default_exclusions"],
];
const toList = (v) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((s) => String(typeof s === "string" ? s : s?.content ?? "").trim())
    .filter(Boolean);

/** Fill only what is empty here: an agency's own edits on this side always win. */
export function settingsPatch(existing, remote) {
  const patch = {};
  const cur = existing || {};
  for (const [field, key] of SETTINGS_TEXT) {
    if (empty(cur[field]) && !empty(remote[key])) patch[field] = String(remote[key]);
  }
  for (const [field, key] of SETTINGS_NUM) {
    if (cur[field] == null && remote[key] != null && remote[key] !== "" && Number.isFinite(Number(remote[key]))) patch[field] = Number(remote[key]);
  }
  if (cur.smtpPort == null && remote.smtp_port != null && Number.isFinite(parseInt(remote.smtp_port, 10))) patch.smtpPort = parseInt(remote.smtp_port, 10);
  return patch;
}

export function policyPatch(existing, remote) {
  const patch = {};
  for (const [field, key] of POLICY_LISTS) {
    const here = toList(existing?.[field]);
    const there = toList(remote?.[key]);
    if (!here.length && there.length) patch[field] = there;
  }
  return patch;
}

async function stepSettings(ctx) {
  const stats = newStats();
  const notes = [];
  const init = await taRequest("/builder/init", { token: ctx.token });
  const remote = init?.settings || null;

  if (remote) {
    const existing = await prisma.agencySetting.findUnique({ where: { userId: ctx.adminId } });
    const patch = settingsPatch(existing, remote);
    const images = [
      ["logoPath", imageUrlOf(remote.logo_url, remote.logo_path), "logos"],
      ["defaultTripImagePath", imageUrlOf(remote.default_trip_image_url, remote.default_trip_image_path), "trips"],
      ["confirmationHeroImage", imageUrlOf(null, remote.confirmation_hero_image), "uploads"],
    ];
    for (const [field, url, prefix] of images) {
      if (url && empty(existing?.[field])) patch[field] = await copyImage(url, prefix, ctx.images);
    }
    if (Object.keys(patch).length) {
      if (existing) await prisma.agencySetting.update({ where: { userId: ctx.adminId }, data: patch });
      else await prisma.agencySetting.create({ data: { userId: ctx.adminId, ...patch } });
      stats.created += 1;
    } else {
      stats.skipped += 1;
    }
    if (!empty(remote.smtp_email)) notes.push("Email sending: re-enter your Gmail app password in Settings (it is never shared between sites).");
  }

  if (init?.policies) {
    const existing = await prisma.policy.findUnique({ where: { userId: ctx.adminId } });
    const patch = policyPatch(existing, init.policies);
    if (Object.keys(patch).length) {
      if (existing) await prisma.policy.update({ where: { userId: ctx.adminId }, data: patch });
      else await prisma.policy.create({ data: { userId: ctx.adminId, ...patch } });
      stats.created += 1;
    } else {
      stats.skipped += 1;
    }
  }
  return { stats, next: null, notes };
}

const PER_PAGE = 50;
const TRIPS_PER_STEP = 10;

async function stepDestinations(ctx, page) {
  const stats = newStats();
  const res = await taRequest(`/destinations?per_page=${PER_PAGE}&page=${page}`, { token: ctx.token });
  const links = await linkMap(ctx.adminId, "destination");
  const here = await prisma.destination.findMany({ where: { userId: ctx.adminId }, select: { id: true, name: true } });
  for (const d of rowsOf(res)) {
    try {
      if (links.has(String(d.id))) {
        stats.skipped++;
        continue;
      }
      const same = here.find((h) => lc(h.name) === lc(d.name));
      if (same) {
        await setLink(ctx.adminId, "destination", d.id, same.id);
        stats.linked++;
        continue;
      }
      if (empty(d.name)) {
        stats.skipped++;
        continue;
      }
      const created = await prisma.destination.create({
        data: {
          userId: ctx.adminId,
          name: String(d.name).trim(),
          activities: json(d.activities, []),
          imagePath: await copyImage(imageUrlOf(d.image_url, d.image_path), "destinations", ctx.images),
        },
      });
      here.push({ id: created.id, name: created.name });
      await setLink(ctx.adminId, "destination", d.id, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Destination "${d.name}": ${e.message}`);
    }
  }
  return { stats, next: page < (res?.last_page || 1) ? page + 1 : null };
}

async function stepHotels(ctx, page) {
  const stats = newStats();
  const res = await taRequest(`/hotels?per_page=${PER_PAGE}&page=${page}`, { token: ctx.token });
  const links = await linkMap(ctx.adminId, "hotel");
  const here = await prisma.hotel.findMany({ where: { userId: ctx.adminId }, select: { id: true, name: true, city: true } });
  for (const h of rowsOf(res)) {
    try {
      if (links.has(String(h.id))) {
        stats.skipped++;
        continue;
      }
      const same = here.find((x) => lc(x.name) === lc(h.name) && lc(x.city) === lc(h.city));
      if (same) {
        await setLink(ctx.adminId, "hotel", h.id, same.id);
        stats.linked++;
        continue;
      }
      const { data, error } = await mapHotel({
        name: h.name,
        city: h.city,
        email: h.email,
        phone: h.phone,
        price_sections: json(h.price_sections, []),
      });
      if (error) {
        stats.skipped++;
        continue;
      }
      data.imagePath = await copyImage(imageUrlOf(h.image_url, h.image_path), "hotels", ctx.images);
      const created = await prisma.hotel.create({ data: { ...data, userId: ctx.adminId } });
      here.push({ id: created.id, name: created.name, city: created.city });
      await setLink(ctx.adminId, "hotel", h.id, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Hotel "${h.name}": ${e.message}`);
    }
  }
  return { stats, next: page < (res?.last_page || 1) ? page + 1 : null };
}

async function stepVehicles(ctx, page) {
  const stats = newStats();
  const res = await taRequest(`/vehicles?per_page=${PER_PAGE}&page=${page}`, { token: ctx.token });
  const links = await linkMap(ctx.adminId, "vehicle");
  const here = await prisma.vehicle.findMany({ where: { userId: ctx.adminId }, select: { id: true, name: true } });
  for (const v of rowsOf(res)) {
    try {
      if (links.has(String(v.id))) {
        stats.skipped++;
        continue;
      }
      const same = here.find((x) => lc(x.name) === lc(v.name));
      if (same) {
        await setLink(ctx.adminId, "vehicle", v.id, same.id);
        stats.linked++;
        continue;
      }
      const { data, error } = await mapVehicle({ name: v.name, email: v.email, phone: v.phone, price: v.price ?? 0 });
      if (error) {
        stats.skipped++;
        continue;
      }
      const created = await prisma.vehicle.create({ data: { ...data, userId: ctx.adminId } });
      here.push({ id: created.id, name: created.name });
      await setLink(ctx.adminId, "vehicle", v.id, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Vehicle "${v.name}": ${e.message}`);
    }
  }
  return { stats, next: page < (res?.last_page || 1) ? page + 1 : null };
}

async function stepLeads(ctx, page) {
  const stats = newStats();
  const res = await taRequest(`/lead-inquiries?per_page=${PER_PAGE}&page=${page}`, { token: ctx.token });
  const links = await linkMap(ctx.adminId, "lead");
  // Team members here, by email, so a lead keeps its owner when they exist on both sites.
  const members = await prisma.user.findMany({
    where: { OR: [{ id: ctx.adminId }, { membershipTeam: { ownerId: ctx.adminId } }] },
    select: { id: true, email: true },
  }).catch(() => []);
  const memberByEmail = new Map(members.map((m) => [lc(m.email), m.id]));

  for (const l of rowsOf(res)) {
    try {
      if (links.has(String(l.id))) {
        stats.skipped++;
        continue;
      }
      if (!empty(l.inquiry_id)) {
        const same = await prisma.leadInquiry.findUnique({ where: { inquiryId: String(l.inquiry_id) } });
        if (same && same.userId === ctx.adminId) {
          await setLink(ctx.adminId, "lead", l.id, same.id);
          stats.linked++;
          continue;
        }
      }
      let inquiryId = !empty(l.inquiry_id) ? String(l.inquiry_id) : generateInquiryId();
      while (await prisma.leadInquiry.findUnique({ where: { inquiryId } })) inquiryId = generateInquiryId();

      const created = await prisma.leadInquiry.create({
        data: {
          inquiryId,
          userId: ctx.adminId,
          isPublic: false,
          clientName: empty(l.client_name) ? "Client" : String(l.client_name),
          clientEmail: l.client_email ?? null,
          clientPhone: l.client_phone ?? null,
          destination: l.destination ?? null,
          adults: toInt(l.adults, 1),
          kidsCnb: toInt(l.kids_cnb, 0),
          kids5to12: toInt(l.kids_5_to_12, 0),
          startDate: parseDate(l.start_date),
          duration: l.duration != null && l.duration !== "" ? String(l.duration) : null,
          approximateBudget: toAmount(l.approximate_budget),
          currency: l.currency ?? null,
          specialRequests: l.special_requests ?? null,
          status: empty(l.status) ? "new" : String(l.status),
          sourceUrl: l.source_url ?? null,
          notes: typeof l.notes === "string" ? l.notes : l.notes ? JSON.stringify(l.notes) : null,
          assignedTo: l.assignee?.email ? memberByEmail.get(lc(l.assignee.email)) ?? null : null,
          utmSource: l.utm_source ?? null,
          utmMedium: l.utm_medium ?? null,
          utmCampaign: l.utm_campaign ?? null,
          gclid: l.gclid ?? null,
          fbLeadId: l.fb_lead_id ?? null,
          ...(parseDate(l.created_at) ? { createdAt: parseDate(l.created_at) } : {}),
        },
      });
      await setLink(ctx.adminId, "lead", l.id, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Lead "${l.client_name}": ${e.message}`);
    }
  }
  return { stats, next: page < (res?.last_page || 1) ? page + 1 : null };
}

const newCode = async (prefix) => {
  let code;
  do code = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
  while (await prisma.trip.findUnique({ where: { tripId: code } }));
  return code;
};
const slugOf = (title) =>
  `${String(title || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;

/** Catalog ids on the other side → ids here, for a trip's hotels / cabs / destination. */
async function catalogMaps(adminId) {
  const [hotels, vehicles, destinations, hotelRows, vehicleRows, destRows] = await Promise.all([
    linkMap(adminId, "hotel"),
    linkMap(adminId, "vehicle"),
    linkMap(adminId, "destination"),
    prisma.hotel.findMany({ where: { userId: adminId }, select: { id: true, name: true, city: true } }),
    prisma.vehicle.findMany({ where: { userId: adminId }, select: { id: true, name: true } }),
    prisma.destination.findMany({ where: { userId: adminId }, select: { id: true, name: true } }),
  ]);
  const ids = (rows) => new Set(rows.map((r) => r.id));
  return { hotels, vehicles, destinations, hotelRows, vehicleRows, destRows, hotelIds: ids(hotelRows), vehicleIds: ids(vehicleRows), destIds: ids(destRows) };
}

function localHotelId(maps, a) {
  const linked = a.hotel_id != null ? maps.hotels.get(String(a.hotel_id)) : null;
  if (linked && maps.hotelIds.has(linked)) return linked;
  const name = a.hotel?.name ?? a.name;
  const city = a.hotel?.city ?? a.city;
  return maps.hotelRows.find((h) => lc(h.name) === lc(name) && (empty(city) || lc(h.city) === lc(city)))?.id ?? null;
}
function localVehicleId(maps, t) {
  const linked = t.vehicle_id != null ? maps.vehicles.get(String(t.vehicle_id)) : null;
  if (linked && maps.vehicleIds.has(linked)) return linked;
  const name = t.vehicle?.name;
  return name ? maps.vehicleRows.find((v) => lc(v.name) === lc(name))?.id ?? null : null;
}
function localDestinationId(maps, trip) {
  const linked = trip.destination_id != null ? maps.destinations.get(String(trip.destination_id)) : null;
  if (linked && maps.destIds.has(linked)) return linked;
  const name = trip.destination_ref?.name ?? trip.destination;
  return name ? maps.destRows.find((d) => lc(d.name) === lc(name))?.id ?? null : null;
}

/** A full travel-agency trip (GET /trips/:code) → the body lib/trips.js saves. */
export function tripBody(t, maps) {
  return {
    tripTitle: empty(t.trip_title) ? "Trip" : String(t.trip_title),
    destination: t.destination ?? null,
    destinationId: localDestinationId(maps, t),
    clientName: t.client_name ?? null,
    clientPhone: t.client_phone ?? null,
    clientEmail: t.client_email ?? null,
    adults: t.adults,
    kids_cnb: t.kids_cnb,
    kids_5_to_12: t.kids_5_to_12,
    startDate: t.start_date,
    duration: t.duration,
    cost: t.cost,
    gst_amount: t.gst_amount,
    gst_percentage: t.gst_percentage,
    profit_margin_percentage: t.profit_margin_percentage,
    currency: t.currency || undefined,
    template: t.template || undefined,
    status: t.status || undefined,
    include_gst: t.include_gst == null ? undefined : !!t.include_gst,
    use_flight: !!t.use_flight,
    tagline: t.tagline ?? null,
    inclusions: json(t.inclusions, []),
    exclusions: json(t.exclusions, []),
    other_costs: json(t.other_costs, []),
    transport_details: json(t.transport_details, []),
  };
}

async function tripChildren(t, maps, ctx) {
  const itineraries = [];
  for (const i of [...(t.itineraries || [])].sort((a, b) => (Number(a.day_number) || 0) - (Number(b.day_number) || 0))) {
    itineraries.push({
      ...stripId(i),
      image: await copyImage(imageUrlOf(i.image_url, i.image_path), "itineraries", ctx.images),
    });
  }
  const accommodations = [];
  for (const a of t.accommodations || []) {
    const { hotel, premium_option, ...rest } = stripId(a);
    accommodations.push({
      ...rest,
      hotel_id: localHotelId(maps, a),
      name: rest.name || hotel?.name || "Hotel",
      city: rest.city || hotel?.city || null,
      bed_prices: json(rest.bed_prices, []),
      image: await copyImage(imageUrlOf(a.image_url, a.image_path), "accommodations", ctx.images),
    });
  }
  const transportations = (t.transportations || []).map((x) => {
    const { vehicle, ...rest } = stripId(x);
    return { ...rest, vehicle_id: localVehicleId(maps, x) };
  });
  return { itineraries, accommodations, transportations };
}

async function createTripFrom(t, ctx, maps, { isPackage = false, code, extra = {} } = {}) {
  const scalars = await buildTripScalars(tripBody(t, maps));
  const created = await prisma.trip.create({
    data: {
      ...scalars,
      userId: ctx.adminId,
      teamId: null,
      tripId: code,
      isPackage,
      slug: slugOf(scalars.tripTitle),
      imagePath: await copyImage(imageUrlOf(t.image_url, t.image_path), "trips", ctx.images),
      ...extra,
    },
  });
  try {
    await syncTripRelations(created.id, await tripChildren(t, maps, ctx));
  } catch (e) {
    // Never leave half a trip behind: its days / hotels / cabs go with it.
    await prisma.trip.delete({ where: { id: created.id } }).catch(() => {});
    throw e;
  }
  return created;
}

async function stepTrips(ctx, page) {
  const stats = newStats();
  const notes = [];
  const res = await taRequest(`/trips?per_page=${TRIPS_PER_STEP}&page=${page}`, { token: ctx.token });
  const links = await linkMap(ctx.adminId, "trip");
  const maps = await catalogMaps(ctx.adminId);

  for (const row of rowsOf(res)) {
    const code = String(row.trip_id || "");
    try {
      if (!code || links.has(code)) {
        stats.skipped++;
        continue;
      }
      const existing = await prisma.trip.findUnique({ where: { tripId: code }, select: { id: true, userId: true } });
      if (existing && existing.userId === ctx.adminId) {
        // Already here (e.g. copied over earlier): keep this side's version.
        await setLink(ctx.adminId, "trip", code, existing.id);
        stats.linked++;
        continue;
      }
      const limit = await canCreateItinerary(ctx.adminId);
      if (!limit.allowed) {
        notes.push(limit.reason);
        return { stats, next: null, notes };
      }
      const full = await taRequest(`/trips/${encodeURIComponent(code)}`, { token: ctx.token });
      const created = await createTripFrom(full, ctx, maps, {
        code: existing ? await newCode("TRP") : code,
        extra: {
          paidAmount: toAmount(full.paid_amount) ?? 0,
          refundedAmount: toAmount(full.refunded_amount) ?? 0,
          followUpSent: !!full.follow_up_sent,
          confirmationSent: !!full.confirmation_sent,
          ...(parseDate(full.created_at) ? { createdAt: parseDate(full.created_at) } : {}),
        },
      });
      if (existing) notes.push(`Trip ${code} got the new code ${created.tripId} (that code is taken here).`);
      await setLink(ctx.adminId, "trip", code, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Trip ${code}: ${e.message}`);
    }
  }
  return { stats, next: page < (res?.last_page || 1) ? page + 1 : null, notes };
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};

/**
 * A travel-agency package template (dates as day offsets) → the trip shape
 * above, with real dates from `start` (packages here are trips flagged
 * isPackage that keep dates).
 */
export function packageAsTrip(pkg, start) {
  const data = json(pkg.data, {}) || {};
  const trip = data.trip || {};
  const at = (offset) => (offset === null || offset === undefined || offset === "" ? null : addDays(start, Number(offset) || 0));
  return {
    trip_title: trip.trip_title || pkg.name || "Package",
    destination: trip.destination || (Array.isArray(pkg.destinations) ? pkg.destinations.join(", ") : null),
    destination_id: trip.destination_id ?? null,
    adults: trip.adults ?? 2,
    kids_cnb: trip.kids_cnb ?? 0,
    kids_5_to_12: trip.kids_5_to_12 ?? 0,
    start_date: start,
    duration: trip.duration ?? pkg.nights ?? null,
    cost: pkg.estimated_price ?? null,
    gst_percentage: data.gst_percentage ?? null,
    profit_margin_percentage: data.profit_margin_percentage ?? null,
    include_gst: data.include_gst,
    currency: trip.currency || pkg.currency || undefined,
    template: trip.template || undefined,
    status: "draft",
    use_flight: !!trip.use_flight,
    tagline: trip.tagline ?? null,
    image_url: pkg.image_url ?? null,
    inclusions: data.inclusions ?? [],
    exclusions: data.exclusions ?? [],
    other_costs: data.other_costs ?? [],
    itineraries: (data.itineraries || []).map((i, idx) => ({
      day_number: i.day_number ?? idx + 1,
      title: i.title ?? null,
      location: i.location ?? null,
      description: i.description ?? null,
      image_url: i.image ?? i.image_url ?? null,
    })),
    accommodations: (data.accommodations || []).map((a) => {
      const checkIn = at(a.check_in_offset);
      const nights = a.nights === null || a.nights === undefined ? null : Number(a.nights) || 0;
      const { check_in_offset, nights: _n, image, ...rest } = a;
      return { ...rest, check_in: checkIn, check_out: checkIn && nights !== null ? addDays(checkIn, nights) : null, image_url: image ?? null };
    }),
    transportations: (data.transportations || []).map(({ day_offset, ...rest }) => ({ ...rest, date: at(day_offset) })),
  };
}

const PACKAGES_PER_STEP = 10;

async function stepPackages(ctx, page) {
  const stats = newStats();
  const list = rowsOf(await taRequest("/package-templates", { token: ctx.token }));
  const links = await linkMap(ctx.adminId, "package");
  const maps = await catalogMaps(ctx.adminId);
  const start = isoDay(new Date());
  const slice = list.slice((page - 1) * PACKAGES_PER_STEP, page * PACKAGES_PER_STEP);

  for (const p of slice) {
    try {
      if (links.has(String(p.id))) {
        stats.skipped++;
        continue;
      }
      const full = await taRequest(`/package-templates/${encodeURIComponent(p.id)}`, { token: ctx.token });
      const created = await createTripFrom(packageAsTrip(full, start), ctx, maps, { isPackage: true, code: await newCode("PKG") });
      await setLink(ctx.adminId, "package", p.id, created.id);
      stats.created++;
    } catch (e) {
      stats.failed++;
      ctx.errors.push(`Package "${p.name}": ${e.message}`);
    }
  }
  return { stats, next: page * PACKAGES_PER_STEP < list.length ? page + 1 : null };
}

const RUNNERS = {
  settings: stepSettings,
  destinations: stepDestinations,
  hotels: stepHotels,
  vehicles: stepVehicles,
  leads: stepLeads,
  trips: stepTrips,
  packages: stepPackages,
};

/** Run one chunk of one step. `adminId` is the caller's tenant. */
export async function runStep({ session, adminId, step, page = 1 }) {
  const run = RUNNERS[step];
  if (!run) throw new ImportError("Unknown import step.", 422);
  const ctx = { token: session.t, adminId, images: new Map(), errors: [] };
  const p = Math.max(1, parseInt(page, 10) || 1);
  try {
    const out = await run(ctx, p);
    return { step, page: p, next: out.next ?? null, stats: out.stats, notes: out.notes || [], errors: ctx.errors.slice(0, 20) };
  } catch (e) {
    if (e.remote && e.status === 401) {
      throw new ImportError("The viakashmiritinerary.in session ended (it allows one sign-in at a time). Connect again to continue: what was imported stays and won't be copied twice.", 409);
    }
    throw e;
  }
}
