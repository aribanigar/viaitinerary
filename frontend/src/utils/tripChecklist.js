// What's still missing in a trip being built — shown live in the Trip Builder
// (pending badge + per-tab dots) and read out by Ching. Pure: takes the
// builder's own state shapes, returns items in tab order.
//
// item = { key, label, tab: "Trip Info" | "Itinerary" | "Logistics" | "Pricing",
//          level: "required" | "recommended" }

const pad = (n) => String(n).padStart(2, "0");
const toYmd = (v) => {
  if (!v) return "";
  const s = String(v);
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const short = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const blank = (v) => !String(v ?? "").trim();

/**
 * snapshot = { tripInfo, itinerary, accommodations, transportation, tripActivities }
 * options  = { packageMode } (packages have no client)
 * → array of missing items (empty = ready).
 */
export function tripChecklist(snapshot, { packageMode = false } = {}) {
  const s = snapshot || {};
  const info = s.tripInfo || {};
  const items = [];
  const add = (key, label, tab, level = "required") => items.push({ key, label, tab, level });

  // ── Trip Info
  if (packageMode) {
    if (blank(info.tripTitle)) add("title", "Package name", "Trip Info");
  } else {
    if (blank(info.clientName)) add("clientName", "Client name", "Trip Info");
    if (String(info.clientPhone || "").replace(/\D/g, "").length < 7) add("clientPhone", "Client phone", "Trip Info");
    if (blank(info.clientEmail)) add("clientEmail", "Client email", "Trip Info");
    if (blank(info.tripTitle)) add("title", "Trip title", "Trip Info", "recommended");
  }
  if (blank(info.destination)) add("destination", "Destination", "Trip Info", "recommended");
  const start = toYmd(info.startDate);
  if (!start) add("startDate", "Start date", "Trip Info");
  const nights = Number(info.duration) || 0;
  if (nights < 1) add("duration", "Trip length (nights)", "Trip Info");

  // ── Itinerary
  const days = (s.itinerary || []).slice().sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));
  if (!days.length) {
    add("days", "Day-wise plan", "Itinerary");
  } else {
    if (nights >= 1 && days.length < nights + 1) {
      add("dayCount", `Day plan has ${days.length} of ${nights + 1} days`, "Itinerary");
    }
    days.forEach((d, i) => {
      const n = Number(d.day) || i + 1;
      const lines = Array.isArray(d.activities) ? d.activities.filter((l) => String(l).trim()) : [];
      const last = i === days.length - 1;
      if (blank(String(d.title || "").replace(/^Day\s*\d+\s*:?\s*/i, ""))) add(`dayTitle${n}`, `Day ${n} title`, "Itinerary");
      else if (!last && !lines.length && blank(d.description)) {
        add(`dayPlan${n}`, `Day ${n} plan is empty`, "Itinerary", "recommended");
      }
    });
  }

  // ── Logistics: every night needs a hotel
  const stays = (s.accommodations || []).filter((a) => !a.cancelled && !a.cancelledAt);
  if (!stays.length) {
    add("hotels", "Hotels", "Logistics");
  } else {
    if (start && nights >= 1) {
      const covered = new Set();
      stays.forEach((a) => {
        const ci = toYmd(a.checkIn);
        const co = toYmd(a.checkOut);
        if (!ci || !co) return;
        for (let d = ci, guard = 0; d < co && guard < 366; d = addDays(d, 1), guard += 1) covered.add(d);
      });
      const gaps = [];
      for (let i = 0; i < nights; i += 1) {
        const d = addDays(start, i);
        if (!covered.has(d)) gaps.push(d);
      }
      if (gaps.length) {
        add("hotelGaps", `No hotel for ${gaps.length === 1 ? `the night of ${short(gaps[0])}` : `${gaps.length} nights (from ${short(gaps[0])})`}`, "Logistics");
      }
    }
    stays.forEach((a, i) => {
      if (!(Number(a.pricePerRoom) > 0)) add(`hotelRate${i}`, `${a.name || "A hotel"} has no room rate`, "Logistics");
      if (blank(a.mealPlan)) add(`meal${i}`, `Meal plan for ${a.name || "a hotel"}`, "Logistics", "recommended");
    });
  }
  const cabs = s.transportation || [];
  if (!cabs.length) add("cab", "Cab / transport", "Logistics", "recommended");
  else if (cabs.some((t) => !t.vehicleId)) add("cabVehicle", "A transport booking has no vehicle", "Logistics", "recommended");

  // ── Pricing
  if (!(Number(info.cost) > 0)) add("price", "Total price", "Pricing");

  return items;
}

/** Group counts per tab, for the tab dots. */
export const pendingByTab = (items) =>
  items.reduce((acc, it) => {
    acc[it.tab] = (acc[it.tab] || 0) + 1;
    return acc;
  }, {});
