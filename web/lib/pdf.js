import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Polygon,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// Server-side PDF generation (react-pdf, no Chromium). Reproduces the branded
// "Modern" itinerary design (orange + teal, cover / accommodations /
// transportations / day-wise), matching the in-app ModernTemplate preview.

const h = React.createElement;

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
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const isImg = (u) => typeof u === "string" && /^(https?:|data:)/.test(u);
const txt = (v) => (v == null || v === "" ? "" : String(v));
// Currency code (e.g. "INR") — the ₹ glyph is missing in Helvetica, and the
// brand template uses the code text anyway.
const curCode = (c) => (c ? String(c).split(/[\s(]/)[0] : "INR");
const num = (n) => Number(n || 0).toLocaleString("en-IN");
const money = (n, cur) => `${curCode(cur)} ${num(n)}`;
const brandOf = (s) => s?.brandColor || "#FAA61A";
const tealOf = (s) => s?.secondaryColor || "#123A38";
const agencyOf = (s) => s?.agencyName || "ViaItinerary";
const CREAM = "#FBF3E4";
const INK = "#1C2B2B";
const MUTED = "#6B7B78";

const s = StyleSheet.create({
  page: { fontSize: 10, color: INK, fontFamily: "Helvetica", paddingBottom: 70 },
  pad: { paddingHorizontal: 34 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    borderTopWidth: 2,
    paddingTop: 8,
    fontSize: 8.5,
  },
  bold: { fontFamily: "Helvetica-Bold" },
});

// star rating
function Stars({ count, color }) {
  const pts = "10,1 12.6,7 19,7.3 14,11.5 15.8,18 10,14.3 4.2,18 6,11.5 1,7.3 7.4,7";
  return h(
    View,
    { style: { flexDirection: "row", gap: 2, marginTop: 3, marginBottom: 5 } },
    ...Array.from({ length: Math.max(0, Math.min(5, count || 0)) }, (_, i) =>
      h(
        Svg,
        { key: i, width: 11, height: 11, viewBox: "0 0 20 20" },
        h(Polygon, { points: pts, fill: color }),
      ),
    ),
  );
}

// page footer with agency contacts
function footer(settings) {
  const teal = tealOf(settings);
  const items = [
    settings?.whatsapp || settings?.contactPhone,
    settings?.contactEmail,
    settings?.website,
  ].filter(Boolean);
  return h(
    View,
    { style: { ...s.footer, borderTopColor: brandOf(settings), color: teal }, fixed: true },
    ...items.map((it, i) => h(Text, { key: i, style: s.bold }, txt(it))),
  );
}

// small orange "N NIGHT M DAYS" header block used on inner pages
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
        paddingHorizontal: 34,
        paddingTop: 26,
        paddingBottom: 14,
      },
    },
    h(
      View,
      { style: { backgroundColor: brand, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 4 } },
      h(Text, { style: { ...s.bold, color: "#fff", fontSize: 17 } }, `${nights} NIGHT ${nights + 1} DAYS`),
      h(Text, { style: { color: "#fff", fontSize: 7, letterSpacing: 1 } }, `TRAVEL ITINERARY BY ${agencyOf(settings).toUpperCase()}`),
    ),
    isImg(settings?.logoPath)
      ? h(Image, { src: String(settings.logoPath), style: { height: 30, objectFit: "contain" } })
      : h(Text, { style: { ...s.bold, color: teal, fontSize: 15, letterSpacing: 2 } }, agencyOf(settings).toUpperCase()),
  );
}

// teal section title bar
function sectionBar(title, settings) {
  const teal = tealOf(settings);
  return h(
    View,
    { style: { ...s.pad, marginBottom: 16 } },
    h(
      View,
      { style: { flexDirection: "row" } },
      h(View, { style: { width: 8, backgroundColor: brandOf(settings) } }),
      h(
        View,
        { style: { backgroundColor: teal, flexGrow: 1, paddingVertical: 12, paddingHorizontal: 18 } },
        h(Text, { style: { ...s.bold, color: "#fff", fontSize: 16, letterSpacing: 1 } }, title),
      ),
    ),
  );
}

const labelVal = (label, value, teal) =>
  h(
    View,
    { style: { marginBottom: 12, width: "33%" } },
    h(Text, { style: { color: teal, fontSize: 10, marginBottom: 2 } }, label),
    h(Text, { style: { ...s.bold, color: INK, fontSize: 15 } }, txt(value) || "—"),
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
  const pax = `${trip.adults || 0} Adults${kids ? ` ${kids} Child` : ""}`;
  const greeting =
    (settings?.greetingMessage &&
      settings.greetingMessage.replace(/\{agencyName\}/g, agencyOf(settings))) ||
    `Greetings from ${agencyOf(settings)}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes to any of the provided services.`;

  return h(
    Document,
    {},

    // ── Cover ──────────────────────────────────────────────────────────
    h(
      Page,
      { size: "A4", style: { fontFamily: "Helvetica", color: INK, paddingBottom: 60 } },
      // hero
      h(
        View,
        { style: { height: 300, position: "relative" } },
        isImg(trip.imagePath)
          ? h(Image, { src: String(trip.imagePath), style: { position: "absolute", width: "100%", height: "100%", objectFit: "cover" } })
          : h(View, { style: { position: "absolute", width: "100%", height: "100%", backgroundColor: teal } }),
        h(
          View,
          { style: { position: "absolute", top: 0, left: 0, backgroundColor: brand, paddingVertical: 14, paddingHorizontal: 24, borderBottomRightRadius: 22 } },
          isImg(settings?.logoPath)
            ? h(Image, { src: String(settings.logoPath), style: { height: 26, objectFit: "contain" } })
            : h(Text, { style: { ...s.bold, color: "#fff", fontSize: 18, letterSpacing: 2 } }, agencyOf(settings).toUpperCase()),
          h(Text, { style: { color: "#fff", fontSize: 7, letterSpacing: 2, marginTop: 2 } }, "TRAVEL SIMPLIFIED"),
        ),
        h(
          View,
          { style: { position: "absolute", bottom: 16, left: 24, right: 24 } },
          h(Text, { style: { ...s.bold, color: "#fff", fontSize: 40 } }, `${nights} NIGHT ${nights + 1} DAYS`),
          h(Text, { style: { color: "#fff", fontSize: 13, letterSpacing: 1 } }, `TRAVEL ITINERARY BY ${agencyOf(settings).toUpperCase()}`),
        ),
      ),
      // services band
      settings?.tagline
        ? h(
            View,
            { style: { backgroundColor: brand, paddingVertical: 8, paddingHorizontal: 24 } },
            h(Text, { style: { ...s.bold, color: teal, fontSize: 8.5, letterSpacing: 0.5 } }, settings.tagline.toUpperCase()),
          )
        : null,
      // body
      h(
        View,
        { style: { paddingHorizontal: 30, paddingTop: 22 } },
        h(Text, { style: { ...s.bold, color: teal, fontSize: 20, marginBottom: 8 } }, `Dear ${client}`),
        h(Text, { style: { color: INK, fontSize: 11, lineHeight: 1.6, marginBottom: 20 } }, greeting),
        // info grid
        h(
          View,
          { style: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#E4DAC4", paddingTop: 18 } },
          labelVal("Destination", trip.destination, teal),
          labelVal("Start Date", fmtDate(trip.startDate), teal),
          labelVal("Duration", `${nights}N${nights + 1}D`, teal),
          labelVal("Pax", pax, teal),
          labelVal("Trip ID", `#${trip.tripId}`, teal),
        ),
        // quote box
        h(
          View,
          { style: { backgroundColor: teal, borderRadius: 10, padding: 22, marginTop: 8 } },
          h(Text, { style: { color: CREAM, fontSize: 11, marginBottom: 4 } }, "Quote Price"),
          h(Text, { style: { color: "#fff", fontSize: 15 } }, `Total (${curCode(cur)})`),
          h(Text, { style: { ...s.bold, color: "#fff", fontSize: 34 } }, `${num(trip.cost)}/-`),
          h(Text, { style: { color: CREAM, fontSize: 10, marginTop: 4 } }, trip.includeGst ? "(Including GST)" : "(Excluding GST)"),
        ),
      ),
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
                  style: { flexDirection: "row", backgroundColor: CREAM, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" },
                },
                h(
                  View,
                  { style: { flexGrow: 1, flexBasis: 0, paddingRight: 10 } },
                  h(
                    View,
                    { style: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 } },
                    h(Text, { style: { ...s.bold, color: "#fff", backgroundColor: teal, fontSize: 9, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 3 } }, ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"][i] || `${i + 1}th`),
                    h(Text, { style: { color: MUTED, fontSize: 9, letterSpacing: 1 } }, "NIGHTS AT "),
                    h(Text, { style: { ...s.bold, color: teal, fontSize: 11 } }, txt(a.city) || "—"),
                  ),
                  h(Text, { style: { ...s.bold, color: teal, fontSize: 18 } }, txt(a.name)),
                  h(Stars, { count: parseInt(a.category) || 3, color: brand }),
                  h(
                    View,
                    { style: { flexDirection: "row", gap: 30, marginTop: 2 } },
                    h(View, {}, h(Text, { style: { color: MUTED, fontSize: 7.5, letterSpacing: 1 } }, "ROOMS"), h(Text, { style: { ...s.bold, fontSize: 10 } }, txt(a.rooms) || "1")),
                    h(View, {}, h(Text, { style: { color: MUTED, fontSize: 7.5, letterSpacing: 1 } }, "MEAL PLAN"), h(Text, { style: { ...s.bold, fontSize: 10 } }, txt(a.mealPlan) || "—")),
                  ),
                ),
                isImg(a.imagePath || a.hotel?.imagePath)
                  ? h(Image, { src: String(a.imagePath || a.hotel?.imagePath), style: { width: 150, height: 100, borderRadius: 8, borderWidth: 2, borderColor: brand, objectFit: "cover" } })
                  : null,
              ),
            ),
          ),
          footer(settings),
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
                h(Text, { key: i, style: { ...s.bold, flexGrow: 1, flexBasis: 0, padding: 10, color: teal, fontSize: 10 } }, hd),
              ),
            ),
            ...transports.map((t, i) =>
              h(
                View,
                { key: i, style: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: "#E4DAC4" } },
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 10, fontSize: 9.5 } }, fmtDayLabel(t.date, i)),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 10, fontSize: 9.5 } }, txt(t.route || t.destination) || "—"),
                h(Text, { style: { flexGrow: 1, flexBasis: 0, padding: 10, fontSize: 9.5 } }, `${t.quantity || 1} ${txt(t.vehicleType || t.vehicle?.name) || "Vehicle"}`),
              ),
            ),
          ),
          footer(settings),
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
                { key: i, wrap: false, style: { marginBottom: 22 } },
                h(
                  View,
                  { style: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 } },
                  h(
                    View,
                    { style: { width: 52, height: 52, borderRadius: 26, backgroundColor: teal, alignItems: "center", justifyContent: "center" } },
                    h(Text, { style: { ...s.bold, color: "#fff", fontSize: 20 } }, `${d.dayNumber ?? i + 1}`),
                    h(Text, { style: { color: brand, fontSize: 7, letterSpacing: 1 } }, "DAY"),
                  ),
                  h(
                    View,
                    { style: { flexGrow: 1, flexBasis: 0 } },
                    h(Text, { style: { color: MUTED, fontSize: 9 } }, fmtDayLabel(trip.startDate ? new Date(new Date(trip.startDate).getTime() + i * 864e5) : null, i).toUpperCase()),
                    h(Text, { style: { ...s.bold, color: teal, fontSize: 14 } }, txt(d.title).toUpperCase()),
                  ),
                ),
                isImg(d.imagePath)
                  ? h(Image, { src: String(d.imagePath), style: { width: "100%", height: 150, borderRadius: 8, borderWidth: 2, borderColor: brand, objectFit: "cover", marginBottom: 10 } })
                  : null,
                acts.length
                  ? h(
                      View,
                      {},
                      h(Text, { style: { ...s.bold, color: teal, fontSize: 13, marginBottom: 6 } }, "ACTIVITIES"),
                      ...acts.map((a, k) =>
                        h(
                          View,
                          { key: k, style: { flexDirection: "row", marginBottom: 4 } },
                          h(Text, { style: { color: teal, marginRight: 6 } }, "•"),
                          h(Text, { style: { color: INK, fontSize: 10, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, a),
                        ),
                      ),
                    )
                  : null,
              );
            }),
          ),
          footer(settings),
        )
      : null,

    // ── Inclusions / Exclusions ────────────────────────────────────────
    (() => {
      const inc = arr(trip.inclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      const exc = arr(trip.exclusions).map((x) => (typeof x === "object" ? x.content || x.text : x)).filter(Boolean);
      if (!inc.length && !exc.length) return null;
      const list = (title, items) =>
        h(
          View,
          { style: { width: "50%", paddingRight: 12 } },
          h(Text, { style: { ...s.bold, color: teal, fontSize: 13, marginBottom: 8 } }, title),
          ...(items.length ? items : ["—"]).map((it, k) =>
            h(
              View,
              { key: k, style: { flexDirection: "row", marginBottom: 4 } },
              h(Text, { style: { color: brand, marginRight: 6 } }, "•"),
              h(Text, { style: { fontSize: 10, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 } }, txt(it)),
            ),
          ),
        );
      return h(
        Page,
        { size: "A4", style: s.page },
        pageHeader(trip, settings),
        sectionBar("INCLUSIONS & EXCLUSIONS", settings),
        h(View, { style: { ...s.pad, flexDirection: "row" } }, list("Inclusions", inc), list("Exclusions", exc)),
        footer(settings),
      );
    })(),
  );
}

// ── Confirmation / Receipt / Invoice (branded header, simple body) ──────────
const simpleStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "Helvetica", paddingBottom: 60 },
  banner: { color: "#fff", padding: 12, borderRadius: 4, marginBottom: 14, textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "35%", color: MUTED },
  value: { width: "65%", fontFamily: "Helvetica-Bold" },
  section: { marginTop: 14 },
  th: { flexDirection: "row", backgroundColor: CREAM, padding: 6, fontFamily: "Helvetica-Bold" },
  td: { flexDirection: "row", padding: 6, borderBottomWidth: 1, borderBottomColor: "#E4DAC4" },
  cell: { flexGrow: 1, flexBasis: 0 },
});
const brandHead = (settings) =>
  h(
    View,
    { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 3, borderBottomColor: brandOf(settings), paddingBottom: 10 } },
    h(View, {}, h(Text, { style: { fontSize: 16, fontFamily: "Helvetica-Bold", color: tealOf(settings) } }, agencyOf(settings)), h(Text, { style: { fontSize: 8, color: MUTED } }, "TRAVEL SIMPLIFIED")),
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
