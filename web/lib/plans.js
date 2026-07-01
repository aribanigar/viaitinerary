import prisma from "@/lib/prisma";
import { storageEnabled, uploadBuffer } from "@/lib/storage";

const intOrNull = (v) => (v === undefined || v === null || v === "" ? null : parseInt(v, 10));
const bool = (v) => v === "1" || v === 1 || v === true || v === "true";

/** Unique plan key (snake of name, or provided), de-duped. */
export async function uniquePlanKey(base, excludeId) {
  let key = String(base || "plan").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "plan";
  const original = key;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.plan.findFirst({ where: { key, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return key;
    key = `${original}_${n++}`;
  }
}

/** Build plan write-data from a multipart form (create or update). */
export async function planDataFromForm(form) {
  const data = {};
  const set = (k, col, fn = (x) => x) => {
    if (form.has(k)) data[col] = fn(form.get(k));
  };

  set("name", "name", (v) => String(v));
  if (form.has("country")) {
    const c = String(form.get("country") || "").trim().toUpperCase();
    data.country = c || null;
  }
  const original = form.get("original_price");
  const price = form.get("price");
  if (original != null && original !== "") data.originalPrice = Number(original);
  if (price != null && price !== "") data.price = Number(price);
  else if (original != null && original !== "") data.price = Number(original);

  set("duration_months", "durationMonths", (v) => parseInt(v, 10) || 1);
  set("trip_limit", "tripLimit", intOrNull);
  set("hotel_limit", "hotelLimit", intOrNull);
  set("cab_limit", "cabLimit", intOrNull);
  set("destination_limit", "destinationLimit", intOrNull);
  if (form.has("team_member_limit")) data.teamMemberLimit = intOrNull(form.get("team_member_limit")) ?? 0;
  set("badge_label", "badgeLabel", (v) => String(v || "") || null);
  set("recommended", "recommended", bool);
  set("is_active", "isActive", bool);
  set("is_offer", "isOffer", bool);
  if (form.has("offer_starts_at")) data.offerStartsAt = form.get("offer_starts_at") ? new Date(form.get("offer_starts_at")) : null;
  if (form.has("offer_expires_at")) data.offerExpiresAt = form.get("offer_expires_at") ? new Date(form.get("offer_expires_at")) : null;

  // features[0], features[1], ...
  const features = [];
  for (const [k, v] of form.entries()) {
    if (/^features\[\d+\]$/.test(k) && String(v).trim()) features.push(String(v));
  }
  if (features.length || [...form.keys()].some((k) => k.startsWith("features"))) data.features = features;

  // Offer image upload → Supabase Storage.
  const file = form.get("offer_image_file");
  if (file && typeof file.arrayBuffer === "function" && file.size > 0 && storageEnabled()) {
    const buf = Buffer.from(await file.arrayBuffer());
    data.offerImage = await uploadBuffer(buf, file.type || "image/jpeg", "offers");
  }

  return data;
}

/** Map a snake_case JSON body (from the toggle) to plan write-data. */
export function planDataFromJson(body) {
  const data = {};
  const m = {
    name: "name", price: "price", original_price: "originalPrice", duration_months: "durationMonths",
    trip_limit: "tripLimit", hotel_limit: "hotelLimit", cab_limit: "cabLimit", destination_limit: "destinationLimit",
    team_member_limit: "teamMemberLimit", badge_label: "badgeLabel", recommended: "recommended",
    is_active: "isActive", is_offer: "isOffer",
  };
  for (const [snake, camel] of Object.entries(m)) {
    if (body[snake] === undefined) continue;
    if (["price", "originalPrice"].includes(camel)) data[camel] = body[snake] == null ? null : Number(body[snake]);
    else if (["durationMonths", "tripLimit", "hotelLimit", "cabLimit", "destinationLimit", "teamMemberLimit"].includes(camel))
      data[camel] = body[snake] === "" || body[snake] == null ? (camel === "teamMemberLimit" ? 0 : null) : parseInt(body[snake], 10);
    else data[camel] = body[snake];
  }
  if (Array.isArray(body.features)) data.features = body.features.filter((f) => String(f).trim());
  return data;
}
