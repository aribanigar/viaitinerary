import { persistImage, storageEnabled, uploadBuffer } from "@/lib/storage";

// Landing-page content managed by the super admin: showcase cards and
// "trusted by" logos. Shapes match the admin + landing components.

export function serializeShowcase(s) {
  return {
    id: s.id,
    city: s.city,
    title: s.title,
    agency_name: s.agencyName,
    whatsapp_number: s.whatsappNumber,
    price: s.price == null ? null : Number(s.price).toFixed(2),
    image: s.image,
    image_url: s.image || null,
    is_active: s.isActive,
    sort_order: s.sortOrder,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

const has = (b, k) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;
const bool = (v) => v === true || v === 1 || v === "1" || v === "true";

/** Body → Prisma data. `partial` for updates (only keys sent). → { data } | { errors } */
export async function parseShowcase(b = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};
  const text = (key, label, required) => {
    if (!has(b, key)) {
      if (required && !partial) errors[key] = [`The ${label} field is required.`];
      return;
    }
    const v = String(b[key] ?? "").trim();
    if (!v && required) errors[key] = [`The ${label} field is required.`];
    else data[key === "agency_name" ? "agencyName" : key] = v || null;
  };
  text("city", "city", true);
  text("title", "title", true);
  text("agency_name", "agency name", false);
  // Required on create and update, as before.
  const phone = String(b.whatsapp_number ?? "").trim();
  if (!phone || phone.replace(/\D/g, "").length < 7) errors.whatsapp_number = ["The whatsapp number must be a valid phone number."];
  else data.whatsappNumber = phone;
  if (has(b, "price") || !partial) {
    const n = Number(b.price);
    if (b.price === "" || b.price === null || !Number.isFinite(n)) errors.price = ["The price must be a number."];
    else data.price = n;
  }
  if (has(b, "is_active")) data.isActive = bool(b.is_active);
  if (has(b, "sort_order")) {
    const n = parseInt(b.sort_order, 10);
    if (!Number.isInteger(n)) errors.sort_order = ["The sort order must be an integer."];
    else data.sortOrder = n;
  }
  if (Object.keys(errors).length) return { errors };
  if (has(b, "image") && b.image) data.image = await persistImage(String(b.image), "showcase");
  return { data };
}

export function serializeCompany(c) {
  return {
    id: c.id,
    name: c.name,
    logo_path: c.logoPath,
    logo_url: c.logoPath || null,
    is_active: c.isActive,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

const LOGO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const LOGO_MAX = 2 * 1024 * 1024;

/** An uploaded logo (multipart File) → stored URL. → { url } | { error } */
export async function storeLogo(file) {
  if (!file || typeof file.arrayBuffer !== "function") return { error: "The logo field is required." };
  if (!LOGO_TYPES.includes(file.type)) return { error: "The logo must be a file of type: jpeg, jpg, png, webp." };
  if (file.size > LOGO_MAX) return { error: "The logo may not be greater than 2048 kilobytes." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (storageEnabled()) {
    try {
      return { url: await uploadBuffer(buf, file.type, "trusted-companies") };
    } catch (e) {
      console.error("logo upload failed:", e?.message || e);
    }
  }
  return { url: `data:${file.type};base64,${buf.toString("base64")}` };
}
