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
import { POPPINS_REGULAR, POPPINS_SEMIBOLD, MASCOT_PNG } from "./pdf-assets.js";

// Server-side PDF generation (react-pdf, no Chromium). Reproduces the exact
// "Via Kashmir" itinerary template (orange + teal, Poppins, mascot, doodles):
// cover / accommodations / transportations / day-wise / inclusions. Fully
// dynamic from the trip builder data + agency settings.

const h = React.createElement;

// Bundle Poppins so it's always available on serverless (also restores ₹ etc).
Font.register({
  family: "Poppins",
  fonts: [
    { src: POPPINS_REGULAR, fontWeight: 400 },
    { src: POPPINS_SEMIBOLD, fontWeight: 600 },
    { src: POPPINS_SEMIBOLD, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((w) => [w]); // no mid-word breaks

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
const txt = (v) => (v == null || v === "" ? "" : String(v));
const curCode = (c) => (c ? String(c).split(/[\s(]/)[0] : "INR");
const num = (n) => Number(n || 0).toLocaleString("en-IN");
const money = (n, cur) => `${curCode(cur)} ${num(n)}`;

// Exact Via Kashmir brand palette (from the source deck).
const ORANGE = "#FAA81E";
const TEAL = "#043B36"; // dark teal — text, badges, quote box
const BARTEAL = "#3F5D58"; // muted teal — section bars
const CREAM = "#FBF3E4"; // soft card background
const INK = "#1C2B2B";
const MUTED = "#6B7B78";

const brandOf = (s) => s?.brandColor || ORANGE;
const tealOf = (s) => s?.secondaryColor || TEAL;
const barOf = (s) => (s?.secondaryColor ? s.secondaryColor : BARTEAL);
const agencyOf = (s) => s?.agencyName || "Via Itinerary";

const s = StyleSheet.create({
  page: { fontSize: 10, color: INK, fontFamily: "Poppins", paddingBottom: 74 },
  pad: { paddingHorizontal: 34 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 18,
  },
  bold: { fontWeight: 700 },
});

// hand-drawn orange squiggle doodle used beside section titles / prices
function Squiggle({ style, color = ORANGE }) {
  return h(
    Svg,
    { width: 34, height: 22, viewBox: "0 0 34 22", style },
    h(Path, {
      d: "M2 20 L14 2 M11 21 L24 4 M20 20 L31 6",
      stroke: color,
      strokeWidth: 2.4,
      strokeLinecap: "round",
    }),
  );
}

// star rating
function Stars({ count, color }) {
  const pts = "10,1 12.6,7 19,7.3 14,11.5 15.8,18 10,14.3 4.2,18 6,11.5 1,7.3 7.4,7";
  return h(
    View,
    { style: { flexDirection: "row", gap: 3, marginTop: 4, marginBottom: 6 } },
    ...Array.from({ length: Math.max(0, Math.min(5, count || 0)) }, (_, i) =>
      h(
        Svg,
        { key: i, width: 12, height: 12, viewBox: "0 0 20 20" },
        h(Polygon, { points: pts, fill: color }),
      ),
    ),
  );
}

// WhatsApp glyph in a teal circle (inner-page footer)
function WhatsAppMark({ color }) {
  return h(
    View,
    { style: { width: 26, height: 26, borderRadius: 13, backgroundColor: color, alignItems: "center", justifyContent: "center" } },
    h(
      Svg,
      { width: 15, height: 15, viewBox: "0 0 32 32" },
      h(Path, {
        d: "M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.8 1 3.9 1.5 6.2 1.5 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.5 18.3c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.1-.5-.2-1.2-.4-2.1-.8-3.7-1.6-6.1-5.3-6.3-5.6-.2-.2-1.5-2-1.5-3.8s.9-2.7 1.3-3.1c.3-.3.7-.4 1-.4h.7c.2 0 .5 0 .8.6.3.7 1 2.4 1.1 2.5.1.2.1.4 0 .6-.4.9-.9 1.1-.6 1.6.9 1.5 1.8 2 3.1 2.7.2.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.9.9 2.2 1.1.3.1.5.2.6.3.1.3.1.9-.2 1.7z",
        fill: "#fff",
      }),
    ),
  );
}

// footer with agency contacts. Cover = plain centered; inner = WhatsApp style.
function footer(settings, { whatsapp = false } = {}) {
  const teal = tealOf(settings);
  const brand = brandOf(settings);
  const phone = settings?.whatsapp || settings?.contactPhone;
  const email = settings?.contactEmail;
  const web = settings?.website;
  const cell = (v, i) => h(Text, { key: i, style: { ...s.bold, color: teal, fontSize: 9.5 } }, txt(v));

  if (!whatsapp) {
    return h(
      View,
      { style: { ...s.footer, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 26 }, fixed: true },
      [phone, email, web].filter(Boolean).map(cell),
    );
  }
  return h(
    View,
    { style: { ...s.footer }, fixed: true },
    h(View, { style: { height: 3, width: 150, backgroundColor: brand, borderRadius: 2, marginLeft: 4, marginBottom: 8 } }),
    h(
      View,
      { style: { flexDirection: "row", alignItems: "center", gap: 22 } },
      h(
        View,
        { style: { flexDirection: "row", alignItems: "center", gap: 6 } },
        h(WhatsAppMark, { color: teal }),
        h(Text, { style: { ...s.bold, color: teal, fontSize: 11 } }, "WhatsApp"),
      ),
      phone ? cell(phone, "p") : null,
      email ? cell(email, "e") : null,
      web ? cell(web, "w") : null,
    ),
  );
}

// inner-page top header: orange "N NIGHT M DAYS" block + agency wordmark
function pageHeader(trip, settings) {
  const brand = brandOf(settings);
  const teal = tealOf(settings);
  const nights = parseInt(trip.duration) || 0;
  return h(
    View,
    {
      style: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingRight: 34,
        paddingTop: 0,
        paddingBottom: 12,
      },
    },
    h(
      View,
      { style: { backgroundColor: brand, paddingVertical: 14, paddingHorizontal: 26, paddingLeft: 34, minWidth: 300 } },
      h(Text, { style: { ...s.bold, color: "#fff", fontSize: 24, letterSpacing: 0.5 } }, `${nights} NIGHT ${nights + 1} DAYS`),
      h(Text, { style: { color: "#fff", fontSize: 7.5, letterSpacing: 1 } }, `TRAVEL ITINERARY BY ${agencyOf(settings).toUpperCase()}`),
    ),
    isImg(settings?.logoPath)
      ? h(Image, { src: String(settings.logoPath), style: { height: 34, objectFit: "contain" } })
      : h(
          View,
          { style: { alignItems: "flex-end" } },
          h(Text, { style: { ...s.bold, color: teal, fontSize: 20, letterSpacing: 4 } }, agencyOf(settings).toUpperCase()),
          h(Text, { style: { color: teal, fontSize: 7, letterSpacing: 3 } }, "TRAVEL SIMPLIFIED"),
        ),
  );
}

// muted-teal section title bar with dark left tab + orange doodle
function sectionBar(title, settings) {
  return h(
    View,
    { style: { ...s.pad, marginBottom: 20, marginTop: 4 } },
    h(
      View,
      { style: { flexDirection: "row", position: "relative" } },
      h(View, { style: { width: 12, backgroundColor: tealOf(settings) } }),
      h(
        View,
        { style: { backgroundColor: barOf(settings), flexGrow: 1, paddingVertical: 14, paddingHorizontal: 20, justifyContent: "center" } },
        h(Text, { style: { ...s.bold, color: "#fff", fontSize: 19, letterSpacing: 1 } }, title),
      ),
      h(Squiggle, { style: { position: "absolute", top: -8, left: 20 + title.length * 11 } }),
    ),
  );
}

const labelVal = (label, value, teal) =>
  h(
    View,
    { style: { marginBottom: 10, width: "33%" } },
    h(Text, { style: { color: teal, fontSize: 10, marginBottom: 1 } }, label),
    h(Text, { style: { color: INK, fontSize: 15 } }, txt(value) || "—"),
  );

// ── Itinerary document ─────────────────────────────────────────────────────
function ItineraryDoc({ trip, settings }) {
  const brand = brandOf(settings);
  const teal = tealOf(settings);
  const cur = trip.currency;
  const nights = parseInt(trip.duration) || 0;
  const days = arr(trip.itineraries);
  const hotels = arr(trip.accommodations);
  const transports = arr(trip.transportations).sort(
    (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
  );
  const client = txt(trip.clientName) || "Guest";
  const kids = (trip.kidsCnb || 0) + (trip.kids5to12 || 0);
  const pax = `${trip.adults || 0} Adult${(trip.adults || 0) === 1 ? "" : "s"}${kids ? ` ${kids} Child` : ""}`;
  const agency = agencyOf(settings);
  const greeting =
    (settings?.greetingMessage &&
      settings.greetingMessage.replace(/\{agencyName\}/g, agency)) ||
    `Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes to any of the provided services.`;
  const services =
    settings?.tagline ||
    "BOOK VERIFIED HOTELS, CABS, HORSES, SHIKARAS, HOUSEBOATS, TOUR PACKAGES, ACTIVIES, VISITS";

  return h(
    Document,
    {},

    // ── Cover ──────────────────────────────────────────────────────────
    h(
      Page,
      { size: "A4", style: { fontFamily: "Poppins", color: INK, paddingBottom: 54 } },
      // hero
      h(
        View,
        { style: { height: 264, position: "relative" } },
        isImg(trip.imagePath)
          ? h(Image, { src: String(trip.imagePath), style: { position: "absolute", width: "100%", height: "100%", objectFit: "cover" } })
          : h(View, { style: { position: "absolute", width: "100%", height: "100%", backgroundColor: teal } }),
        // logo panel (orange, rounded bottom-right)
        h(
          View,
          { style: { position: "absolute", top: 0, left: 0, backgroundColor: brand, paddingVertical: 18, paddingHorizontal: 30, borderBottomRightRadius: 30, alignItems: "center" } },
          isImg(settings?.logoPath)
            ? h(Image, { src: String(settings.logoPath), style: { height: 30, objectFit: "contain" } })
            : h(Text, { style: { ...s.bold, color: "#fff", fontSize: 22, letterSpacing: 5 } }, agency.toUpperCase()),
          h(Text, { style: { color: "#fff", fontSize: 8, letterSpacing: 4, marginTop: 3 } }, "TRAVEL SIMPLIFIED"),
        ),
        h(
          View,
          { style: { position: "absolute", bottom: 14, left: 30, right: 30 } },
          h(Text, { style: { ...s.bold, color: "#fff", fontSize: 52, letterSpacing: 1 } }, `${nights} NIGHT ${nights + 1} DAYS`),
          h(Text, { style: { color: "#fff", fontSize: 15, letterSpacing: 2 } }, `TRAVEL ITINERARY BY ${agency.toUpperCase()}`),
        ),
      ),
      // services band
      h(
        View,
        { style: { backgroundColor: brand, paddingVertical: 8, paddingHorizontal: 30 } },
        h(Text, { style: { ...s.bold, color: teal, fontSize: 9, letterSpacing: 0.4 } }, services.toUpperCase()),
      ),
      // body
      h(
        View,
        { style: { paddingHorizontal: 30, paddingTop: 18 } },
        h(Text, { style: { ...s.bold, color: teal, fontSize: 22, marginBottom: 8 } }, `Dear ${client}`),
        h(
          Text,
          { style: { color: INK, fontSize: 12, marginBottom: 9 } },
          "Greetings from ",
          h(Text, { style: s.bold }, `${agency}.`),
        ),
        h(Text, { style: { color: INK, fontSize: 12, lineHeight: 1.55, marginBottom: 9 } }, greeting),
        h(Text, { style: { color: INK, fontSize: 12, marginBottom: 4 } }, "Contact details are provided at the end."),
        h(Squiggle, { style: { marginLeft: 4, marginBottom: 2 } }),
        // info grid
        h(
          View,
          { style: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#E4DAC4", paddingTop: 12 } },
          labelVal("Destination", trip.destination, teal),
          labelVal("Start Date", fmtDate(trip.startDate), teal),
          labelVal("Duration", `${nights}N${nights + 1}D`, teal),
          // row 2 leftmost column left empty to clear the mascot art
          h(View, { key: "sp", style: { width: "33%" } }),
          labelVal("Pax", pax, teal),
          labelVal("Trip ID", `#${trip.tripId}`, teal),
        ),
        // quote row: left gutter holds the mascot art + quote box
        h(
          View,
          { style: { flexDirection: "row", marginTop: 12, alignItems: "flex-end" } },
          h(
            View,
            { style: { width: 150, position: "relative" } },
            h(Image, { src: MASCOT_PNG, style: { position: "absolute", bottom: -6, left: -4, width: 140, height: 165, objectFit: "contain" } }),
          ),
          h(
            View,
            { style: { flexGrow: 1, flexBasis: 0, position: "relative" } },
            h(
              View,
              { style: { backgroundColor: teal, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 24 } },
              h(Text, { style: { color: CREAM, fontSize: 11, marginBottom: 2 } }, "Quote Price"),
              h(Text, { style: { color: "#fff", fontSize: 17 } }, `Total (${curCode(cur)})`),
              h(
                View,
                { style: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" } },
                h(Text, { style: { ...s.bold, color: "#fff", fontSize: 34 } }, `${num(trip.cost)}/-`),
                h(Text, { style: { color: CREAM, fontSize: 10, marginBottom: 6 } }, trip.includeGst ? "(Including GST)" : "(Excluding GST)"),
              ),
            ),
            h(Squiggle, { style: { position: "absolute", top: -16, left: 150 } }),
          ),
        ),
      ),
      // orange corner accent behind mascot feet
      h(View, { style: { position: "absolute", bottom: 34, left: 0, width: 84, height: 32, backgroundColor: brand, borderTopRightRadius: 16 } }),
      footer(settings),
    ),

    // ── Accommodations ─────────────────────────────────────────────────
    hotels.length
      ? h(
          Page,
          { size: "A4", style: s.page },
          pageHeader(trip, settings),
          sectionBar("ACCOMMODATIONS", settings),
          h(
            View,
            { style: s.pad },
            ...hotels.map((a, i) =>
              h(
                View,
                {
                  key: i,
                  wrap: false,
                  style: { flexDirection: "row", backgroundColor: CREAM, borderRadius: 14, padding: 16, marginBottom: 14, alignItems: "center" },
                },
                h(
                  View,
                  { style: { flexGrow: 1, flexBasis: 0, paddingRight: 12 } },
                  h(
                    View,
                    { style: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 } },
                    h(Text, { style: { ...s.bold, color: "#fff", backgroundColor: teal, fontSize: 10, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 4 } }, ordinal(i)),
                    h(Text, { style: { color: MUTED, fontSize: 9, letterSpacing: 1 } }, "NIGHTS AT"),
                    h(Text, { style: { ...s.bold, color: teal, fontSize: 12 } }, txt(a.city) || "—"),
                  ),
                  h(Text, { style: { ...s.bold, color: teal, fontSize: 20 } }, txt(a.name)),
                  h(Stars, { count: parseInt(a.category) || 3, color: brand }),
                  h(
                    View,
                    { style: { flexDirection: "row", gap: 40, marginTop: 2 } },
                    h(View, {}, h(Text, { style: { color: MUTED, fontSize: 7.5, letterSpacing: 1 } }, "ROOMS"), h(Text, { style: { ...s.bold, fontSize: 11 } }, txt(a.rooms) || "1")),
                    h(View, {}, h(Text, { style: { color: MUTED, fontSize: 7.5, letterSpacing: 1 } }, "MEAL PLAN"), h(Text, { style: { ...s.bold, fontSize: 11 } }, txt(a.mealPlan) || "—")),
                  ),
                ),
                isImg(a.imagePath || a.hotel?.imagePath)
                  ? h(Image, { src: String(a.imagePath || a.hotel?.imagePath), style: { width: 160, height: 105, borderRadius: 10, borderWidth: 2.5, borderColor: brand, objectFit: "cover" } })
                  : null,
              ),
            ),
          ),
          footer(settings, { whatsapp: true }),
        )
      : null,

    // ── Transportations ────────────────────────────────────────────────
    transports.length
      ? h(
          Page,
          { size: "A4", style: s.page },
          pageHeader(trip, settings),
          sectionBar("TRANSPORTATIONS", settings),
          h(
            View,
            { style: s.pad },
            // head
            h(
              View,
              { style: { flexDirection: "row", backgroundColor: CREAM, borderWidth: 1, borderColor: "#E4DAC4" } },
              ...["Day", "Service", "Vehicle / Activity"].map((hd, i) =>
                h(Text, { key: i, style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 11, color: teal, fontSize: 10.5 } }, hd),
              ),
            ),
            ...transports.map((t, i) =>
              h(
                View,
                { key: i, wrap: false, style: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: "#E4DAC4" } },
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 11, fontSize: 9.5 } }, fmtDayLabel(t.date, i)),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 11, fontSize: 9.5 } }, txt(t.route || t.destination) || "—"),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 11, fontSize: 9.5 } }, `${t.quantity || 1} ${txt(t.vehicleType || t.vehicle?.name) || "Vehicle"}`),
              ),
            ),
          ),
          footer(settings, { whatsapp: true }),
        )
      : null,

    // ── Day wise itinerary ─────────────────────────────────────────────
    days.length
      ? h(
          Page,
          { size: "A4", style: s.page },
          pageHeader(trip, settings),
          sectionBar("DAY WISE ITINERARY", settings),
          h(
            View,
            { style: s.pad },
            ...days.map((d, i) => {
              const acts = txt(d.description)
                .split(/\r?\n/)
                .map((x) => x.trim())
                .filter(Boolean);
              return h(
                View,
                { key: i, wrap: false, style: { marginBottom: 24 } },
                h(
                  View,
                  { style: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 } },
                  h(
                    View,
                    { style: { width: 56, height: 56, borderRadius: 28, backgroundColor: teal, alignItems: "center", justifyContent: "center" } },
                    h(Text, { style: { ...s.bold, color: "#fff", fontSize: 22, lineHeight: 1 } }, `${d.dayNumber ?? i + 1}`),
                    h(Text, { style: { color: brand, fontSize: 7, letterSpacing: 1, marginTop: 1 } }, "DAY"),
                  ),
                  h(
                    View,
                    { style: { flexGrow: 1, flexBasis: 0 } },
                    h(Text, { style: { color: MUTED, fontSize: 9.5 } }, fmtDayLabel(trip.startDate ? new Date(new Date(trip.startDate).getTime() + i * 864e5) : null, i).toUpperCase()),
                    h(Text, { style: { ...s.bold, color: teal, fontSize: 15 } }, txt(d.title).toUpperCase()),
                  ),
                ),
                isImg(d.imagePath)
                  ? h(Image, { src: String(d.imagePath), style: { width: "100%", height: 160, borderRadius: 6, objectFit: "cover", marginBottom: 12 } })
                  : null,
                acts.length
                  ? h(
                      View,
                      {},
                      h(Text, { style: { ...s.bold, color: teal, fontSize: 15, marginBottom: 8 } }, "ACTIVITES"),
                      ...acts.map((a, k) =>
                        h(
                          View,
                          { key: k, style: { flexDirection: "row", marginBottom: 5 } },
                          h(Text, { style: { color: teal, marginRight: 7, fontSize: 11 } }, "•"),
                          h(Text, { style: { color: INK, fontSize: 10.5, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, a),
                        ),
                      ),
                    )
                  : null,
              );
            }),
          ),
          footer(settings, { whatsapp: true }),
        )
      : null,

    // ── Inclusions / Exclusions ────────────────────────────────────────
    (() => {
      const inc = arr(trip.inclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      const exc = arr(trip.exclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      if (!inc.length && !exc.length) return null;
      const list = (title, items, dot) =>
        h(
          View,
          { style: { width: "50%", paddingRight: 12 } },
          h(Text, { style: { ...s.bold, color: teal, fontSize: 15, marginBottom: 10 } }, title),
          ...(items.length ? items : ["—"]).map((it, k) =>
            h(
              View,
              { key: k, style: { flexDirection: "row", marginBottom: 5 } },
              h(Text, { style: { color: dot, marginRight: 7, fontSize: 11 } }, "•"),
              h(Text, { style: { fontSize: 10.5, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, txt(it)),
            ),
          ),
        );
      return h(
        Page,
        { size: "A4", style: s.page },
        pageHeader(trip, settings),
        sectionBar("INCLUSIONS & EXCLUSIONS", settings),
        h(View, { style: { ...s.pad, flexDirection: "row" } }, list("Inclusions", inc, teal), list("Exclusions", exc, brand)),
        footer(settings, { whatsapp: true }),
      );
    })(),
  );
}

// ── Confirmation / Receipt / Invoice (branded header, simple body) ──────────
const simpleStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "Poppins", paddingBottom: 60 },
  banner: { color: "#fff", padding: 12, borderRadius: 4, marginBottom: 14, textAlign: "center", fontSize: 14, fontWeight: 700 },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "35%", color: MUTED },
  value: { width: "65%", fontWeight: 700 },
  section: { marginTop: 14 },
  th: { flexDirection: "row", backgroundColor: CREAM, padding: 6, fontWeight: 700 },
  td: { flexDirection: "row", padding: 6, borderBottomWidth: 1, borderBottomColor: "#E4DAC4" },
  cell: { flexGrow: 1, flexBasis: 0 },
});
const brandHead = (settings) =>
  h(
    View,
    { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 3, borderBottomColor: brandOf(settings), paddingBottom: 10 } },
    h(View, {}, h(Text, { style: { fontSize: 16, fontWeight: 700, color: tealOf(settings), letterSpacing: 2 } }, agencyOf(settings).toUpperCase()), h(Text, { style: { fontSize: 8, color: MUTED, letterSpacing: 2 } }, "TRAVEL SIMPLIFIED")),
    isImg(settings?.logoPath) ? h(Image, { src: String(settings.logoPath), style: { height: 34, objectFit: "contain" } }) : null,
  );
const infoRow = (l, v) => h(View, { style: simpleStyles.row, key: l }, h(Text, { style: simpleStyles.label }, l), h(Text, { style: simpleStyles.value }, txt(v) || "—"));
const table = (headings, rows) =>
  h(View, {}, h(View, { style: simpleStyles.th }, ...headings.map((hd, i) => h(Text, { style: simpleStyles.cell, key: i }, hd))), ...rows.map((cols, ri) => h(View, { style: simpleStyles.td, key: ri }, ...cols.map((c, ci) => h(Text, { style: simpleStyles.cell, key: ci }, txt(c) || "—")))));

function ConfirmationDoc({ trip, settings, message }) {
  const cur = trip.currency;
  return h(Document, {}, h(Page, { size: "A4", style: simpleStyles.page },
    brandHead(settings),
    h(Text, { style: { ...simpleStyles.banner, backgroundColor: tealOf(settings) } }, "BOOKING CONFIRMED"),
    isImg(trip.imagePath) ? h(Image, { src: String(trip.imagePath), style: { width: "100%", height: 150, objectFit: "cover", borderRadius: 6, marginBottom: 14 } }) : null,
    h(Text, { style: { lineHeight: 1.5, marginBottom: 10 } }, txt(message)),
    h(View, { style: simpleStyles.section },
      infoRow("Trip ID", trip.tripId), infoRow("Start Date", fmtDate(trip.startDate)),
      infoRow("Duration", trip.duration ? `${trip.duration}N` : "—"),
      infoRow("Quote Price", money(trip.cost, cur)), infoRow("Paid Amount", money(trip.paidAmount, cur))),
    footer(settings)));
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
    payments && payments.length ? h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: tealOf(settings) } }, "Payments"),
      table(["Date", "Description", "Method", "Amount"], payments.map((p) => [fmtDate(p.settlementDate), p.settlementType || "Receipt", p.method || "—", money(p.amount, cur)]))) : null,
    footer(settings)));
}
function InvoiceDoc({ trip, settings }) {
  const cur = trip.currency;
  return h(Document, {}, h(Page, { size: "A4", style: simpleStyles.page },
    brandHead(settings),
    h(Text, { style: { ...simpleStyles.banner, backgroundColor: tealOf(settings) } }, trip.status === "confirmed" ? "TRIP CONFIRMED" : "INVOICE"),
    h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: tealOf(settings) } }, "Client Details"),
      infoRow("Name", trip.clientName), infoRow("Email", trip.clientEmail), infoRow("Phone", trip.clientPhone)),
    h(View, { style: simpleStyles.section }, h(Text, { style: { ...simpleStyles.title, color: tealOf(settings) } }, "Package Details"),
      infoRow("Trip ID", trip.tripId), infoRow("Travel Date", fmtDate(trip.startDate)),
      infoRow("Duration", trip.duration ? `${trip.duration}N` : "—"), infoRow("Total", money(trip.cost, cur))),
    footer(settings)));
}

export const renderItineraryPdf = (trip, settings) => renderToBuffer(h(ItineraryDoc, { trip, settings }));
export const renderConfirmationPdf = (trip, settings, message) => renderToBuffer(h(ConfirmationDoc, { trip, settings, message }));
export const renderReceiptPdf = (trip, settings, payments) => renderToBuffer(h(ReceiptDoc, { trip, settings, payments }));
export const renderInvoicePdf = (trip, settings) => renderToBuffer(h(InvoiceDoc, { trip, settings }));
