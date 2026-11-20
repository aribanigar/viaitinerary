// react-pdf can only draw JPG and PNG. A WebP or AVIF photo (destinations
// imported from the old Via Kashmir CRM, some hotel and Pixabay photos) is
// silently left out of the PDF, so a day or hotel came out with no picture.
// Before rendering, fetch each photo once: JPG/PNG pass through untouched,
// anything else is converted to JPEG with sharp.

const MAX_BYTES = 15 * 1024 * 1024;

const isJpgOrPng = (buf) =>
  buf.length > 4 &&
  ((buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47));

let sharpLoader;
const loadSharp = () => {
  if (!sharpLoader) sharpLoader = import("sharp").then((m) => m.default || m).catch(() => null);
  return sharpLoader;
};

async function readImage(src) {
  if (src.startsWith("data:")) {
    const m = src.match(/^data:[^;,]*;base64,(.*)$/s);
    return m ? Buffer.from(m[1], "base64") : null;
  }
  const res = await fetch(src, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const body = Buffer.from(await res.arrayBuffer());
  return body.length && body.length <= MAX_BYTES ? body : null;
}

async function toPdfSafe(src) {
  if (typeof src !== "string" || !/^(https?:|data:)/.test(src)) return src;
  if (/^data:image\/(jpe?g|png);/i.test(src)) return src;
  try {
    const buf = await readImage(src);
    if (!buf) return src;
    if (isJpgOrPng(buf)) return src; // react-pdf draws it as is
    const sharp = await loadSharp();
    if (!sharp) return src;
    const jpg = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return src; // worst case: left out, as before
  }
}

/**
 * Copies of trip and settings whose photos react-pdf can draw. Covers every
 * photo the PDFs use: trip cover, day photos, hotel photos and hotel options,
 * agency logo and confirmation hero image.
 */
export async function pdfReadyImages(trip, settings) {
  const cache = new Map();
  const fix = (src) => {
    if (typeof src !== "string" || !src) return Promise.resolve(src);
    if (!cache.has(src)) cache.set(src, toPdfSafe(src));
    return cache.get(src);
  };

  const t = trip ? { ...trip } : trip;
  const s = settings ? { ...settings } : settings;
  const jobs = [];

  if (t) {
    jobs.push(fix(t.imagePath).then((v) => { t.imagePath = v; }));
    if (Array.isArray(t.itineraries)) {
      t.itineraries = t.itineraries.map((d) => {
        const day = { ...d };
        jobs.push(fix(day.imagePath).then((v) => { day.imagePath = v; }));
        return day;
      });
    }
    if (Array.isArray(t.accommodations)) {
      t.accommodations = t.accommodations.map((a) => {
        const acc = { ...a };
        jobs.push(fix(acc.imagePath).then((v) => { acc.imagePath = v; }));
        if (acc.hotel) {
          acc.hotel = { ...acc.hotel };
          jobs.push(fix(acc.hotel.imagePath).then((v) => { acc.hotel.imagePath = v; }));
        }
        if (Array.isArray(acc.alternateOptions)) {
          acc.alternateOptions = acc.alternateOptions.map((o) => {
            if (!o || typeof o !== "object") return o;
            const opt = { ...o };
            jobs.push(fix(opt.photo).then((v) => { opt.photo = v; }));
            return opt;
          });
        }
        return acc;
      });
    }
  }
  if (s) {
    jobs.push(fix(s.logoPath).then((v) => { s.logoPath = v; }));
    jobs.push(fix(s.confirmationHeroImage).then((v) => { s.confirmationHeroImage = v; }));
  }

  await Promise.all(jobs);
  return { trip: t, settings: s };
}
