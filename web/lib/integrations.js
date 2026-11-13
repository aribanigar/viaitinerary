import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { generateInquiryId } from "@/lib/leads";
import { appOrigin } from "@/lib/followups";

// Lead-source integrations (Integrations page, /integrations):
// - Meta (Facebook / Instagram lead ads): sign in with Facebook, pick the Page,
//   leads arrive through the Meta webhook (/api/webhooks/meta) and are fetched
//   with the Page token. Or point at a public Google Sheet of the leads.
// - Google Ads: sign in with Google (adwords scope); the token is stored.
// App credentials come from env: FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET /
// FACEBOOK_REDIRECT_URI, META_VERIFY_TOKEN, META_INCLUDE_* scope switches,
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI, FRONTEND_URL.

export const META_GRAPH = "https://graph.facebook.com/v22.0";
export const PLATFORMS = ["facebook", "google"];
const STATE_TTL_S = 600;

let fetchImpl = (...a) => fetch(...a);
/** Tests swap the network for a fake. */
export function setFetch(fn) {
  fetchImpl = fn;
}

const secret = () => `${process.env.JWT_SECRET || "dev-insecure-secret-change-me"}:oauth-state`;
const b64u = (s) => Buffer.from(s).toString("base64url");

// ── signed OAuth state: which user started the sign-in, for 10 minutes ──────
export function buildState(userId, now = Date.now()) {
  const payload = b64u(JSON.stringify({ uid: userId, ts: Math.floor(now / 1000), nonce: crypto.randomBytes(8).toString("hex") }));
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function userIdFromState(state, now = Date.now()) {
  if (!state || !String(state).includes(".")) return null;
  const [payload, sig] = String(state).split(".", 2);
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const ts = Number(data.ts);
    if (!(ts > 0) || Math.floor(now / 1000) - ts > STATE_TTL_S) return null;
    const uid = parseInt(data.uid, 10);
    return uid > 0 ? uid : null;
  } catch {
    return null;
  }
}

const flag = (v) => ["1", "true", "yes", "on"].includes(String(v || "").toLowerCase());

export function frontendUrl(request) {
  return (process.env.FRONTEND_URL || appOrigin(request)).replace(/\/+$/, "");
}

function redirectUri(platform, request) {
  const env = platform === "facebook" ? process.env.FACEBOOK_REDIRECT_URI : process.env.GOOGLE_REDIRECT_URI;
  return env || `${appOrigin(request)}/api/auth/${platform}/callback`;
}

function credentials(platform) {
  const id = platform === "facebook" ? process.env.FACEBOOK_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  const sec = platform === "facebook" ? process.env.FACEBOOK_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;
  return id && sec ? { id, secret: sec } : null;
}

export function isConfigured(platform) {
  return !!credentials(platform);
}

/** The provider's sign-in URL for this user. */
export function authorizeUrl(platform, userId, request) {
  const creds = credentials(platform);
  if (!creds) return null;
  const state = buildState(userId);
  if (platform === "facebook") {
    const scopes = [
      "public_profile",
      flag(process.env.META_INCLUDE_EMAIL) ? "email" : null,
      flag(process.env.META_INCLUDE_PAGES_SCOPES) ? "pages_show_list" : null,
      flag(process.env.META_INCLUDE_PAGES_SCOPES) ? "pages_read_engagement" : null,
      flag(process.env.META_INCLUDE_LEADS_RETRIEVAL) ? "leads_retrieval" : null,
    ].filter(Boolean);
    const q = new URLSearchParams({ client_id: creds.id, redirect_uri: redirectUri(platform, request), scope: scopes.join(","), response_type: "code", state });
    return `https://www.facebook.com/v22.0/dialog/oauth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: creds.id,
    redirect_uri: redirectUri(platform, request),
    response_type: "code",
    scope: "openid profile email https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function getJson(url, init) {
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error_description || data?.error || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Provider request failed.");
  }
  return data;
}

/** Exchange the callback code and save the integration for the state's user. */
export async function completeSignIn(platform, { code, state }, request) {
  const creds = credentials(platform);
  if (!creds) throw new Error(`${platform === "facebook" ? "Meta" : "Google"} sign-in is not set up on this server.`);
  const userId = userIdFromState(state);
  if (!userId) throw new Error("Invalid or expired OAuth state. Please retry.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("Target user not found for integration callback.");
  const redirect_uri = redirectUri(platform, request);

  let token;
  let profile;
  if (platform === "facebook") {
    token = await getJson(`${META_GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, redirect_uri, code })}`);
    const me = await getJson(`${META_GRAPH}/me?${new URLSearchParams({ fields: "id,name,email,picture", access_token: token.access_token })}`);
    profile = { id: me.id, name: me.name ?? null, email: me.email ?? null, avatar: me.picture?.data?.url ?? null };
  } else {
    token = await getJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, redirect_uri, code, grant_type: "authorization_code" }),
    });
    const me = await getJson("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    profile = { id: me.sub, name: me.name ?? null, email: me.email ?? null, avatar: me.picture ?? null };
  }

  // The integration belongs to the agency (tenant) of the user who signed in.
  const adminId = await tenantOf(userId);
  const existing = await prisma.integration.findUnique({ where: { user_platform: { userId: adminId, platform } } });
  const settings = { ...(existing?.settings || {}), name: profile.name, email: profile.email, avatar: profile.avatar };
  const data = {
    platformId: profile.id ? String(profile.id) : null,
    accessToken: String(token.access_token || ""),
    refreshToken: token.refresh_token ?? existing?.refreshToken ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : null,
    isActive: true,
    settings,
  };
  await prisma.integration.upsert({
    where: { user_platform: { userId: adminId, platform } },
    create: { userId: adminId, platform, ...data },
    update: data,
  });
}

async function tenantOf(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, teamId: true } });
  if (u?.role === "team" && u.teamId) {
    const team = await prisma.team.findUnique({ where: { id: u.teamId }, select: { ownerId: true } });
    return team?.ownerId ?? u.id;
  }
  return u?.id ?? userId;
}

const SAFE_SETTINGS = ["page_id", "form_ids", "token_type", "sheet_url", "sheet_last_synced_at", "sheet_last_error", "sheet_last_import_summary"];

/** { facebook: { connected, expires_at, settings }, google: {...} } without tokens. */
export async function listIntegrations(adminId) {
  const rows = await prisma.integration.findMany({ where: { userId: adminId } });
  const out = {};
  for (const r of rows) {
    const s = r.settings && typeof r.settings === "object" ? r.settings : {};
    out[r.platform] = {
      connected: r.isActive,
      expires_at: r.expiresAt,
      settings: Object.fromEntries(SAFE_SETTINGS.filter((k) => k in s).map((k) => [k, s[k]])),
    };
  }
  return out;
}

async function pageAccessToken(userToken, pageId) {
  try {
    const data = await getJson(`${META_GRAPH}/me/accounts?${new URLSearchParams({ access_token: userToken, fields: "id,access_token" })}`);
    return (data.data || []).find((p) => String(p.id) === String(pageId))?.access_token ?? null;
  } catch (e) {
    console.warn("Meta page token exchange failed:", e.message);
    return null;
  }
}

async function subscribePage(pageId, pageToken) {
  try {
    await getJson(`${META_GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: pageToken }),
    });
  } catch (e) {
    console.warn("Meta subscribed_apps failed:", e.message);
  }
}

/**
 * Save Meta settings: a Page id (swaps in its Page token, optionally
 * subscribes the Page to lead webhooks) and/or a Google Sheet URL (synced now).
 * → { settings, sync_summary } | throws { status, message }
 */
export async function saveMetaSettings(adminId, b = {}) {
  const pageId = b.page_id != null ? String(b.page_id).trim() : null;
  const sheetUrl = b.sheet_url != null ? String(b.sheet_url).trim() : null;
  if (pageId && pageId.length > 50) throw Object.assign(new Error("The page id may not be greater than 50 characters."), { status: 422 });
  if (sheetUrl && sheetUrl.length > 2000) throw Object.assign(new Error("The sheet url may not be greater than 2000 characters."), { status: 422 });
  if (b.form_ids != null && (!Array.isArray(b.form_ids) || b.form_ids.some((f) => String(f).length > 50))) {
    throw Object.assign(new Error("The form ids must be a list of ids."), { status: 422 });
  }
  if (!sheetUrl && !pageId) throw Object.assign(new Error("Provide either a Meta Page ID or a Google Sheet URL"), { status: 422 });

  const existing = await prisma.integration.findUnique({ where: { user_platform: { userId: adminId, platform: "facebook" } } });
  let accessToken = existing?.accessToken || "";
  const settings = { ...(existing?.settings || {}) };
  if (pageId) settings.page_id = pageId;
  if (sheetUrl !== null) {
    if (sheetUrl === "") delete settings.sheet_url;
    else {
      settings.sheet_url = sheetUrl;
      settings.token_type = "sheet";
    }
  }
  if (Array.isArray(b.form_ids)) settings.form_ids = b.form_ids.map(String);

  let pageToken = null;
  if (pageId && accessToken) {
    pageToken = await pageAccessToken(accessToken, pageId);
    if (pageToken) {
      accessToken = pageToken;
      settings.token_type = "page";
    } else settings.token_type = settings.token_type || "user";
  }

  const save = (s) =>
    prisma.integration.upsert({
      where: { user_platform: { userId: adminId, platform: "facebook" } },
      create: { userId: adminId, platform: "facebook", accessToken, isActive: true, settings: s },
      update: { accessToken, isActive: true, settings: s },
    });
  let row = await save(settings);

  if (b.subscribe && pageToken && pageId) await subscribePage(pageId, pageToken);

  let summary = null;
  if (settings.sheet_url) {
    try {
      summary = await syncMetaSheet(row, settings.sheet_url);
      settings.sheet_last_error = null;
      settings.sheet_last_import_summary = summary;
    } catch (e) {
      settings.sheet_last_error = e.message;
      settings.sheet_last_import_summary = { imported: 0, skipped: 0, total: 0, skip_reason_counts: {}, skipped_rows: [] };
    }
    settings.sheet_last_synced_at = new Date().toISOString();
    row = await save(settings);
  }
  return { settings: row.settings, sync_summary: summary };
}

// ── Meta lead webhook ───────────────────────────────────────────────────────
export function verifyMetaSignature(rawBody, header) {
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!appSecret || !header || !String(header).startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** One `leadgen` change from the webhook → fetch the lead and save it. */
export async function handleLeadgen(value = {}) {
  const leadId = value.leadgen_id;
  const pageId = value.page_id != null ? String(value.page_id) : null;
  if (!leadId || !pageId) return { saved: false, reason: "missing ids" };
  const integration = await prisma.integration.findFirst({
    where: { platform: "facebook", settings: { path: ["page_id"], equals: pageId } },
  });
  if (!integration) return { saved: false, reason: "no integration for page" };
  const lead = await getJson(`${META_GRAPH}/${encodeURIComponent(leadId)}?${new URLSearchParams({ access_token: integration.accessToken, fields: "id,created_time,ad_id,form_id,field_data" })}`);
  return saveMetaLead(lead, integration.userId);
}

export async function saveMetaLead(data, adminId) {
  const fbId = data?.id ? String(data.id) : null;
  if (fbId && (await prisma.leadInquiry.findFirst({ where: { userId: adminId, fbLeadId: fbId }, select: { id: true } }))) {
    return { saved: false, reason: "duplicate" };
  }
  const field = (name) => (data.field_data || []).find((f) => f?.name === name)?.values?.[0] ?? "";
  let inquiryId;
  do inquiryId = `ADS${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  while (await prisma.leadInquiry.findUnique({ where: { inquiryId } }));
  const lead = await prisma.leadInquiry.create({
    data: {
      userId: adminId,
      inquiryId,
      clientName: field("full_name") || "Ads Lead",
      clientEmail: field("email") || null,
      clientPhone: field("phone_number") || null,
      destination: "Social Media Lead",
      status: "new",
      source: "facebook",
      sourceUrl: "Facebook/Instagram Ad",
      externalId: fbId,
      fbLeadId: fbId,
    },
  });
  await notify(adminId, "new_lead", {
    type: "new_lead",
    message: `New lead: ${lead.clientName} (Meta Lead Ad)`,
    lead_inquiry_id: lead.id,
    inquiry_id: lead.inquiryId,
    client_name: lead.clientName,
    client_phone: lead.clientPhone,
  });
  return { saved: true, id: lead.id };
}

// ── Google Sheet of Meta leads ─────────────────────────────────────────────
const FIELD_MAP = {
  client_name: ["full_name", "name", "first_name", "customer_name", "lead_name", "firstname", "last_name", "lastname"],
  client_email: ["email", "email_address", "e_mail", "emailid"],
  client_phone: ["phone_number", "phone", "mobile", "mobile_number", "contact", "whatsapp", "contact_number", "phonenumber"],
  total_people: ["how_many_people", "number_of_people", "total_people", "people", "pax", "travellers", "travelers"],
  destination: ["destination_to_visit", "destination", "travel_destination", "place", "location", "where_do_you_want_to_travel", "travel_place", "travel_to"],
  duration: ["please_share_number_of_nights_to_stay", "duration", "travel_duration", "days", "number_of_days", "trip_duration", "how_many_days", "nights"],
  start_date: ["when_are_you_planning_to_travel", "travel_date", "start_date", "from_date", "departure_date", "travel_from", "check_in"],
  adults: ["please_share_number_of_adults", "adults", "num_adults", "number_of_adults", "adult", "no_of_adults", "pax_adults"],
  kids_cnb: ["please_share_number_of_kids_under_5", "number_of_kids_under_5", "kids_under_5", "num_kids_under_5", "children_under_5", "under_5", "kids_upto_5", "kids_below_5"],
  kids_5_to_12: ["children", "kids", "num_children", "number_of_children", "child", "no_of_kids", "pax_children", "kids_5_to_12"],
  platform: ["platform", "source_platform", "lead_platform", "channel"],
  approximate_budget: ["budget", "approx_budget", "travel_budget", "estimated_budget"],
  special_requests: ["special_requests", "comments", "notes", "requirements", "any_specific_requirements", "message", "additional_info"],
};
const MAX_SKIP_DETAILS = 25;

export const normalizeHeader = (h) => String(h || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** RFC 4180 CSV → rows of cells (quoted fields, "" escapes, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function sheetCsvUrl(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Google Sheet URL is empty.");
  if (u.includes("output=csv") || u.includes("format=csv")) return u;
  const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error("Invalid Google Sheet URL. Use docs.google.com/spreadsheets/d/{id}/edit#gid=0 format.");
  const gid = u.match(/[?&#]gid=([0-9]+)/)?.[1] ?? null;
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid !== null ? `&gid=${gid}` : ""}`;
}

async function fetchSheetRows(url) {
  const res = await fetchImpl(sheetCsvUrl(url), {
    headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8", "User-Agent": "ViaItinerary/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Google Sheet fetch failed with HTTP ${res.status}. Ensure the sheet is public.`);
  const body = await res.text();
  if (!body.trim()) throw new Error("Google Sheet returned an empty response. Ensure the sheet is published and public.");
  if (/<html|<!doctype/i.test(body)) throw new Error("Google Sheet did not return CSV data. Ensure access does not require login.");
  const [head, ...lines] = parseCsv(body);
  if (!head) throw new Error("Could not read header row from Google Sheet CSV.");
  const headers = head.map(normalizeHeader);
  return lines
    .filter((cells) => cells.some((v) => String(v).trim() !== ""))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? "").trim()]).filter(([h]) => h)));
}

const intOrNull = (v) => {
  const n = String(v ?? "").replace(/[^0-9-]/g, "");
  return n === "" || Number.isNaN(Number(n)) ? null : parseInt(n, 10);
};
const decOrNull = (v) => {
  const n = String(v ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, "");
  return n === "" || !Number.isFinite(Number(n)) ? null : Number(n);
};

/** "25-12-2026", "25/12/26", "2026-12-25", "Dec 25 2026" → Date (UTC midnight) | null. */
export function sheetDate(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let m;
  const utc = (y, mo, d) => {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
  };
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return utc(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) return utc(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/))) return utc(2000 + +m[3], +m[2], +m[1]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function mapSheetRow(row) {
  const out = {};
  for (const [target, keys] of Object.entries(FIELD_MAP)) {
    const k = keys.find((c) => row[c] != null && String(row[c]).trim() !== "");
    if (k) out[target] = String(row[k]).trim();
  }
  if (!out.client_name) {
    const parts = [row.first_name, row.last_name].map((x) => String(x || "").trim()).filter(Boolean);
    if (parts.length) out.client_name = parts.join(" ");
  }
  out.total_people = out.total_people != null ? intOrNull(out.total_people) : null;
  out.adults = out.adults != null ? intOrNull(out.adults) : null;
  out.kids_cnb = out.kids_cnb != null ? intOrNull(out.kids_cnb) : null;
  if (!(out.total_people > 0)) {
    const a = out.adults || 0;
    const k = out.kids_cnb || 0;
    if (a > 0 || k > 0) out.total_people = a + k;
  }
  out.kids_5_to_12 = out.kids_5_to_12 != null ? Math.max(0, intOrNull(out.kids_5_to_12) || 0) : null;
  out.duration = out.duration != null ? Math.max(1, intOrNull(out.duration) || 0) : null;
  out.approximate_budget = out.approximate_budget != null ? decOrNull(out.approximate_budget) : null;
  out.start_date = sheetDate(out.start_date);
  out.platform = out.platform ? out.platform.toLowerCase() : null;
  out.created_at = null;
  for (const k of ["created_at", "created_time", "submitted_at", "timestamp", "date", "time"]) {
    const v = String(row[k] || "").trim();
    const d = v ? new Date(v) : null;
    if (d && !Number.isNaN(d.getTime())) {
      out.created_at = d;
      break;
    }
  }
  return out;
}

export function missingFields(p) {
  const miss = [];
  const filled = (v) => v != null && String(v).trim() !== "";
  if (!filled(p.client_name)) miss.push("Name");
  if (!filled(p.client_phone)) miss.push("Contact");
  if (!filled(p.client_email)) miss.push("Email");
  if (p.adults == null || p.adults < 0) miss.push("Number of Adults");
  if (p.kids_cnb == null || p.kids_cnb < 0) miss.push("Number of Kids under 5");
  if (!(p.total_people >= 1)) miss.push("At least one adult or kid under 5");
  if (!p.start_date) miss.push("Date of Travel");
  if (!filled(p.platform)) miss.push("Platform");
  return miss;
}

/** Import new rows of the sheet as leads. → { imported, skipped, total, skip_reason_counts, skipped_rows } */
export async function syncMetaSheet(integration, url) {
  const rows = await fetchSheetRows(url || integration.settings?.sheet_url);
  let imported = 0;
  let skipped = 0;
  const reasons = {};
  const skippedRows = [];
  const skip = (reason, detail) => {
    skipped++;
    reasons[reason] = (reasons[reason] || 0) + 1;
    if (skippedRows.length < MAX_SKIP_DETAILS) skippedRows.push({ reason, ...detail });
  };
  for (const [i, row] of rows.entries()) {
    const p = mapSheetRow(row);
    const sheetRow = i + 2;
    const miss = missingFields(p);
    if (miss.length) {
      skip("missing_required_fields", { row: sheetRow, missing_fields: miss });
      continue;
    }
    const rowId = String(row.id || row.lead_id || "").trim();
    const externalId = rowId
      ? `meta_sheet_${rowId}`
      : `meta_sheet_${crypto.createHash("sha1").update(`${integration.userId}|${JSON.stringify(row)}`).digest("hex")}`;
    if (await prisma.leadInquiry.findFirst({ where: { userId: integration.userId, externalId }, select: { id: true } })) {
      skip("duplicate_lead", { row: sheetRow, external_id: externalId });
      continue;
    }
    let inquiryId = generateInquiryId();
    while (await prisma.leadInquiry.findUnique({ where: { inquiryId } })) inquiryId = generateInquiryId();
    const platform = p.platform || "";
    const lead = await prisma.leadInquiry.create({
      data: {
        inquiryId,
        userId: integration.userId,
        clientName: p.client_name,
        clientEmail: p.client_email,
        clientPhone: p.client_phone,
        destination: p.destination || "Social Media Lead",
        adults: p.adults ?? 1,
        kidsCnb: p.kids_cnb ?? 0,
        kids5to12: p.kids_5_to_12 ?? 0,
        startDate: p.start_date,
        duration: p.duration != null ? String(p.duration) : null,
        approximateBudget: p.approximate_budget,
        currency: "INR (₹)",
        specialRequests: p.special_requests || null,
        status: "new",
        source: platform === "ig" || platform.includes("insta") ? "instagram" : "facebook", // Meta sheets say "ig" / "fb"
        sourceUrl: platform ? `${platform[0].toUpperCase()}${platform.slice(1)} (Google Sheet)` : "Google Sheet",
        externalId,
        utmSource: platform || null,
        notes: `Imported from Meta Google Sheet (row ${sheetRow}) | Platform: ${platform} | Total people: ${p.total_people}`,
        ...(p.created_at ? { createdAt: p.created_at } : {}),
      },
    });
    await notify(integration.userId, "new_lead", {
      type: "new_lead",
      message: `New lead: ${lead.clientName} (Meta Sheet Import)`,
      lead_inquiry_id: lead.id,
      inquiry_id: lead.inquiryId,
      client_name: lead.clientName,
      client_phone: lead.clientPhone,
    });
    imported++;
  }
  return { imported, skipped, total: rows.length, skip_reason_counts: reasons, skipped_rows: skippedRows };
}
