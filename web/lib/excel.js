import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";

// Port of the Maatwebsite Excel bulk import/export (App\Imports\*, App\Exports\*).
// SheetJS reads/writes the same three-sheet workbook: Transportation (vehicles),
// Accommodation (hotels), Destinations.

/** Mirror Maatwebsite WithHeadingRow: lowercase, non-alphanumeric runs → "_". */
export function normalizeHeader(h) {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Read a named sheet into an array of objects keyed by normalized header. */
export function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return raw.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) out[normalizeHeader(k)] = v;
    return out;
  });
}

const num = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
const str = (v) => (v == null ? "" : String(v).trim());

// ── Catalog upserts (scoped by admin) ──────────────────────────────────────
async function upsertVehicle(adminId, data) {
  const existing = await prisma.vehicle.findFirst({ where: { userId: adminId, name: data.name } });
  if (existing) return prisma.vehicle.update({ where: { id: existing.id }, data });
  return prisma.vehicle.create({ data: { ...data, userId: adminId } });
}
async function upsertHotel(adminId, key, data) {
  const existing = await prisma.hotel.findFirst({ where: { userId: adminId, name: key.name, city: key.city || null } });
  if (existing) return prisma.hotel.update({ where: { id: existing.id }, data });
  return prisma.hotel.create({ data: { ...key, ...data, userId: adminId } });
}
async function upsertDestination(adminId, name, data) {
  const existing = await prisma.destination.findFirst({ where: { userId: adminId, name } });
  if (existing) return prisma.destination.update({ where: { id: existing.id }, data });
  return prisma.destination.create({ data: { name, ...data, userId: adminId } });
}

function hotelPriceSections(row) {
  const json = row.price_sections ?? row.price_sections_json ?? null;
  if (json) {
    try {
      const decoded = typeof json === "string" ? JSON.parse(json) : json;
      if (Array.isArray(decoded)) return decoded;
    } catch {
      /* fall through to legacy columns */
    }
  }
  // Legacy per-room-type columns.
  const sections = [];
  const add = (type, price, cnb, upto5, above12) => {
    if (price > 0 || cnb > 0 || upto5 > 0 || above12 > 0) {
      sections.push({ room_type: type, meal_plan: "room_only", price, cnb, upto_5: upto5, above_12: above12 });
    }
  };
  add(
    "deluxe",
    num(row.deluxe_room_price),
    num(row.deluxe_extra_bed_price_cnb ?? row.deluxe_extra_bed_price_upto_5),
    num(row.deluxe_extra_bed_price_5_12 ?? row.deluxe_extra_bed_price_5_to_12 ?? row.deluxe_extra_bed_price),
    num(row.deluxe_extra_bed_price_above_12)
  );
  add(
    "super_deluxe",
    num(row.super_deluxe_room_price),
    num(row.super_deluxe_extra_bed_price_cnb ?? row.super_deluxe_extra_bed_price_upto_5),
    num(row.super_deluxe_extra_bed_price_5_12 ?? row.super_deluxe_extra_bed_price_5_to_12 ?? row.super_deluxe_extra_bed_price),
    num(row.super_deluxe_extra_bed_price_above_12)
  );
  add(
    "suite",
    num(row.suite_price),
    num(row.suite_extra_bed_price_cnb ?? row.suite_extra_bed_price_upto_5),
    num(row.suite_extra_bed_price_5_12 ?? row.suite_extra_bed_price_5_to_12 ?? row.suite_extra_bed_price),
    num(row.suite_extra_bed_price_above_12)
  );
  return sections;
}

/** Import all three catalog sheets from an uploaded workbook buffer. */
export async function importCatalogWorkbook(buffer, adminId) {
  const wb = XLSX.read(buffer, { type: "buffer" });

  for (const row of sheetRows(wb, "Transportation")) {
    const name = str(row.car_name || row.name);
    if (!name) continue;
    await upsertVehicle(adminId, {
      name,
      email: str(row.vehicle_email || row.email) || null,
      phone: str(row.vehicle_phone || row.phone) || null,
      price: num(row.price_inr || row.price),
    });
  }

  for (const row of sheetRows(wb, "Accommodation")) {
    const name = str(row.hotel_name || row.name);
    if (!name) continue;
    await upsertHotel(
      adminId,
      { name, city: str(row.city) || null },
      {
        email: str(row.hotel_email || row.email) || null,
        phone: str(row.hotel_phone || row.phone) || null,
        priceSections: hotelPriceSections(row),
      }
    );
  }

  for (const row of sheetRows(wb, "Destinations")) {
    const name = str(row.destination_name || row.name);
    if (!name) continue;
    const actRaw = row.activities;
    const activities = Array.isArray(actRaw)
      ? actRaw
      : str(actRaw)
      ? str(actRaw).split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    await upsertDestination(adminId, name, { activities });
  }
}

// ── Workbook builders (export + blank template) ─────────────────────────────
const TRANSPORT_HEAD = ["Car Name", "Vehicle Email", "Vehicle Phone", "Price (INR)"];
const HOTEL_HEAD = ["Hotel Name", "City", "Hotel Email", "Hotel Phone", "Price Sections (JSON)"];
const DEST_HEAD = ["Destination Name", "Activities"];

function appendSheet(wb, title, head, rows) {
  const sheet = XLSX.utils.aoa_to_sheet([head, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheet, title);
}

export async function exportCatalogWorkbook(adminId) {
  const [vehicles, hotels, destinations] = await Promise.all([
    prisma.vehicle.findMany({ where: { userId: adminId } }),
    prisma.hotel.findMany({ where: { userId: adminId } }),
    prisma.destination.findMany({ where: { userId: adminId } }),
  ]);

  const wb = XLSX.utils.book_new();
  appendSheet(
    wb,
    "Transportation",
    TRANSPORT_HEAD,
    vehicles.map((v) => [v.name, v.email || "", v.phone || "", v.price == null ? "" : Number(v.price)])
  );
  appendSheet(
    wb,
    "Accommodation",
    HOTEL_HEAD,
    hotels.map((h) => [h.name, h.city || "", h.email || "", h.phone || "", JSON.stringify(h.priceSections ?? [])])
  );
  appendSheet(
    wb,
    "Destinations",
    DEST_HEAD,
    destinations.map((d) => [d.name, Array.isArray(d.activities) ? d.activities.join(", ") : d.activities || ""])
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function templateWorkbook() {
  const wb = XLSX.utils.book_new();
  appendSheet(wb, "Transportation", TRANSPORT_HEAD, []);
  appendSheet(wb, "Accommodation", HOTEL_HEAD, []);
  appendSheet(wb, "Destinations", DEST_HEAD, []);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function readFirstSheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = wb.SheetNames[0];
  return first ? sheetRows(wb, first) : [];
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
