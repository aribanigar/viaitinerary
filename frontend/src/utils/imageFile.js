// Every image the app uploads (logos, covers, hero images, hotel / cab /
// activity photos) goes through here first:
//  - phone photos are turned upright (EXIF orientation) and scaled down, so a
//    12 MB camera shot doesn't hit the server's ~4.5 MB request limit;
//  - the result is JPEG, or PNG when the image has transparency (logos) —
//    the server PDFs (@react-pdf) silently drop WebP/AVIF/GIF, which made
//    WebP logos vanish from invoices, vouchers and confirmations.
import { request } from "./apiClient";

const MAX_INPUT_BYTES = 30 * 1024 * 1024;
// A JPEG/PNG already this small and within maxSide is sent untouched.
const KEEP_AS_IS_BYTES = 350 * 1024;

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Couldn't read the file."));
    reader.readAsDataURL(blob);
  });

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> (older Safari, SVG) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasTransparency(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h);
  const step = Math.max(4, Math.floor(data.length / 4 / 40000) * 4); // ~40k samples
  for (let i = 3; i < data.length; i += step) if (data[i] < 250) return true;
  return false;
}

/**
 * File → data URL ready to save. Throws an Error with a message fit for a
 * toast when the file isn't a readable image.
 * maxSide: longest edge in px (photos 1600, logos 800).
 */
export async function prepareImage(file, { maxSide = 1600, quality = 0.85 } = {}) {
  if (!file) throw new Error("No file chosen.");
  if (!/^image\//.test(file.type || "") && !/\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name || "")) {
    throw new Error("Please choose an image (JPG, PNG or WebP).");
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is too large (max 30 MB).");

  let bitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error("This image format can't be opened here — please use JPG or PNG.");
  }
  const w0 = bitmap.width || bitmap.naturalWidth;
  const h0 = bitmap.height || bitmap.naturalHeight;
  if (!w0 || !h0) throw new Error("This image looks empty — please try another one.");

  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const keepOriginal =
    scale === 1 && /^image\/(jpeg|png)$/.test(file.type) && file.size <= KEEP_AS_IS_BYTES;
  if (keepOriginal) {
    bitmap.close?.();
    return readAsDataUrl(file);
  }

  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const mayHaveAlpha = !/^image\/jpe?g$/.test(file.type);
  if (mayHaveAlpha && hasTransparency(ctx, w, h)) return canvas.toDataURL("image/png");
  // Paint a white page under JPEG (no alpha) so stray transparent pixels aren't black.
  const flat = document.createElement("canvas");
  flat.width = w;
  flat.height = h;
  const fctx = flat.getContext("2d");
  fctx.fillStyle = "#fff";
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(canvas, 0, 0);
  return flat.toDataURL("image/jpeg", quality);
}

/** A fetched Blob (e.g. a Google Places photo) → the same normalised data URL. */
export async function prepareImageBlob(blob, options) {
  const file = new File([blob], "photo", { type: blob.type || "image/jpeg" });
  return prepareImage(file, options);
}

/**
 * prepareImage + upload once (POST /api/uploads/image) → a hosted URL. Used
 * where the value is saved again and again (the Trip Builder autosaves), so
 * the image travels once. If the upload fails the prepared data URL is
 * returned and the normal save path stores it, as before.
 */
export async function uploadImage(token, file, { kind = "trips", ...options } = {}) {
  const dataUrl = await prepareImage(file, options);
  try {
    const res = await request("/uploads/image", {
      method: "POST",
      token,
      body: JSON.stringify({ image: dataUrl, kind }),
    });
    return res?.url || dataUrl;
  } catch {
    return dataUrl;
  }
}
