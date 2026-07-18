import html2canvas from "html2canvas";
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

/**
 * Export the on-screen itinerary preview to a downloadable PDF.
 * @param {string} filename  e.g. "TRP123_Itinerary.pdf"
 */
export async function exportPreviewToPdf(filename = "Itinerary.pdf") {
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
  // Strip cross-origin @import (Google Fonts) from cloned <style> tags — the
  // fonts are already loaded on the page, and letting html2canvas re-fetch
  // them can hang. Keep the rest of the CSS intact.
  clone.querySelectorAll("style").forEach((st) => {
    st.textContent = st.textContent.replace(/@import\s+url\([^)]*\);?/g, "");
  });
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    // make sure fonts + images are ready before rasterizing (bounded)
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 2500)),
      ]).catch(() => {});
    }
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

    pdf.save(filename);
  } finally {
    holder.remove();
  }
}
