import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { currencySymbol } from "@/lib/serialize";

// Server-side PDF generation (react-pdf, no Chromium). These are functional
// reproductions of the dompdf Blade documents (pdf.trip-modern / confirmation /
// receipt / invoice) — same content and sections, clean layout.

const h = React.createElement;
const BRAND = "#2563eb";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#111827", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 10 },
  agency: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND },
  tagline: { fontSize: 8, color: MUTED, marginTop: 2 },
  logo: { height: 40, objectFit: "contain" },
  banner: { backgroundColor: BRAND, color: "#fff", padding: 10, borderRadius: 4, marginBottom: 14, textAlign: "center", fontSize: 14, fontFamily: "Helvetica-Bold" },
  hero: { width: "100%", height: 150, objectFit: "cover", borderRadius: 6, marginBottom: 14 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtle: { color: MUTED },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "35%", color: MUTED },
  value: { width: "65%", fontFamily: "Helvetica-Bold" },
  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 8, marginBottom: 6 },
  th: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 4, paddingHorizontal: 4, fontFamily: "Helvetica-Bold" },
  td: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  cell: { flexGrow: 1, flexBasis: 0 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", color: MUTED, fontSize: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
  message: { lineHeight: 1.5, marginBottom: 8 },
});

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtMoney = (n, cur) => `${currencySymbol(cur)}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const txt = (val) => (val == null || val === "" ? "—" : String(val));

const infoRow = (label, value) => h(View, { style: s.row, key: label }, h(Text, { style: s.label }, label), h(Text, { style: s.value }, txt(value)));

function header(agencyName, logo) {
  return h(
    View,
    { style: s.headerRow },
    h(View, {}, h(Text, { style: s.agency }, agencyName), h(Text, { style: s.tagline }, "TRAVEL SIMPLIFIED")),
    logo ? h(Image, { style: s.logo, src: logo }) : null
  );
}

function table(headings, rows) {
  return h(
    View,
    {},
    h(View, { style: s.th }, ...headings.map((hd, i) => h(Text, { style: s.cell, key: i }, hd))),
    ...rows.map((cols, ri) => h(View, { style: s.td, key: ri }, ...cols.map((c, ci) => h(Text, { style: s.cell, key: ci }, txt(c)))))
  );
}

function travellers(trip) {
  const parts = [`${trip.adults || 0} Adults`];
  if (trip.kidsCnb) parts.push(`${trip.kidsCnb} CNB`);
  if (trip.kids5to12) parts.push(`${trip.kids5to12} (5-12)`);
  return parts.join(", ");
}

function inclusionsExclusions(trip) {
  const inc = arr(trip.inclusions);
  const exc = arr(trip.exclusions);
  return h(
    View,
    { style: s.section },
    h(Text, { style: s.sectionTitle }, "Inclusions / Exclusions"),
    h(Text, { style: { fontFamily: "Helvetica-Bold", marginBottom: 2 } }, "Inclusions"),
    inc.length ? inc.map((i, k) => h(Text, { style: s.bullet, key: `i${k}` }, `• ${txt(typeof i === "object" ? i.content || i.text : i)}`)) : h(Text, { style: s.subtle }, "No inclusions added"),
    h(Text, { style: { fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 } }, "Exclusions"),
    exc.length ? exc.map((e, k) => h(Text, { style: s.bullet, key: `e${k}` }, `• ${txt(typeof e === "object" ? e.content || e.text : e)}`)) : h(Text, { style: s.subtle }, "No exclusions added")
  );
}

function logoOf(settings) {
  const l = settings?.logoPath;
  return l ? String(l) : null;
}
const agencyNameOf = (settings) => settings?.agencyName || "ViaItinerary";

// ── Itinerary (trip-modern) ─────────────────────────────────────────────────
function ItineraryDoc({ trip, settings }) {
  const cur = trip.currency;
  return h(
    Document,
    {},
    h(
      Page,
      { size: "A4", style: s.page },
      header(agencyNameOf(settings), logoOf(settings)),
      trip.imagePath ? h(Image, { style: s.hero, src: String(trip.imagePath) }) : null,
      h(Text, { style: s.title }, txt(trip.tripTitle)),
      trip.tagline ? h(Text, { style: s.subtle }, trip.tagline) : null,
      h(
        View,
        { style: s.section },
        infoRow("Trip ID", trip.tripId),
        infoRow("Destination", trip.destination),
        infoRow("Start Date", fmtDate(trip.startDate)),
        infoRow("Duration", trip.duration ? `${trip.duration} Days` : "—"),
        infoRow("Travellers", travellers(trip)),
        infoRow("Quote Price", fmtMoney(trip.cost, cur))
      ),
      arr(trip.itineraries).length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Day Wise Itinerary"),
            ...arr(trip.itineraries).map((d, i) =>
              h(
                View,
                { style: s.card, key: i },
                h(Text, { style: { fontFamily: "Helvetica-Bold" } }, `Day ${d.dayNumber ?? i + 1}: ${txt(d.title)}`),
                d.location ? h(Text, { style: s.subtle }, txt(d.location)) : null,
                d.description ? h(Text, { style: { marginTop: 2 } }, txt(d.description)) : null
              )
            )
          )
        : null,
      arr(trip.accommodations).length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Accommodations"),
            table(
              ["Hotel", "City", "Room", "Meal", "Check-in", "Check-out"],
              arr(trip.accommodations).map((a) => [a.name || a.hotel?.name, a.city, a.roomType, a.mealPlan, fmtDate(a.checkIn), fmtDate(a.checkOut)])
            )
          )
        : null,
      arr(trip.transportations).length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Transportations"),
            table(
              ["Vehicle", "Route", "Date", "Qty"],
              arr(trip.transportations).map((t) => [t.vehicleType || t.vehicle?.name, t.route || t.destination, fmtDate(t.date), t.quantity ?? 1])
            )
          )
        : null,
      inclusionsExclusions(trip),
      h(Text, { style: s.footer, fixed: true }, `${agencyNameOf(settings)}${settings?.companyAddress ? " · " + settings.companyAddress : ""}`)
    )
  );
}

// ── Confirmation ────────────────────────────────────────────────────────────
function ConfirmationDoc({ trip, settings, message }) {
  const cur = trip.currency;
  return h(
    Document,
    {},
    h(
      Page,
      { size: "A4", style: s.page },
      header(agencyNameOf(settings), logoOf(settings)),
      h(Text, { style: s.banner }, "BOOKING CONFIRMED"),
      trip.imagePath ? h(Image, { style: s.hero, src: String(trip.imagePath) }) : null,
      h(Text, { style: s.message }, txt(message)),
      h(
        View,
        { style: s.section },
        infoRow("Trip ID", trip.tripId),
        infoRow("Start Date", fmtDate(trip.startDate)),
        infoRow("Duration", trip.duration ? `${trip.duration} Days` : "—"),
        infoRow("Quote Price", fmtMoney(trip.cost, cur)),
        infoRow("GST / Taxes", fmtMoney(trip.gstAmount, cur)),
        infoRow("Paid Amount", fmtMoney(trip.paidAmount, cur))
      ),
      h(Text, { style: s.footer, fixed: true }, `${agencyNameOf(settings)} · ${fmtDate(new Date())}`)
    )
  );
}

// ── Payment receipt (voucher) ───────────────────────────────────────────────
function ReceiptDoc({ trip, settings, payments }) {
  const cur = trip.currency;
  const total = Number(trip.cost || 0);
  const paid = Number(trip.paidAmount || 0);
  return h(
    Document,
    {},
    h(
      Page,
      { size: "A4", style: s.page },
      header(agencyNameOf(settings), logoOf(settings)),
      h(Text, { style: s.banner }, "PAYMENT RECEIVED"),
      h(
        View,
        { style: s.section },
        infoRow("Receipt Number", `${trip.tripId}-R`),
        infoRow("Date", fmtDate(new Date())),
        infoRow("Guest Name", trip.clientName),
        infoRow("Transaction Receipt For", trip.tripTitle),
        infoRow("Tour Duration", trip.duration ? `${trip.duration} Days` : "—"),
        infoRow("GST / Taxes", fmtMoney(trip.gstAmount, cur)),
        infoRow("Amount Paid", fmtMoney(paid, cur)),
        infoRow("Paid / Total", `${fmtMoney(paid, cur)} / ${fmtMoney(total, cur)}`)
      ),
      payments && payments.length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Payments"),
            table(
              ["Date of Payment", "Description", "Method", "Amount"],
              payments.map((p) => [fmtDate(p.settlementDate), p.settlementType || "Receipt", p.method || "—", fmtMoney(p.amount, cur)])
            )
          )
        : null,
      h(Text, { style: { ...s.subtle, marginTop: 10, fontSize: 8 } }, "Applicable government taxes included where shown."),
      h(Text, { style: s.footer, fixed: true }, agencyNameOf(settings))
    )
  );
}

// ── Invoice ─────────────────────────────────────────────────────────────────
function InvoiceDoc({ trip, settings }) {
  const cur = trip.currency;
  return h(
    Document,
    {},
    h(
      Page,
      { size: "A4", style: s.page },
      header(agencyNameOf(settings), logoOf(settings)),
      h(Text, { style: s.banner }, trip.status === "confirmed" ? "TRIP CONFIRMED" : "INVOICE"),
      h(
        View,
        { style: s.section },
        h(Text, { style: s.sectionTitle }, "Client Details"),
        infoRow("Client Name", trip.clientName),
        infoRow("Email", trip.clientEmail),
        infoRow("Phone", trip.clientPhone)
      ),
      h(
        View,
        { style: s.section },
        h(Text, { style: s.sectionTitle }, "Package Details"),
        infoRow("Trip ID", trip.tripId),
        infoRow("Travel Dates", fmtDate(trip.startDate)),
        infoRow("Duration", trip.duration ? `${trip.duration} Days` : "—"),
        infoRow("Travellers", travellers(trip)),
        infoRow("Status", trip.status),
        infoRow("Total", fmtMoney(trip.cost, cur))
      ),
      arr(trip.accommodations).length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Hotel Bookings"),
            table(
              ["Hotel Name", "Meal Plan", "Rooms"],
              arr(trip.accommodations).map((a) => [a.name || a.hotel?.name, a.mealPlan, a.rooms])
            )
          )
        : null,
      arr(trip.transportations).length
        ? h(
            View,
            { style: s.section },
            h(Text, { style: s.sectionTitle }, "Vehicle Bookings"),
            table(
              ["Vehicle", "Route", "Qty"],
              arr(trip.transportations).map((t) => [t.vehicleType || t.vehicle?.name, t.route || t.destination, t.quantity ?? 1])
            )
          )
        : null,
      inclusionsExclusions(trip),
      h(Text, { style: s.footer, fixed: true }, `Powered by ${agencyNameOf(settings)}`)
    )
  );
}

export const renderItineraryPdf = (trip, settings) => renderToBuffer(h(ItineraryDoc, { trip, settings }));
export const renderConfirmationPdf = (trip, settings, message) => renderToBuffer(h(ConfirmationDoc, { trip, settings, message }));
export const renderReceiptPdf = (trip, settings, payments) => renderToBuffer(h(ReceiptDoc, { trip, settings, payments }));
export const renderInvoicePdf = (trip, settings) => renderToBuffer(h(InvoiceDoc, { trip, settings }));
