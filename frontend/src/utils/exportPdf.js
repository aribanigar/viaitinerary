// html2canvas-pro (maintained fork) fixes the text-baseline drift that made
// exported text render lower than the preview (e.g. the cover title overlapping
// its subtitle with line-height < 1). Drop-in replacement for html2canvas.
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// WYSIWYG PDF export: rasterizes the *actual* rendered itinerary preview
// (whatever template + data is on screen) into an A4 PDF, one page per
// template page. This guarantees the export matches the live preview exactly.

const A4 = { w: 210, h: 297 }; // mm

// wait for every <img> inside `node` to finish loading (or error out) so the
// canvas capture doesn't miss late images.
function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) => {
      // allow cross-origin (Supabase / external) images to be captured
      if (!img.crossOrigin) img.crossOrigin = "anonymous";
      // re-assign src to kick off a CORS-enabled fetch on the clone
      const src = img.src;
      if (src) img.src = src;
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 5000);
      });
    }),
  );
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const isExternal = (url) => {
  try {
    const u = new URL(url, window.location.href);
    return /^https?:$/.test(u.protocol) && u.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// The canvas can only capture a cross-origin photo when its host sends CORS
// headers; anything else (most hotel photo hosts) came out blank in the PDF.
// Swap every external photo in the clone — <img> and CSS background — for a
// data URL fetched through our same-origin /image-proxy. A photo that still
// can't be fetched is left as-is (worst case: blank, as before).
async function inlineExternalImages(node, proposalToken) {
  const cache = new Map();
  const toDataUrl = (url) => {
    if (!cache.has(url)) {
      const qs = new URLSearchParams({ url });
      if (proposalToken) qs.set("p", proposalToken);
      cache.set(
        url,
        fetch(`${API_BASE}/image-proxy?${qs}`, { credentials: "include" })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? blobToDataUrl(b) : null))
          .catch(() => null),
      );
    }
    return cache.get(url);
  };

  const jobs = [];
  node.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || !isExternal(src)) return;
    jobs.push(
      toDataUrl(new URL(src, window.location.href).href).then((data) => {
        if (data) img.src = data;
      }),
    );
  });
  node.querySelectorAll("[style*='url(']").forEach((el) => {
    const match = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match || !isExternal(match[1])) return;
    jobs.push(
      toDataUrl(new URL(match[1], window.location.href).href).then((data) => {
        if (data) el.style.backgroundImage = `url("${data}")`;
      }),
    );
  });
  await Promise.all(jobs);
}

/**
 * Rasterize the on-screen itinerary preview into a jsPDF document. Shared by
 * both the direct-download and share (Blob) export paths below.
 */
async function buildPreviewPdf({ proposalToken } = {}) {
  // the preview renders either the Modern or Classic template wrapper
  const source = document.querySelector(
    ".trip-preview-wrapper, .classic-template-wrapper",
  );
  if (!source) throw new Error("Preview not found");

  const isModern = source.classList.contains("trip-preview-wrapper");

  // clone the rendered preview into an off-screen, unscaled holder so the CSS
  // `zoom` used in the panel doesn't affect the capture.
  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;background:#ffffff;z-index:-1;";
  const clone = source.cloneNode(true);
  clone.style.transform = "none";
  if (isModern) clone.classList.add("pdf-export-mode");
  // NOTE: we intentionally keep the template's @import web font in the clone.
  // html2canvas renders in a sandbox and needs the @font-face to reproduce the
  // exact font metrics — dropping it falls back to a system font whose taller
  // line-heights push every element down (export no longer matches preview).
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    // make sure the web fonts are actually loaded before rasterizing, so
    // html2canvas captures with the same metrics as the on-screen preview.
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 6000)),
      ]).catch(() => {});
    }
    await inlineExternalImages(clone, proposalToken);
    await waitForImages(clone);
    await new Promise((r) => setTimeout(r, 250));

    const pages = Array.from(
      clone.querySelectorAll(isModern ? ".page" : ".classic-page"),
    );
    const targets = pages.length ? pages : [clone];

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 5000,
        windowWidth: targets[i].scrollWidth,
        windowHeight: targets[i].scrollHeight,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      // fit each captured page to a full A4 page
      pdf.addImage(img, "JPEG", 0, 0, A4.w, A4.h, undefined, "FAST");
    }

    return pdf;
  } finally {
    holder.remove();
  }
}

/**
 * Export the on-screen itinerary preview to a downloadable PDF.
 * @param {string} filename  e.g. "TRP123_Itinerary.pdf"
 * @param {{ proposalToken?: string }} [options]  pass the proposal token on
 *   the public client page (no login) so its photos can be fetched
 */
export async function exportPreviewToPdf(filename = "Itinerary.pdf", options) {
  const pdf = await buildPreviewPdf(options);
  pdf.save(filename);
}

/**
 * Same rasterization, returned as a Blob instead of triggering a download —
 * for handing the PDF to the Web Share API (e.g. sharing straight to
 * WhatsApp) rather than saving it to disk first.
 */
export async function exportPreviewToPdfBlob() {
  const pdf = await buildPreviewPdf();
  return pdf.output("blob");
}
