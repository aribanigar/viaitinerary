import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Path,
  Polygon,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { POPPINS_REGULAR, POPPINS_SEMIBOLD } from "./pdf-assets.js";
import { VIA_KASHMIR_LOGO, VIA_KASHMIR_LOGO_RATIO } from "./vk-logo.js";
import prisma from "@/lib/prisma";

// Server-side PDF generation (react-pdf, no Chromium). This is a faithful
// reproduction of the in-app ModernTemplate live preview, so the exported PDF
// matches WYSIWYG: dark-green cover, orange accents, section bars with the
// "///" doodle, light hotel cards, day badges, tables. Fully dynamic from the
// trip builder data + agency settings (brandColor / secondaryColor honored).

const h = React.createElement;

// Bundle Poppins so it's always available on serverless.
Font.register({
  family: "Poppins",
  fonts: [
    { src: POPPINS_REGULAR, fontWeight: 400 },
    { src: POPPINS_SEMIBOLD, fontWeight: 600 },
    { src: POPPINS_SEMIBOLD, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]);

// ── helpers ──────────────────────────────────────────────────────────────
function currencySymbol(currency) {
  if (!currency) return "₹";
  const m = String(currency).match(/\((.*?)\)/);
  return m ? m[1].trim() : String(currency).trim();
}
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
const fmtDayLabel = (d, i) => {
  const ord = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
  const base = ord[i] || `${i + 1}th`;
  if (!d) return `${base} Day`;
  const dt = new Date(d);
  const day = dt.toLocaleDateString("en-GB", { weekday: "short" });
  const dm = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${base} Day (${day}, ${dm})`;
};
const ordinal = (i) =>
  ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"][i] || `${i + 1}th`;
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const isImg = (u) => typeof u === "string" && /^(https?:|data:)/.test(u);
// react-pdf can only draw JPG/PNG. Cloudinary images stored as AVIF/WebP (117
// of Via Kashmir's hotels, 2026-10-03) are fetched as JPG instead - Cloudinary
// converts on the fly when the URL asks for .jpg with f_jpg.
const pdfImg = (u) => {
  const v = String(u || "");
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(v) && /\.(avif|webp|heic|gif)(\?.*)?$/i.test(v)) {
    return v.replace("/image/upload/", "/image/upload/f_jpg,q_80,w_1400/").replace(/\.(avif|webp|heic|gif)(\?.*)?$/i, ".jpg");
  }
  return v;
};
const txt = (v) => (v == null || v === "" ? "" : String(v));
const curCode = (c) => (c ? String(c).split(/[\s(]/)[0] : "INR");
const num = (n) => Number(n || 0).toLocaleString("en-IN");
const money = (n, cur) => `${curCode(cur)} ${num(n)}`;
const MEAL = { room_only: "Room only (EP)", breakfast_only: "Breakfast (CP)", breakfast_dinner: "Breakfast & dinner (MAP)", all_meals: "All meals (AP)", ep: "Room only (EP)", cp: "Breakfast (CP)", map: "Breakfast & dinner (MAP)", ap: "All meals (AP)" };
const mealLabel = (v) => MEAL[String(v || "").toLowerCase()] || txt(v);
// ── Hotel packages (Standard / Deluxe / …) ─────────────────────────────
// Server copy of frontend/src/utils/hotelOptions.js (stayPackageGroups /
// hotelPackages) for the server-rendered itinerary — keep the two in step.
// Each optional hotel carries `package` (index) and `supplement` (client-facing
// difference over the stay's main hotel, stored by the builder at save).
const DEFAULT_PACKAGE_NAMES = ["Standard", "Deluxe", "Luxury"];
const pkgIndex = (o) => (parseInt(o?.package, 10) > 0 ? parseInt(o.package, 10) : 0);
const isNum = (v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
const packageName = (trip, k) =>
  txt(arr(trip.hotelPackageNames)[k]).trim() || DEFAULT_PACKAGE_NAMES[k] || `Package ${String.fromCharCode(65 + k)}`;
function stayPackageGroups(trip, a) {
  const options = arr(a.alternateOptions).filter((o) => txt(o?.name).trim());
  const maxIndex = Math.max(0, ...options.map(pkgIndex));
  const groups = [];
  for (let k = 0; k <= maxIndex; k++) {
    const members = options.filter((o) => pkgIndex(o) === k);
    const list = k === 0 ? [{ name: a.name || a.hotel?.name, supplement: 0, isMain: true }, ...members] : members;
    if (!list.length) continue;
    const ref = list[0].supplement;
    groups.push({
      index: k,
      name: packageName(trip, k),
      hotels: list.map((o, i) => ({
        ...o,
        diff: i === 0 ? null : isNum(o.supplement) && isNum(ref) ? Math.round(Number(o.supplement)) - Math.round(Number(ref)) : null,
      })),
    });
  }
  return groups;
}
function tripPackages(trip, hotels) {
  const stays = hotels
    .filter((a) => !a.cancelledAt)
    .sort((x, y) => new Date(x.checkIn || 8.64e15) - new Date(y.checkIn || 8.64e15));
  const perStay = stays.map((a) => stayPackageGroups(trip, a));
  const used = [...new Set(perStay.flatMap((gs) => gs.map((g) => g.index)))].sort((x, y) => x - y);
  if (used.length < 2) return null;
  const base = Math.round(Number(trip.cost) || 0);
  return {
    stays: stays.map((a) => ({
      city: txt(a.city || a.hotel?.city),
      nights: a.checkIn && a.checkOut ? Math.max(1, Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000)) : 1,
    })),
    packages: used.map((k) => {
      let total = base;
      const cells = perStay.map((groups) => {
        const own = groups.find((g) => g.index === k);
        if (own && k > 0 && total != null) {
          const ref = own.hotels[0].supplement;
          total = isNum(ref) ? total + Math.round(Number(ref)) : null;
        }
        return (own || groups.find((g) => g.index === 0)).hotels;
      });
      return { index: k, name: packageName(trip, k), cells, total };
    }),
  };
}
const diffText = (n, cur) => {
  if (!isNum(n)) return "";
  const v = Math.round(Number(n));
  if (v === 0) return "same price";
  return v > 0 ? `+${money(v, cur)}` : `${money(-v, cur)} less`;
};

// Optional hotel's stored client-facing price difference for its stay.
const supplementText = (n, cur) => {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "";
  const v = Math.round(Number(n));
  if (v === 0) return "Same price";
  return v > 0 ? `+${money(v, cur)} for this stay` : `${money(-v, cur)} less for this stay`;
};

// ModernTemplate palette (matches ModernTemplate.jsx CSS variables).
const ORANGE = "#FAA61A"; // --primary-orange
const GREEN = "#0D2D2D"; // --dark-green / --header-green
const LIGHTBG = "#FDF9F0"; // --light-bg (hotel cards)
const TEXTGRAY = "#333333"; // --text-gray
const WHITE = "#ffffff";

const brandOf = (s) => s?.brandColor || ORANGE;
const greenOf = (s) => s?.secondaryColor || GREEN;
const agencyOf = (s) => s?.agencyName || "Via Itinerary";

const s = StyleSheet.create({
  page: { fontSize: 10, color: TEXTGRAY, fontFamily: "Poppins" },
  bold: { fontWeight: 700 },
});

// hand-drawn "///" doodle (orange) used on section bars
function Doodle({ style, color = ORANGE }) {
  return h(
    Svg,
    { width: 30, height: 20, viewBox: "0 0 30 20", style },
    h(Path, {
      d: "M3 18 L11 3 M10 19 L18 4 M17 18 L25 4",
      stroke: color,
      strokeWidth: 2.6,
      strokeLinecap: "round",
    }),
  );
}

// star rating
function Stars({ count, color }) {
  const pts = "10,1 12.6,7 19,7.3 14,11.5 15.8,18 10,14.3 4.2,18 6,11.5 1,7.3 7.4,7";
  return h(
    View,
    { style: { flexDirection: "row", gap: 3, marginTop: 6, marginBottom: 6 } },
    ...Array.from({ length: Math.max(0, Math.min(5, count || 0)) }, (_, i) =>
      h(
        Svg,
        { key: i, width: 13, height: 13, viewBox: "0 0 20 20" },
        h(Polygon, { points: pts, fill: color }),
      ),
    ),
  );
}

function WhatsAppMark({ color, size = 14 }) {
  return h(
    Svg,
    { width: size, height: size, viewBox: "0 0 32 32" },
    h(Path, {
      d: "M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.8 1 3.9 1.5 6.2 1.5 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.5 18.3c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.1-.5-.2-1.2-.4-2.1-.8-3.7-1.6-6.1-5.3-6.3-5.6-.2-.2-1.5-2-1.5-3.8s.9-2.7 1.3-3.1c.3-.3.7-.4 1-.4h.7c.2 0 .5 0 .8.6.3.7 1 2.4 1.1 2.5.1.2.1.4 0 .6-.4.9-.9 1.1-.6 1.6.9 1.5 1.8 2 3.1 2.7.2.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.9.9 2.2 1.1.3.1.5.2.6.3.1.3.1.9-.2 1.7z",
      fill: color,
    }),
  );
}

// inner-page footer: orange line + contacts in dark green
function innerFooter(settings) {
  const green = greenOf(settings);
  const phone = settings?.whatsapp || settings?.contactPhone;
  const cell = (v, i, extra) =>
    h(Text, { key: i, style: { ...s.bold, color: green, fontSize: 10, ...extra } }, txt(v));
  return h(
    View,
    { style: { position: "absolute", bottom: 0, left: 0, right: 0 }, fixed: true },
    h(View, { style: { height: 3, width: 170, backgroundColor: brandOf(settings), marginLeft: 50, marginBottom: 10 } }),
    h(
      View,
      { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 50, paddingBottom: 24 } },
      settings?.contactEmail ? cell(settings.contactEmail, "e") : h(View, { key: "e" }),
      h(
        View,
        { key: "w", style: { flexDirection: "row", alignItems: "center", gap: 5 } },
        h(WhatsAppMark, { color: green, size: 13 }),
        h(Text, { style: { ...s.bold, color: green, fontSize: 10 } }, txt(phone)),
      ),
      settings?.website ? cell(settings.website, "s") : h(View, { key: "s" }),
    ),
  );
}

// inner-page header: orange "N NIGHT M DAYS" label + agency wordmark (right)
function pageHeader(trip, settings) {
  const brand = brandOf(settings);
  const green = greenOf(settings);
  const nights = parseInt(trip.duration) || 0;
  return h(
    View,
    { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" } },
    h(
      View,
      { style: { backgroundColor: brand, paddingVertical: 14, paddingLeft: 40, paddingRight: 48, borderBottomRightRadius: 28, maxWidth: 380 } },
      h(Text, { style: { ...s.bold, color: WHITE, fontSize: 22, letterSpacing: 0.5 } }, `${nights} NIGHT ${nights + 1} DAYS`),
      h(Text, { style: { color: WHITE, fontSize: 7.5, fontWeight: 600, letterSpacing: 1.5 } }, `TRAVEL ITINERARY BY ${agencyOf(settings).toUpperCase()}`),
    ),
    h(
      View,
      { style: { alignItems: "flex-end", paddingTop: 20, paddingRight: 40 } },
      isImg(settings?.logoPath)
        ? h(Image, { src: pdfImg(settings.logoPath), style: { height: 34, objectFit: "contain" } })
        : h(
            View,
            { style: { alignItems: "flex-end" } },
            h(Text, { style: { ...s.bold, color: green, fontSize: 20, letterSpacing: 4 } }, agencyOf(settings).toUpperCase()),
            h(Text, { style: { color: green, fontSize: 7, fontWeight: 600, letterSpacing: 3 } }, "TRAVEL SIMPLIFIED"),
          ),
    ),
  );
}

// dark-green section title bar with orange /// doodle (95% width, left tab)
function sectionBar(title, settings) {
  const green = greenOf(settings);
  return h(
    View,
    { style: { marginTop: 22, marginBottom: 8, width: "95%", position: "relative" } },
    h(
      View,
      { style: { flexDirection: "row" } },
      h(View, { style: { width: 16, backgroundColor: green } }),
      h(
        View,
        { style: { backgroundColor: green, flexGrow: 1, paddingVertical: 13, paddingHorizontal: 44, justifyContent: "center" } },
        h(Text, { style: { ...s.bold, color: WHITE, fontSize: 21, letterSpacing: 1 } }, title),
      ),
    ),
    h(Doodle, { color: brandOf(settings), style: { position: "absolute", top: -9, right: 26 } }),
  );
}

// "Powered by Via Kashmir" mark - DMC partner itineraries only (owner's rule,
// 2026-10-03). A small white pill fixed in the bottom-right corner of EVERY
// page (cover and inner pages, including wrapped continuation pages), under
// the contact footer. Shown only when the trip's owning agency isDmcBridge,
// decided server-side in renderItineraryPdf - never by the request.
function poweredMark() {
  const hgt = 10;
  return h(
    View,
    { fixed: true, style: { position: "absolute", bottom: 6, right: 18, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F1F5F2", borderRadius: 10, paddingVertical: 3.5, paddingHorizontal: 9 } },
    h(Text, { style: { fontSize: 7, color: "#414942", letterSpacing: 0.3 } }, "Powered by"),
    h(Image, { src: VIA_KASHMIR_LOGO, style: { height: hgt, width: hgt * VIA_KASHMIR_LOGO_RATIO, flexShrink: 0 } }),
  );
}

/** react-pdf Page that adds the Via Kashmir mark when the itinerary belongs to a DMC partner. */
function BPage({ powered, children, ...props }) {
  return h(Page, props, children, powered ? poweredMark() : null);
}

// ── Itinerary document ─────────────────────────────────────────────────────
function ItineraryDoc({ trip, settings }) {
  const brand = brandOf(settings);
  const green = greenOf(settings);
  const cur = trip.currency;
  const nights = parseInt(trip.duration) || 0;
  const days = arr(trip.itineraries);
  const hotels = arr(trip.accommodations);
  const packageData = tripPackages(trip, hotels);
  const transports = arr(trip.transportations).sort(
    (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
  );
  const activities = arr(trip.tripActivities);
  const client = txt(trip.clientName) || "Guest";
  const kids = (trip.kidsCnb || 0) + (trip.kids5to12 || 0);
  const pax = `${trip.adults || 0} Adults${kids ? `, ${kids} Kids` : ""}`;
  const agency = agencyOf(settings);
  const greeting = (
    settings?.greetingMessage ||
    "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes."
  ).replace(/\{agencyName\}/g, agency.toUpperCase());
  const services =
    trip.tagline ||
    settings?.tagline ||
    "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES";

  // muted white for labels / secondary text on the dark cover
  const label = "rgba(255,255,255,0.6)";
  const softWhite = "rgba(255,255,255,0.82)";

  const infoCell = (lbl, val, extra) =>
    h(
      View,
      { style: { width: "33.33%", paddingRight: 14, marginBottom: 4, ...extra } },
      h(Text, { style: { color: label, fontSize: 11, marginBottom: 4 } }, lbl),
      h(Text, { style: { color: WHITE, fontSize: 15, fontWeight: 600 } }, txt(val)),
    );

  return h(
    Document,
    {},

    // ── Cover (dark green) ─────────────────────────────────────────────
    h(
      BPage,
      { powered: !!settings?._viaKashmirPowered, size: "A4", style: { fontFamily: "Poppins", backgroundColor: green, color: WHITE } },
      // hero image with dark overlay + centered title
      h(
        View,
        { style: { height: 300, position: "relative" } },
        isImg(trip.imagePath)
          ? h(Image, { src: pdfImg(trip.imagePath), style: { position: "absolute", width: "100%", height: "100%", objectFit: "cover" } })
          : null,
        h(View, { style: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.4)" } }),
        // orange logo label (top-left, rounded bottom-right)
        h(
          View,
          { style: { position: "absolute", top: 0, left: 0, backgroundColor: brand, paddingVertical: 16, paddingLeft: 40, paddingRight: 52, borderBottomRightRadius: 34 } },
          isImg(settings?.logoPath)
            ? h(Image, { src: pdfImg(settings.logoPath), style: { height: 32, objectFit: "contain" } })
            : h(
                View,
                {},
                h(Text, { style: { ...s.bold, color: WHITE, fontSize: 22, letterSpacing: 3 } }, agency.toUpperCase()),
                h(Text, { style: { color: WHITE, fontSize: 8, fontWeight: 600, letterSpacing: 2.5, marginTop: 2 } }, "TRAVEL SIMPLIFIED"),
              ),
        ),
        // centered hero title
        h(
          View,
          { style: { position: "absolute", bottom: 34, left: 0, right: 0, alignItems: "center" } },
          h(Text, { style: { ...s.bold, color: WHITE, fontSize: 48, letterSpacing: 1 } }, `${nights} NIGHT ${nights + 1} DAYS`),
          h(Text, { style: { color: WHITE, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginTop: 6 } }, `TRAVEL ITINERARY BY ${agency.toUpperCase()}`),
        ),
      ),
      // orange tagline band (centered)
      h(
        View,
        { style: { backgroundColor: brand, paddingVertical: 9, alignItems: "center" } },
        h(Text, { style: { ...s.bold, color: WHITE, fontSize: 9, letterSpacing: 0.4 } }, services.toUpperCase()),
      ),
      // cover content (dark green)
      h(
        View,
        { style: { paddingHorizontal: 40, paddingTop: 28, flexGrow: 1 } },
        h(
          Text,
          { style: { fontSize: 20, marginBottom: 4 } },
          h(Text, { style: { color: WHITE } }, "Dear "),
          h(Text, { style: { ...s.bold, color: WHITE } }, client),
          h(Text, { style: { color: WHITE } }, ","),
        ),
        h(Text, { style: { color: softWhite, fontSize: 11, lineHeight: 1.6, marginTop: 8, marginBottom: 22 } }, greeting),
        // info grid
        h(
          View,
          { style: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", paddingTop: 22 } },
          infoCell("Destination", txt(trip.destination) || "—"),
          infoCell("Start Date", fmtDate(trip.startDate) || "TBD"),
          infoCell("Duration", `${nights}N/${nights + 1}D`),
          infoCell("Pax", pax, { marginTop: 14 }),
          infoCell("Trip ID", trip.tripId ? `#${trip.tripId}` : "—", { marginTop: 14 }),
        ),
        // translucent price card (right-aligned)
        h(
          View,
          { style: { marginLeft: "auto", marginTop: 22, width: 230, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 16 } },
          h(Text, { style: { color: softWhite, fontSize: 11, marginBottom: 6 } }, "Quote Price"),
          h(Text, { style: { color: WHITE, fontSize: 16 } }, `Total (${curCode(cur)})`),
          h(Text, { style: { ...s.bold, color: WHITE, fontSize: 32, marginTop: 2 } }, `${num(trip.cost)}/-`),
          h(Text, { style: { color: softWhite, fontSize: 10, textAlign: "right", marginTop: 6 } }, trip.includeGst ? "including GST/-" : "excluding GST/-"),
        ),
      ),
      // cover footer (dark green)
      h(
        View,
        { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40, paddingVertical: 18 } },
        h(Text, { style: { color: WHITE, fontSize: 10, fontWeight: 600 } }, txt(settings?.contactEmail)),
        h(
          View,
          { style: { flexDirection: "row", alignItems: "center", gap: 5 } },
          h(WhatsAppMark, { color: WHITE, size: 13 }),
          h(Text, { style: { color: WHITE, fontSize: 10, fontWeight: 600 } }, txt(settings?.whatsapp || settings?.contactPhone)),
        ),
        h(Text, { style: { color: WHITE, fontSize: 10, fontWeight: 600 } }, txt(settings?.website)),
      ),
    ),

    // ── Accommodations ─────────────────────────────────────────────────
    hotels.length
      ? h(
          BPage,
          { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
          pageHeader(trip, settings),
          sectionBar("ACCOMMODATIONS", settings),
          h(
            View,
            { style: { paddingTop: 8 } },
            ...hotels.map((a, i) =>
              h(
                View,
                {
                  key: i,
                  wrap: false,
                  style: { flexDirection: "row", backgroundColor: LIGHTBG, marginHorizontal: 40, marginTop: 16, padding: 20, borderRadius: 15, alignItems: "center", gap: 18 },
                },
                h(
                  View,
                  { style: { flexGrow: 1, flexBasis: 0 } },
                  h(
                    View,
                    { style: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 } },
                    h(Text, { style: { ...s.bold, color: WHITE, backgroundColor: green, fontSize: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 5 } }, ordinal(i)),
                    h(Text, { style: { color: "#888", fontSize: 9, letterSpacing: 1 } }, "NIGHTS AT"),
                    h(Text, { style: { ...s.bold, color: green, fontSize: 12 } }, txt(a.city) || "—"),
                  ),
                  h(Text, { style: { ...s.bold, color: green, fontSize: 21 } }, txt(a.name)),
                  h(Stars, { count: parseInt(a.category) || 3, color: brand }),
                  h(
                    View,
                    { style: { flexDirection: "row", gap: 44, marginTop: 4 } },
                    h(View, {}, h(Text, { style: { color: "#888", fontSize: 8, letterSpacing: 1 } }, "ROOMS"), h(Text, { style: { ...s.bold, color: green, fontSize: 12 } }, txt(a.rooms) || "1")),
                    h(View, {}, h(Text, { style: { color: "#888", fontSize: 8, letterSpacing: 1 } }, "MEAL PLAN"), h(Text, { style: { ...s.bold, color: green, fontSize: 12 } }, mealLabel(a.mealPlan) || "—")),
                  ),
                  // Optional hotels the client can pick instead ("Hotel A or Hotel B").
                  ...(() => {
                    const options = arr(a.alternateOptions).filter((o) => txt(o?.name));
                    if (!options.length) return [];
                    if (packageData) {
                      return [
                        h(
                          View,
                          { key: "packages", style: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#dddddd", borderTopStyle: "dashed" } },
                          h(Text, { style: { ...s.bold, color: green, fontSize: 8, letterSpacing: 1, marginBottom: 3 } }, "HOTEL CHOICES BY PACKAGE"),
                          ...stayPackageGroups(trip, a).map((g) =>
                            h(
                              Text,
                              { key: g.index, style: { fontSize: 10, color: "#444", marginTop: 2 } },
                              h(Text, { style: { ...s.bold, color: brand } }, `${g.name.toUpperCase()}  `),
                              ...g.hotels.map((o, j) =>
                                h(
                                  Text,
                                  { key: j },
                                  j > 0 ? "  or  " : "",
                                  h(Text, { style: { ...s.bold, color: green } }, txt(o.name)),
                                  diffText(o.diff, cur) ? ` (${diffText(o.diff, cur)})` : "",
                                ),
                              ),
                            ),
                          ),
                        ),
                      ];
                    }
                    return [
                      h(
                        View,
                        { key: "options", style: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#dddddd", borderTopStyle: "dashed" } },
                        h(Text, { style: { ...s.bold, color: green, fontSize: 8, letterSpacing: 1, marginBottom: 3 } }, "OR CHOOSE AN OPTIONAL HOTEL"),
                        ...options.map((o, j) =>
                          h(
                            View,
                            { key: j, style: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 } },
                            isImg(o.photo)
                              ? h(Image, { src: pdfImg(o.photo), style: { width: 40, height: 28, borderRadius: 4, objectFit: "cover" } })
                              : null,
                            h(
                              Text,
                              { style: { fontSize: 10, color: "#444" } },
                              h(Text, { style: { ...s.bold, color: brand } }, "OR  "),
                              h(Text, { style: { ...s.bold, color: green } }, txt(o.name)),
                              [txt(o.category), txt(o.room_type)].filter(Boolean).map((x) => `  ·  ${x}`).join(""),
                              supplementText(o.supplement, trip.currency)
                                ? h(Text, { style: { ...s.bold, color: green } }, `  ·  ${supplementText(o.supplement, trip.currency)}`)
                                : null,
                            ),
                          ),
                        ),
                      ),
                    ];
                  })(),
                ),
                isImg(a.imagePath || a.hotel?.imagePath)
                  ? h(Image, { src: pdfImg(a.imagePath || a.hotel?.imagePath), style: { width: 175, height: 115, borderRadius: 15, objectFit: "cover" } })
                  : null,
              ),
            ),
          ),
          innerFooter(settings),
        )
      : null,

    // ── Hotel packages ─────────────────────────────────────────────────
    packageData
      ? h(
          BPage,
          { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
          pageHeader(trip, settings),
          sectionBar("CHOOSE YOUR HOTEL PACKAGE", settings),
          h(
            View,
            { style: { width: "90%", marginHorizontal: "auto", marginTop: 26 } },
            h(
              View,
              { style: { flexDirection: "row", backgroundColor: "#f8f8f8", borderWidth: 1, borderColor: "#ddd" } },
              ...["Package", ...packageData.stays.map((st) => `${st.city || "Stay"} (${st.nights}N)`), "Total"].map((hd, i) =>
                h(Text, { key: i, style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 10, color: green, fontSize: 10 } }, hd),
              ),
            ),
            ...packageData.packages.map((p) =>
              h(
                View,
                { key: p.index, wrap: false, style: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: "#ddd" } },
                h(Text, { style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 10, fontSize: 10, color: green } }, p.name),
                ...p.cells.map((list, i) =>
                  h(
                    View,
                    { key: i, style: { flexGrow: 1, flexBasis: 0, padding: 10 } },
                    ...list.map((o, j) =>
                      h(
                        Text,
                        { key: j, style: { fontSize: 9, color: TEXTGRAY, marginTop: j ? 2 : 0 } },
                        j > 0 ? "or " : "",
                        h(Text, { style: { ...s.bold, color: green } }, txt(o.name)),
                        diffText(o.diff, cur) ? ` (${diffText(o.diff, cur)})` : "",
                      ),
                    ),
                  ),
                ),
                h(Text, { style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 10, fontSize: 11, color: green } }, p.total == null ? "On request" : money(p.total, cur)),
              ),
            ),
            h(
              Text,
              { style: { fontSize: 9, color: TEXTGRAY, marginTop: 12, lineHeight: 1.5 } },
              `Total price for the whole trip ${trip.includeGst === false ? "excluding" : "including"} GST. Where a package lists more than one hotel, choose any one — the first hotel is included in the package price; others cost the amount shown.`,
            ),
          ),
          innerFooter(settings),
        )
      : null,

    // ── Transportations ────────────────────────────────────────────────
    transports.length
      ? h(
          BPage,
          { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
          pageHeader(trip, settings),
          sectionBar("TRANSPORTATIONS", settings),
          h(
            View,
            { style: { width: "90%", marginHorizontal: "auto", marginTop: 26 } },
            h(
              View,
              { style: { flexDirection: "row", backgroundColor: "#f8f8f8", borderWidth: 1, borderColor: "#ddd" } },
              ...["Day", "Service", "Vehicle / Activity"].map((hd, i) =>
                h(Text, { key: i, style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 14, color: green, fontSize: 11 } }, hd),
              ),
            ),
            ...transports.map((t, i) =>
              h(
                View,
                { key: i, wrap: false, style: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: "#ddd" } },
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 14, fontSize: 10, color: TEXTGRAY } }, fmtDayLabel(t.date, i)),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 14, fontSize: 10, color: TEXTGRAY } }, txt(t.route || t.destination) || "—"),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 14, fontSize: 10, color: TEXTGRAY } }, `${t.quantity || 1} ${txt(t.vehicleType || t.vehicle?.name) || "Vehicle"}`),
              ),
            ),
          ),
          innerFooter(settings),
        )
      : null,

    // ── Activities ──────────────────────────────────────────────────────
    // Same shape as the transportation table: what/where/how many, no prices
    // (the trip total already includes them, margin and all).
    activities.length
      ? h(
          BPage,
          { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
          pageHeader(trip, settings),
          sectionBar("ACTIVITIES", settings),
          h(
            View,
            { style: { width: "90%", marginHorizontal: "auto", marginTop: 26 } },
            h(
              View,
              { style: { flexDirection: "row", backgroundColor: "#f8f8f8", borderWidth: 1, borderColor: "#ddd" } },
              ...["Day", "Activity", "Location", "Tickets"].map((hd, i) =>
                h(Text, { key: i, style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 14, color: green, fontSize: 11 } }, hd),
              ),
            ),
            ...activities.map((a, i) => {
              const persons = (a.ticketCount || 1) + (a.childCount || 0);
              const cell = { flexGrow: 1, flexBasis: 0, padding: 14, fontSize: 10, color: TEXTGRAY };
              return h(
                View,
                { key: i, wrap: false, style: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: "#ddd" } },
                h(Text, { style: cell }, a.dayNumber ? `Day ${a.dayNumber}` : "—"),
                h(Text, { style: cell }, txt(a.name) || "—"),
                h(Text, { style: cell }, txt(a.location) || "—"),
                h(Text, { style: cell }, `${persons} ${persons > 1 ? "persons" : "person"}`),
              );
            }),
          ),
          innerFooter(settings),
        )
      : null,

    // ── Day wise itinerary ─────────────────────────────────────────────
    days.length
      ? h(
          BPage,
          { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
          pageHeader(trip, settings),
          sectionBar("DAY WISE ITINERARY", settings),
          ...days.map((d, i) => {
            const acts = txt(d.description)
              .split(/\r?\n/)
              .map((x) => x.trim())
              .filter(Boolean);
            return h(
              View,
              { key: i, wrap: false, style: { marginTop: i === 0 ? 6 : 10 } },
              // day header
              h(
                View,
                { style: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 40, paddingVertical: 16 } },
                h(
                  View,
                  { style: { width: 64, height: 64, borderRadius: 16, backgroundColor: green, alignItems: "center", justifyContent: "center" } },
                  h(Text, { style: { color: brand, fontSize: 8, letterSpacing: 1 } }, "DAY"),
                  h(Text, { style: { ...s.bold, color: brand, fontSize: 30, lineHeight: 1 } }, `${d.dayNumber ?? i + 1}`),
                ),
                h(
                  View,
                  { style: { flexGrow: 1, flexBasis: 0 } },
                  h(Text, { style: { color: "#666", fontSize: 10, fontWeight: 600 } }, fmtDayLabel(trip.startDate ? new Date(new Date(trip.startDate).getTime() + i * 864e5) : null, i).toUpperCase()),
                  h(Text, { style: { ...s.bold, color: green, fontSize: 17 } }, txt(d.title).toUpperCase()),
                ),
              ),
              isImg(d.imagePath)
                ? h(Image, { src: pdfImg(d.imagePath), style: { width: "100%", height: 170, objectFit: "cover" } })
                : null,
              acts.length
                ? h(
                    View,
                    { style: { paddingHorizontal: 54, paddingVertical: 18 } },
                    h(Text, { style: { ...s.bold, color: green, fontSize: 20, marginBottom: 12 } }, "ACTIVITES"),
                    ...acts.map((a, k) =>
                      h(
                        View,
                        { key: k, style: { flexDirection: "row", marginBottom: 8 } },
                        h(Text, { style: { color: green, marginRight: 10, fontSize: 14, lineHeight: 1 } }, "•"),
                        h(Text, { style: { color: TEXTGRAY, fontSize: 10.5, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, a),
                      ),
                    ),
                  )
                : null,
            );
          }),
          innerFooter(settings),
        )
      : null,

    // ── Inclusions / Exclusions ────────────────────────────────────────
    (() => {
      const inc = arr(trip.inclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      const exc = arr(trip.exclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      if (!inc.length && !exc.length) return null;
      const list = (title, items, mark, markColor) =>
        h(
          View,
          { style: { width: "50%", paddingRight: 14 } },
          h(Text, { style: { ...s.bold, color: green, fontSize: 19, marginBottom: 12 } }, title),
          ...(items.length ? items : ["—"]).map((it, k) =>
            h(
              View,
              { key: k, style: { flexDirection: "row", marginBottom: 8 } },
              h(Text, { style: { color: markColor, marginRight: 8, fontSize: 11, ...s.bold } }, mark),
              h(Text, { style: { color: TEXTGRAY, fontSize: 10.5, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, txt(it)),
            ),
          ),
        );
      return h(
        BPage,
        { powered: !!settings?._viaKashmirPowered, size: "A4", style: { ...s.page, backgroundColor: WHITE, paddingBottom: 80 } },
        pageHeader(trip, settings),
        sectionBar("INCLUSIONS & EXCLUSIONS", settings),
        h(View, { style: { flexDirection: "row", paddingHorizontal: 40, paddingTop: 20 } }, list("Inclusions", inc, "•", brand), list("Exclusions", exc, "•", green)),
        innerFooter(settings),
      );
    })(),
  );
}

// ── Confirmation / Receipt / Invoice (branded header, simple body) ──────────
const simpleStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: TEXTGRAY, fontFamily: "Poppins", paddingBottom: 60 },
  banner: { color: "#fff", padding: 12, borderRadius: 4, marginBottom: 14, textAlign: "center", fontSize: 14, fontWeight: 700 },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "35%", color: "#888" },
  value: { width: "65%", fontWeight: 700 },
  section: { marginTop: 14 },
  th: { flexDirection: "row", backgroundColor: LIGHTBG, padding: 6, fontWeight: 700 },
  td: { flexDirection: "row", padding: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  cell: { flexGrow: 1, flexBasis: 0 },
});
const brandHead = (settings) =>
  h(
    View,
    { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 3, borderBottomColor: brandOf(settings), paddingBottom: 10 } },
    h(View, {}, h(Text, { style: { fontSize: 16, fontWeight: 700, color: greenOf(settings), letterSpacing: 2 } }, agencyOf(settings).toUpperCase()), h(Text, { style: { fontSize: 8, color: "#888", letterSpacing: 2 } }, "TRAVEL SIMPLIFIED")),
    isImg(settings?.logoPath) ? h(Image, { src: pdfImg(settings.logoPath), style: { height: 34, objectFit: "contain" } }) : null,
  );
const infoRow = (l, v) => h(View, { style: simpleStyles.row, key: l }, h(Text, { style: simpleStyles.label }, l), h(Text, { style: simpleStyles.value }, txt(v) || "—"));
const table = (headings, rows) =>
  h(View, {}, h(View, { style: simpleStyles.th }, ...headings.map((hd, i) => h(Text, { style: simpleStyles.cell, key: i }, hd))), ...rows.map((cols, ri) => h(View, { style: simpleStyles.td, key: ri }, ...cols.map((c, ci) => h(Text, { style: simpleStyles.cell, key: ci }, txt(c) || "—")))));
const simpleFooter = (settings) =>
  h(
    View,
    { style: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 2, borderTopColor: brandOf(settings), paddingTop: 8 }, fixed: true },
    [settings?.whatsapp || settings?.contactPhone, settings?.contactEmail, settings?.website].filter(Boolean).map((it, i) =>
      h(Text, { key: i, style: { fontSize: 8.5, fontWeight: 700, color: greenOf(settings) } }, txt(it)),
    ),
  );

function ConfirmationDoc({ trip, settings, message }) {
  const cur = trip.currency;
  return h(Document, {}, h(Page, { size: "A4", style: simpleStyles.page },
    brandHead(settings),
    h(Text, { style: { ...simpleStyles.banner, backgroundColor: greenOf(settings) } }, "BOOKING CONFIRMED"),
    isImg(trip.imagePath) ? h(Image, { src: pdfImg(trip.imagePath), style: { width: "100%", height: 150, objectFit: "cover", borderRadius: 6, marginBottom: 14 } }) : null,
    h(Text, { style: { lineHeight: 1.5, marginBottom: 10 } }, txt(message)),
    h(View, { style: simpleStyles.section },
      infoRow("Trip ID", trip.tripId), infoRow("Start Date", fmtDate(trip.startDate)),
      infoRow("Duration", trip.duration ? `${trip.duration}N` : "—"),
      infoRow("Quote Price", money(trip.cost, cur)), infoRow("Paid Amount", money(trip.paidAmount, cur))),
    simpleFooter(settings)));
}
function ReceiptDoc({ trip, settings, payments }) {
  const cur = trip.currency;
  return h(Document, {}, h(Page, { size: "A4", style: simpleStyles.page },
    brandHead(settings),
    h(Text, { style: { ...simpleStyles.banner, backgroundColor: brandOf(settings) } }, "PAYMENT RECEIVED"),
    h(View, { style: simpleStyles.section },
      infoRow("Receipt No.", `${trip.tripId}-R`), infoRow("Date", fmtDate(new Date())),
      infoRow("Guest Name", trip.clientName), infoRow("For", trip.tripTitle),
      infoRow("Amount Paid", money(trip.paidAmount, cur)), infoRow("Paid / Total", `${money(trip.paidAmount, cur)} / ${money(trip.cost, cur)}`)),
    payments && payments.length ? h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: greenOf(settings) } }, "Payments"),
      table(["Date", "Description", "Method", "Amount"], payments.map((p) => [fmtDate(p.settlementDate), p.settlementType || "Receipt", p.method || "—", money(p.amount, cur)]))) : null,
    simpleFooter(settings)));
}
function InvoiceDoc({ trip, settings }) {
  const cur = trip.currency;
  return h(Document, {}, h(Page, { size: "A4", style: simpleStyles.page },
    brandHead(settings),
    h(Text, { style: { ...simpleStyles.banner, backgroundColor: greenOf(settings) } }, trip.status === "confirmed" ? "TRIP CONFIRMED" : "INVOICE"),
    h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: greenOf(settings) } }, "Client Details"),
      infoRow("Name", trip.clientName), infoRow("Email", trip.clientEmail), infoRow("Phone", trip.clientPhone)),
    h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: greenOf(settings) } }, "Package Details"),
      infoRow("Trip ID", trip.tripId), infoRow("Travel Date", fmtDate(trip.startDate)),
      infoRow("Duration", trip.duration ? `${trip.duration}N` : "—"), infoRow("Total", money(trip.cost, cur))),
    simpleFooter(settings)));
}


// Service vouchers (Phase 3): one page per hotel stay (with the hotel's
// confirmation number once it's confirmed), a transport sheet with each day's
// driver, and an activity sheet when the trip has activities. Client-facing —
// no prices.
const VOUCHER_MEAL = {
  "Only Room": "Room only (EP)",
  "Only Room + Breakfast": "Breakfast (CP)",
  "Breakfast + Dinner": "Breakfast & dinner (MAP)",
  "Breakfast + Lunch + Dinner": "All meals (AP)",
};
const stayNights = (a) =>
  a.checkIn && a.checkOut ? Math.max(0, Math.round((new Date(a.checkOut) - new Date(a.checkIn)) / 86400000)) : 0;
function VouchersDoc({ trip, settings }) {
  const stays = (trip.accommodations || [])
    .filter((a) => !a.cancelledAt)
    .sort((a, b) => new Date(a.checkIn || 0) - new Date(b.checkIn || 0));
  const cabs = (trip.transportations || [])
    .filter((t) => !t.cancelledAt)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const guests = [`${trip.adults || 0} adult${trip.adults === 1 ? "" : "s"}`]
    .concat(trip.kids5to12 ? [`${trip.kids5to12} child (5-12)`] : [])
    .concat(trip.kidsCnb ? [`${trip.kidsCnb} child (under 5)`] : [])
    .join(", ");
  const statusText = (row) =>
    row.supplierStatus === "confirmed" ? `Confirmed${row.supplierRef ? ` · ${row.supplierRef}` : ""}` : "To be confirmed";
  const hotelPage = (a, i) =>
    h(Page, { size: "A4", style: simpleStyles.page, key: `h${i}` },
      brandHead(settings),
      h(Text, { style: { ...simpleStyles.banner, backgroundColor: greenOf(settings) } }, "HOTEL VOUCHER"),
      h(View, { style: simpleStyles.section },
        infoRow("Voucher No.", `${trip.tripId}-H${i + 1}`),
        infoRow("Guest Name", trip.clientName),
        infoRow("Guests", guests),
        infoRow("Booking Status", statusText(a))),
      h(View, { style: simpleStyles.section },
        h(Text, { style: { ...simpleStyles.title, color: greenOf(settings) } }, txt(a.name || a.hotel?.name || "Hotel")),
        infoRow("City", a.city || a.hotel?.city),
        infoRow("Address", a.hotel?.address),
        infoRow("Hotel Phone", a.hotel?.phone),
        infoRow("Check-in", fmtDate(a.checkIn)),
        infoRow("Check-out", fmtDate(a.checkOut)),
        infoRow("Nights", String(stayNights(a))),
        infoRow("Rooms", [a.rooms, a.roomType].filter(Boolean).join(" × ")),
        infoRow("Meal Plan", VOUCHER_MEAL[a.mealPlan] || a.mealPlan),
        (a.extraBeds5To12Count || 0) + (a.extraBedsAbove12Count || 0) + (a.extraAdultCount || 0)
          ? infoRow("Extra Beds", String((a.extraBeds5To12Count || 0) + (a.extraBedsAbove12Count || 0) + (a.extraAdultCount || 0)))
          : null),
      h(Text, { style: { marginTop: 18, color: "#666", lineHeight: 1.5 } },
        "Please present this voucher at check-in along with a valid photo ID for every guest. Standard check-in and check-out times of the hotel apply."),
      simpleFooter(settings));
  const transportPage = cabs.length
    ? h(Page, { size: "A4", style: simpleStyles.page, key: "cabs" },
        brandHead(settings),
        h(Text, { style: { ...simpleStyles.banner, backgroundColor: brandOf(settings) } }, "TRANSPORT VOUCHER"),
        h(View, { style: simpleStyles.section },
          infoRow("Voucher No.", `${trip.tripId}-T`),
          infoRow("Guest Name", trip.clientName),
          infoRow("Guests", guests)),
        h(View, { style: simpleStyles.section },
          table(
            ["Date", "Route", "Vehicle", "Driver", "Vehicle No."],
            cabs.map((t) => [
              fmtDate(t.date),
              t.route || t.destination,
              t.vehicleType || t.vehicle?.name,
              [t.driverName, t.driverPhone].filter(Boolean).join(" · ") || "To be assigned",
              t.vehicleNumber,
            ]),
          )),
        h(Text, { style: { marginTop: 18, color: "#666", lineHeight: 1.5 } },
          "Driver details are shared a day before each journey if not shown here. Timings as per the itinerary; please be ready at the pickup point."),
        simpleFooter(settings))
    : null;
  const acts = (trip.tripActivities || []).slice().sort((a, b) => (a.dayNumber || 99) - (b.dayNumber || 99));
  const activityPage = acts.length
    ? h(Page, { size: "A4", style: simpleStyles.page, key: "acts" },
        brandHead(settings),
        h(Text, { style: { ...simpleStyles.banner, backgroundColor: greenOf(settings) } }, "ACTIVITY VOUCHER"),
        h(View, { style: simpleStyles.section },
          infoRow("Voucher No.", `${trip.tripId}-A`),
          infoRow("Guest Name", trip.clientName),
          infoRow("Guests", guests)),
        h(View, { style: simpleStyles.section },
          table(
            ["Day", "Date", "Activity", "Location", "Persons"],
            acts.map((a) => {
              const date = a.dayNumber && trip.startDate ? new Date(new Date(trip.startDate).getTime() + (a.dayNumber - 1) * 86400000) : null;
              return [a.dayNumber ? `Day ${a.dayNumber}` : "—", date ? fmtDate(date) : "—", a.name, a.location, String((a.ticketCount || 1) + (a.childCount || 0))];
            }),
          )),
        h(Text, { style: { marginTop: 18, color: "#666", lineHeight: 1.5 } },
          "Show this voucher at the activity counter. Timings and availability depend on weather and local operators."),
        simpleFooter(settings))
    : null;
  const pages = [...stays.map(hotelPage), transportPage, activityPage].filter(Boolean);
  if (!pages.length) {
    pages.push(h(Page, { size: "A4", style: simpleStyles.page, key: "empty" }, brandHead(settings),
      h(Text, {}, "This trip has no hotel or transport bookings yet."), simpleFooter(settings)));
  }
  return h(Document, {}, ...pages);
}

export const renderItineraryPdf = async (trip, settings) => {
  // DMC partner itineraries carry the Via Kashmir mark; decided from the owning
  // agency's own flag so no caller (download, email, client proposal) can skip it.
  const owner = trip?.userId ? await prisma.user.findUnique({ where: { id: trip.userId }, select: { isDmcBridge: true } }) : null;
  return renderToBuffer(h(ItineraryDoc, { trip, settings: { ...(settings || {}), _viaKashmirPowered: !!owner?.isDmcBridge } }));
};
export const renderConfirmationPdf = (trip, settings, message) => renderToBuffer(h(ConfirmationDoc, { trip, settings, message }));
export const renderReceiptPdf = (trip, settings, payments) => renderToBuffer(h(ReceiptDoc, { trip, settings, payments }));
export const renderInvoicePdf = (trip, settings) => renderToBuffer(h(InvoiceDoc, { trip, settings }));
export const renderVouchersPdf = (trip, settings) => renderToBuffer(h(VouchersDoc, { trip, settings }));
