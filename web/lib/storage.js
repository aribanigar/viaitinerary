// Supabase Storage integration. Uploads live in a public bucket and are served
// by their public URL. If the service key isn't configured, everything falls
// back to inline data URLs so nothing breaks.

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";

export function storageEnabled() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  // Create the bucket if it doesn't exist (idempotent — 400/409 if it already does).
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  }).catch(() => {});
  bucketReady = true;
}

const rand = () => Math.random().toString(36).slice(2, 10);

/** Upload a Buffer, return its public URL. Throws on failure. */
export async function uploadBuffer(buffer, contentType, prefix = "uploads") {
  if (!storageEnabled()) throw new Error("Supabase Storage is not configured.");
  await ensureBucket();
  const ext = (contentType.split("/")[1] || "bin").split("+")[0];
  const objectPath = `${prefix}/${Date.now()}-${rand()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

/**
 * Normalize an image value for saving: if it's a base64 data URL, offload it to
 * Supabase Storage and return the public URL; otherwise (http URL, null,
 * undefined) return it unchanged. Never throws — falls back to the raw value so
 * a storage hiccup can't break a save.
 */
export async function persistImage(value, prefix = "uploads") {
  if (!value || typeof value !== "string") return value;
  if (!value.startsWith("data:")) return value; // already a URL or path
  if (!storageEnabled()) return value; // keep inline until configured
  const m = value.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return value;
  try {
    return await uploadBuffer(Buffer.from(m[2], "base64"), m[1], prefix);
  } catch {
    return value; // fall back to inline on any storage error
  }
}
