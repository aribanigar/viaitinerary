import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { catalogGate } from "@/lib/subscription";

// Catalog bulk import / export (Settings → Bulk Data Management).
//
// One table, one row per thing, first column "Type": Hotel | Transport |
// Destination. The same layout is the sample file, the export and the import,
// so export → edit in Excel → import is a clean round trip. It can be a .csv
// (one table) or an .xlsx (first sheet). A hotel with several room types /
// meal plans / seasons is several Hotel rows with the same Name + City, one
// rate per row.
//
// Rules the import keeps:
// - A BLANK cell never changes anything: only filled cells are written, and a
//   hotel's rates are replaced only when the file gives it at least one rate.
// - Rows are matched to existing catalog entries by name (hotels: name + city),
//   ignoring case, so re-importing an export updates instead of duplicating.
// - New rows go through the same plan limits and DMC-partner block as the
//   Add buttons (`catalogCollection` POST in lib/catalog.js).
// - Every row that can't be used is reported back with its row number + reason.
//
// The older three-sheet workbook (Transportation / Accommodation / Destinations
// sheets, hotel rates as JSON) is still read.

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

/** Lowercase, non-alphanumeric runs → "_" ("Price (INR)" → "price_inr"). */
export function normalizeHeader(h) {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsOf(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  return raw.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) out[normalizeHeader(k)] = v;
    return out;
  });
}

/** Read a named sheet into an array of objects keyed by normalized header. */
export function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? rowsOf(sheet) : [];
}

/** Parse an uploaded file. CSVs are decoded as UTF-8 text and kept as text
 * (phone numbers keep leading zeros, "₹2,500" survives to be parsed by us). */
export function readWorkbook(buffer, fileName = "") {
  const isCsv = /\.csv$/i.test(fileName) || (!/\.xlsx?$/i.test(fileName) && looksLikeText(buffer));
  if (isCsv) {
    const text = Buffer.from(buffer).toString("utf8").replace(/^﻿/, "");
    return XLSX.read(text, { type: "string", raw: true });
  }
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

function looksLikeText(buffer) {
  const b = Buffer.from(buffer);
  // .xlsx is a zip ("PK"), .xls an OLE file (D0 CF 11 E0).
  return !(b[0] === 0x50 && b[1] === 0x4b) && !(b[0] === 0xd0 && b[1] === 0xcf);
}

export function readFirstSheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = wb.SheetNames[0];
  return first ? sheetRows(wb, first) : [];
}

// ── Cell parsing ────────────────────────────────────────────────────────────
const str = (v) => (v == null ? "" : v instanceof Date ? isoDate(v) : String(v).trim());
const blank = (v) => str(v) === "";

class RowError extends Error {}

/** "₹2,500", "Rs 2500", "2 500", 2500 → 2500. Blank → undefined. */
export function parseNumber(v, label) {
  if (blank(v)) return undefined;
  if (typeof v === "number") return v;
  const cleaned = str(v).replace(/₹|rs\.?|inr|\/-|,|\s/gi, "");
  const n = Number(cleaned);
  if (cleaned === "" || Number.isNaN(n)) throw new RowError(`${label} "${str(v)}" is not a number`);
  return n;
}

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 2026-04-01, 01-04-2026, 01/04/2026, 1.4.2026, an Excel date → "2026-04-01". */
export function parseDate(v, label) {
  if (blank(v)) return undefined;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return isoDate(v);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = str(v);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  throw new RowError(`${label} "${s}" is not a date (use YYYY-MM-DD, e.g. 2026-04-01)`);
}

const MEAL_PLANS = [
  ["room_only", ["room_only", "room only", "only room", "ep", "european plan", "no meals"]],
  ["breakfast_only", ["breakfast_only", "breakfast only", "breakfast", "cp", "continental plan", "bb", "bed and breakfast", "room + breakfast", "only room + breakfast"]],
  ["breakfast_dinner", ["breakfast_dinner", "breakfast + dinner", "breakfast and dinner", "breakfast & dinner", "map", "modified american plan", "half board"]],
  ["all_meals", ["all_meals", "all meals", "breakfast + lunch + dinner", "ap", "american plan", "full board"]],
];
const MEAL_PLAN_LABEL = {
  room_only: "Room only (EP)",
  breakfast_only: "Breakfast only (CP)",
  breakfast_dinner: "Breakfast + Dinner (MAP)",
  all_meals: "All meals (AP)",
};

export function parseMealPlan(v) {
  if (blank(v)) return "room_only";
  // "Breakfast + Dinner (MAP)" → try the whole text, then the bracketed code.
  const s = str(v).toLowerCase().replace(/\s+/g, " ");
  const tries = [s, s.replace(/\s*\(.*\)\s*$/, ""), (s.match(/\(([^)]+)\)/) || [])[1]].filter(Boolean);
  for (const t of tries) {
    for (const [key, words] of MEAL_PLANS) if (words.includes(t)) return key;
  }
  throw new RowError(`Meal Plan "${str(v)}" not recognised (use Room only, CP, MAP or AP)`);
}

const slug = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const titleCase = (s) => str(s).replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "4", "4 star", "4*", "4-Star", 4 → "4". */
export function parseStars(v) {
  if (blank(v)) return undefined;
  const m = str(v).match(/^([1-7])(\s*(\*|star|stars|-star))?$/i);
  if (!m) throw new RowError(`Star Rating "${str(v)}" should be a number from 1 to 7`);
  return m[1];
}

const VEHICLE_TYPES = {
  sedan: "sedan", suv: "suv", muv: "suv", hatchback: "hatchback",
  tempo: "tempo_traveller", tempo_traveller: "tempo_traveller", tempo_traveler: "tempo_traveller", traveller: "tempo_traveller",
  mini_bus: "mini_bus", minibus: "mini_bus", bus: "luxury_bus", luxury_bus: "luxury_bus", other: "other",
};
function parseVehicleType(v) {
  if (blank(v)) return undefined;
  const t = VEHICLE_TYPES[slug(v)];
  if (!t) throw new RowError(`Vehicle Type "${str(v)}" not recognised (use Sedan, SUV, Hatchback, Tempo Traveller, Mini Bus, Luxury Bus or Other)`);
  return t;
}

/** "Gondola Phase 1 (900); Shikara Ride (₹1,200); Snow Bike" → [{name, cost}].
 * Semicolons or new lines separate activities; a list with neither (the old
 * export) is split on commas. */
export function parseActivities(v) {
  if (blank(v)) return undefined;
  const s = str(v);
  const parts = /[;\n]/.test(s) ? s.split(/[;\n]/) : s.split(",");
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*?)\s*[([]\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(?:\/-)?\s*[)\]]$/i);
      return m && m[1] ? { name: m[1].trim(), cost: Number(m[2].replace(/,/g, "")) } : { name: p, cost: 0 };
    });
}

export function formatActivities(activities) {
  if (!Array.isArray(activities)) return "";
  return activities
    .map((a) => {
      if (typeof a === "string") return a;
      if (!a?.name) return null;
      const cost = Number(a.cost) || 0;
      return cost > 0 ? `${a.name} (${cost})` : a.name;
    })
    .filter(Boolean)
    .join("; ");
}

// ── The one-table layout ────────────────────────────────────────────────────
export const CATALOG_COLUMNS = [
  "Type", "Name", "City", "State", "Email", "Phone",
  "Star Rating", "Room Type", "Meal Plan", "Room Price",
  "Child No Bed (CNB)", "Child 5-12 Bed", "Child 12+ Bed", "Extra Adult Bed",
  "Season From", "Season To",
  "Seats", "Vehicle Type", "Cab Price",
  "Activities",
];

const KINDS = {
  hotel: "hotel", hotels: "hotel", accommodation: "hotel", stay: "hotel",
  transport: "vehicle", transportation: "vehicle", cab: "vehicle", cabs: "vehicle", vehicle: "vehicle", car: "vehicle",
  destination: "destination", destinations: "destination", place: "destination",
};

/** Pick the first filled cell among header aliases. */
const pick = (row, ...keys) => {
  for (const k of keys) if (!blank(row[k])) return row[k];
  return "";
};

/** Turn the workbook into [{kind, sheet, row, cells}] in the one-table shape. */
function collectRows(wb) {
  const legacy = ["Transportation", "Accommodation", "Destinations"].filter((n) => wb.Sheets[n]);
  const out = [];
  if (legacy.length) {
    sheetRows(wb, "Transportation").forEach((r, i) =>
      out.push({ kind: "vehicle", sheet: "Transportation", row: i + 2, cells: { ...r, name: pick(r, "car_name", "name"), email: pick(r, "vehicle_email", "email"), phone: pick(r, "vehicle_phone", "phone"), cab_price: pick(r, "price_inr", "price") } }));
    sheetRows(wb, "Accommodation").forEach((r, i) =>
      out.push({ kind: "hotel", sheet: "Accommodation", row: i + 2, cells: { ...r, name: pick(r, "hotel_name", "name"), email: pick(r, "hotel_email", "email"), phone: pick(r, "hotel_phone", "phone") } }));
    sheetRows(wb, "Destinations").forEach((r, i) =>
      out.push({ kind: "destination", sheet: "Destinations", row: i + 2, cells: { ...r, name: pick(r, "destination_name", "name") } }));
    return { rows: out, skipped: [] };
  }

  const sheetName = wb.SheetNames[0];
  const rows = sheetName ? sheetRows(wb, sheetName) : [];
  const skipped = [];
  if (rows.length && !("type" in rows[0])) {
    throw new ImportError(`The first column must be "Type" (Hotel, Transport or Destination). Download the sample file to see the layout.`);
  }
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    if (Object.values(r).every(blank)) return;
    const kind = KINDS[slug(r.type)];
    if (!kind) {
      skipped.push({ row: rowNo, reason: `Type "${str(r.type)}" should be Hotel, Transport or Destination` });
      return;
    }
    out.push({ kind, sheet: sheetName, row: rowNo, cells: { ...r, name: pick(r, "name", "hotel_name", "car_name", "destination_name") } });
  });
  return { rows: out, skipped };
}

export class ImportError extends Error {}

/** The rate a Hotel row carries, or null when its rate cells are all blank. */
function rateOf(c) {
  const roomType = pick(c, "room_type");
  const price = parseNumber(pick(c, "room_price", "price"), "Room Price");
  const rest = {
    cnb: parseNumber(pick(c, "child_no_bed_cnb", "child_no_bed", "cnb"), "Child No Bed"),
    upto_5: parseNumber(pick(c, "child_5_12_bed", "child_5_12", "5_12_yrs"), "Child 5-12 Bed"),
    above_12: parseNumber(pick(c, "child_12_bed", "child_12", "12_yrs"), "Child 12+ Bed"),
    extra_adult: parseNumber(pick(c, "extra_adult_bed", "extra_adult"), "Extra Adult Bed"),
  };
  const from = parseDate(pick(c, "season_from", "valid_from"), "Season From");
  const to = parseDate(pick(c, "season_to", "valid_to"), "Season To");
  const anything = !blank(roomType) || price !== undefined || Object.values(rest).some((v) => v !== undefined) || from || to || !blank(c.meal_plan);
  if (!anything) return null;
  if (blank(roomType)) throw new RowError("Room Type is needed when a room rate is given");
  if (price === undefined) throw new RowError("Room Price is needed when a Room Type is given");
  if (from && to && from > to) throw new RowError("Season From is after Season To");
  return {
    room_type: slug(roomType),
    meal_plan: parseMealPlan(c.meal_plan),
    price,
    cnb: rest.cnb ?? 0,
    upto_5: rest.upto_5 ?? 0,
    above_12: rest.above_12 ?? 0,
    extra_adult: rest.extra_adult ?? 0,
    valid_from: from ?? null,
    valid_to: to ?? null,
  };
}

/** Rates given as JSON (old workbook). */
function jsonRates(c) {
  const json = pick(c, "price_sections_json", "price_sections");
  if (blank(json)) return null;
  let decoded;
  try {
    decoded = JSON.parse(str(json));
  } catch {
    throw new RowError("Price Sections (JSON) is not valid JSON");
  }
  if (!Array.isArray(decoded)) throw new RowError("Price Sections (JSON) must be a list");
  return decoded;
}

const rateKey = (s) => [s.room_type, s.meal_plan || "", s.valid_from || "", s.valid_to || ""].join("|");
const lower = (s) => str(s).toLowerCase();
const setIf = (data, key, value) => {
  if (value !== undefined && value !== "") data[key] = value;
};

/**
 * Import a catalog file for one agency.
 * @returns {{ created, updated, skipped: [{sheet,row,name,reason}] }}
 */
export async function importCatalogWorkbook(buffer, adminId, { fileName = "", isDmcBridge = false } = {}) {
  let wb;
  try {
    wb = readWorkbook(buffer, fileName);
  } catch {
    throw new ImportError("This file couldn't be read. Upload a .csv or .xlsx file.");
  }
  const { rows, skipped } = collectRows(wb);
  if (!rows.length && !skipped.length) {
    throw new ImportError("The file has no rows to import. Download the sample file to see the layout.");
  }

  const created = { hotels: 0, cabs: 0, destinations: 0 };
  const updated = { hotels: 0, cabs: 0, destinations: 0 };
  const skip = (r, reason) => skipped.push({ sheet: r.sheet, row: r.row, name: str(r.cells.name) || undefined, reason });

  const [vehicles, hotels, destinations] = await Promise.all([
    prisma.vehicle.findMany({ where: { userId: adminId }, select: { id: true, name: true } }),
    prisma.hotel.findMany({ where: { userId: adminId }, select: { id: true, name: true, city: true, priceSections: true } }),
    prisma.destination.findMany({ where: { userId: adminId }, select: { id: true, name: true, activities: true } }),
  ]);
  const byName = (list) => {
    const m = new Map();
    for (const x of list) if (!m.has(lower(x.name))) m.set(lower(x.name), x);
    return m;
  };
  const vehicleIndex = byName(vehicles);
  const destIndex = byName(destinations);
  const hotelKey = (name, city) => `${lower(name)}|${lower(city)}`;
  const hotelIndex = new Map();
  for (const h of hotels) if (!hotelIndex.has(hotelKey(h.name, h.city))) hotelIndex.set(hotelKey(h.name, h.city), h);

  async function canCreate(r, kind) {
    if (isDmcBridge) {
      skip(r, "New catalog entries are managed by Via Kashmir for DMC partner accounts");
      return false;
    }
    const gate = await catalogGate(adminId, kind);
    if (!gate.allowed) skip(r, gate.reason);
    return gate.allowed;
  }

  // Hotels first: group the rows of one hotel (name + city) so its rates are
  // gathered from every row before the hotel is written once.
  const hotelGroups = new Map();
  for (const r of rows.filter((x) => x.kind === "hotel")) {
    const name = str(r.cells.name);
    if (!name) {
      skip(r, "Name is empty");
      continue;
    }
    const key = hotelKey(name, r.cells.city);
    if (!hotelGroups.has(key)) hotelGroups.set(key, []);
    hotelGroups.get(key).push(r);
  }
  for (const group of hotelGroups.values()) {
    const first = group[0];
    const data = {};
    let rates = null;
    let bad = false;
    let firstBad = false;
    for (const r of group) {
      const c = r.cells;
      try {
        setIf(data, "email", data.email ?? (str(c.email) || undefined));
        setIf(data, "phone", data.phone ?? (str(c.phone) || undefined));
        setIf(data, "state", data.state ?? (str(c.state) || undefined));
        setIf(data, "category", data.category ?? parseStars(pick(c, "star_rating", "stars", "category")));
        const fromJson = jsonRates(c);
        const rate = fromJson ? null : rateOf(c);
        if (fromJson) rates = [...(rates || []), ...fromJson];
        if (rate) rates = [...(rates || []), rate];
      } catch (e) {
        if (!(e instanceof RowError)) throw e;
        skip(r, e.message);
        bad = true;
        if (r === first) firstBad = true;
      }
    }
    // A hotel is written whole or not at all: replacing its rates with only the
    // rows that parsed would silently drop the rest.
    if (bad) {
      if (!firstBad) skip(first, `Hotel not changed until the errors in its other rows are fixed`);
      continue;
    }
    const existing = hotelIndex.get(hotelKey(first.cells.name, first.cells.city));
    if (rates) {
      // Keep any extra fields an existing rate row had (synced metadata etc.).
      const old = new Map((Array.isArray(existing?.priceSections) ? existing.priceSections : []).filter((s) => s && typeof s === "object").map((s) => [rateKey(s), s]));
      data.priceSections = rates.map((s) => ({ ...(old.get(rateKey(s)) || {}), ...s }));
    }
    if (existing) {
      if (Object.keys(data).length) await prisma.hotel.update({ where: { id: existing.id }, data });
      updated.hotels++;
    } else if (await canCreate(first, "hotel")) {
      const h = await prisma.hotel.create({
        data: { name: str(first.cells.name), city: str(first.cells.city) || null, priceSections: [], ...data, userId: adminId },
      });
      hotelIndex.set(hotelKey(h.name, h.city), h);
      created.hotels++;
    }
  }

  for (const r of rows.filter((x) => x.kind === "vehicle")) {
    const c = r.cells;
    const name = str(c.name);
    if (!name) {
      skip(r, "Name is empty");
      continue;
    }
    const data = {};
    try {
      setIf(data, "email", str(c.email) || undefined);
      setIf(data, "phone", str(c.phone) || undefined);
      setIf(data, "city", str(c.city) || undefined);
      setIf(data, "state", str(c.state) || undefined);
      setIf(data, "price", parseNumber(pick(c, "cab_price", "price_inr", "price"), "Cab Price"));
      const seats = parseNumber(pick(c, "seats", "seating_capacity"), "Seats");
      if (seats !== undefined) data.seatingCapacity = Math.round(seats);
      setIf(data, "vehicleType", parseVehicleType(c.vehicle_type));
    } catch (e) {
      if (!(e instanceof RowError)) throw e;
      skip(r, e.message);
      continue;
    }
    const existing = vehicleIndex.get(lower(name));
    if (existing) {
      if (Object.keys(data).length) await prisma.vehicle.update({ where: { id: existing.id }, data });
      updated.cabs++;
    } else if (await canCreate(r, "vehicle")) {
      const v = await prisma.vehicle.create({ data: { name, ...data, userId: adminId } });
      vehicleIndex.set(lower(name), v);
      created.cabs++;
    }
  }

  for (const r of rows.filter((x) => x.kind === "destination")) {
    const c = r.cells;
    const name = str(c.name);
    if (!name) {
      skip(r, "Name is empty");
      continue;
    }
    const existing = destIndex.get(lower(name));
    const data = {};
    setIf(data, "state", str(c.state) || undefined);
    setIf(data, "city", str(c.city) || undefined);
    const acts = parseActivities(c.activities);
    if (acts) {
      // Keep whatever else an existing activity carried (matched by name).
      const old = new Map((Array.isArray(existing?.activities) ? existing.activities : []).filter((a) => a && typeof a === "object" && a.name).map((a) => [lower(a.name), a]));
      data.activities = acts.map((a) => ({ ...(old.get(lower(a.name)) || {}), ...a }));
    }
    if (existing) {
      if (Object.keys(data).length) await prisma.destination.update({ where: { id: existing.id }, data });
      updated.destinations++;
    } else if (await canCreate(r, "destination")) {
      const d = await prisma.destination.create({ data: { name, activities: [], country: "India", ...data, userId: adminId } });
      destIndex.set(lower(name), d);
      created.destinations++;
    }
  }

  skipped.sort((a, b) => a.row - b.row);
  return { created, updated, skipped };
}

/** "3 hotels, 2 cabs, 1 destination" → summary sentence for the UI. */
export function importSummaryText({ created, updated, skipped }) {
  const part = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : null);
  const list = (o) => [part(o.hotels, "hotel", "hotels"), part(o.cabs, "cab", "cabs"), part(o.destinations, "destination", "destinations")].filter(Boolean).join(", ");
  const bits = [];
  if (list(created)) bits.push(`Added ${list(created)}`);
  if (list(updated)) bits.push(`updated ${list(updated)}`);
  let text = bits.length ? bits.join("; ") + "." : "Nothing was imported.";
  if (skipped.length) text += ` ${skipped.length} row${skipped.length === 1 ? "" : "s"} skipped.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Export + sample (same one-table layout) ─────────────────────────────────
const blankRow = () => Object.fromEntries(CATALOG_COLUMNS.map((c) => [c, ""]));
const num0 = (v) => (v == null || v === "" ? "" : Number(v));

function hotelRows(h) {
  const base = { ...blankRow(), Type: "Hotel", Name: h.name, City: h.city || "", State: h.state || "", Email: h.email || "", Phone: h.phone || "", "Star Rating": h.category || "" };
  const sections = (Array.isArray(h.priceSections) ? h.priceSections : []).filter((s) => s && typeof s === "object");
  if (!sections.length) return [base];
  return sections.map((s) => ({
    ...base,
    "Room Type": titleCase(s.room_type),
    "Meal Plan": MEAL_PLAN_LABEL[s.meal_plan] || s.meal_plan || "",
    "Room Price": num0(s.price),
    "Child No Bed (CNB)": num0(s.cnb),
    "Child 5-12 Bed": num0(s.upto_5),
    "Child 12+ Bed": num0(s.above_12),
    "Extra Adult Bed": num0(s.extra_adult),
    "Season From": s.valid_from ? String(s.valid_from).slice(0, 10) : "",
    "Season To": s.valid_to ? String(s.valid_to).slice(0, 10) : "",
  }));
}

const VEHICLE_TYPE_LABEL = { sedan: "Sedan", suv: "SUV", hatchback: "Hatchback", tempo_traveller: "Tempo Traveller", mini_bus: "Mini Bus", luxury_bus: "Luxury Bus", other: "Other" };

function vehicleRow(v) {
  return { ...blankRow(), Type: "Transport", Name: v.name, City: v.city || "", State: v.state || "", Email: v.email || "", Phone: v.phone || "", Seats: v.seatingCapacity ?? "", "Vehicle Type": VEHICLE_TYPE_LABEL[v.vehicleType] || "", "Cab Price": num0(v.price) };
}

function destinationRow(d) {
  return { ...blankRow(), Type: "Destination", Name: d.name, City: d.city || "", State: d.state || "", Activities: formatActivities(d.activities) };
}

/** Rows → CSV text with a BOM, so Excel opens ₹ and accents correctly. */
export function toCsv(rows) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: CATALOG_COLUMNS });
  return "﻿" + XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
}

export async function exportCatalogCsv(adminId) {
  const [vehicles, hotels, destinations] = await Promise.all([
    prisma.vehicle.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
    prisma.hotel.findMany({ where: { userId: adminId }, orderBy: [{ city: "asc" }, { name: "asc" }] }),
    prisma.destination.findMany({ where: { userId: adminId }, orderBy: { name: "asc" } }),
  ]);
  return toCsv([...hotels.flatMap(hotelRows), ...vehicles.map(vehicleRow), ...destinations.map(destinationRow)]);
}

/** The sample file: a few filled-in example rows of each Type. */
export function templateCsv() {
  const hotel = { name: "Example Lake View Hotel", city: "Srinagar", state: "Jammu & Kashmir", email: "reservations@example.com", phone: "9876543210", category: "4" };
  const rows = [
    ...hotelRows({ ...hotel, priceSections: [
      { room_type: "deluxe", meal_plan: "breakfast_dinner", price: 6500, cnb: 800, upto_5: 1500, above_12: 2000, extra_adult: 2500, valid_from: "2026-04-01", valid_to: "2026-06-30" },
      { room_type: "deluxe", meal_plan: "breakfast_only", price: 5500, cnb: 600, upto_5: 1200, above_12: 1600, extra_adult: 2000, valid_from: "2026-04-01", valid_to: "2026-06-30" },
      { room_type: "super_deluxe", meal_plan: "breakfast_dinner", price: 8000, cnb: 800, upto_5: 1800, above_12: 2400, extra_adult: 3000 },
    ] }),
    ...hotelRows({ name: "Example Meadow Resort", city: "Gulmarg", state: "Jammu & Kashmir", email: "stay@example.com", phone: "9876543211", category: "3", priceSections: [
      { room_type: "deluxe", meal_plan: "all_meals", price: 7200, cnb: 900, upto_5: 1600, above_12: 2200, extra_adult: 2600 },
    ] }),
    vehicleRow({ name: "Example Innova Crysta", city: "Srinagar", state: "Jammu & Kashmir", email: "cabs@example.com", phone: "9876543212", seatingCapacity: 6, vehicleType: "suv", price: 3800 }),
    vehicleRow({ name: "Example Dzire", city: "Srinagar", state: "Jammu & Kashmir", phone: "9876543213", seatingCapacity: 4, vehicleType: "sedan", price: 2500 }),
    vehicleRow({ name: "Example Tempo Traveller 12 Seater", city: "Srinagar", state: "Jammu & Kashmir", seatingCapacity: 12, vehicleType: "tempo_traveller", price: 5500 }),
    destinationRow({ name: "Gulmarg", state: "Jammu & Kashmir", activities: [{ name: "Gondola Phase 1", cost: 900 }, { name: "Gondola Phase 2", cost: 1100 }, { name: "Snow Bike Ride", cost: 1500 }] }),
    destinationRow({ name: "Pahalgam", state: "Jammu & Kashmir", activities: [{ name: "Pony Ride to Baisaran", cost: 1200 }, { name: "Aru Valley", cost: 0 }] }),
  ];
  return toCsv(rows);
}
