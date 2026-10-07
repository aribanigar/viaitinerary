// The Trip Draft Ching shows after filling a new trip by voice, before
// anything is saved: what it understood (rows) and whether the trip holds
// together (checks). Pure — plain objects in, plain objects out — so the card,
// the spoken summary and the tests all read the same answer.
//
// A "blocking" check stops Confirm & Build: the trip itself doesn't add up
// (hotel nights ≠ trip nights, a city with no hotel, a gap in the hotel dates).
// Ching never fills such a gap on its own; the agent says what they want.
// A "save" check (phone / email) doesn't block building, but the builder
// can't save the trip until it's there. A "warn" check is worth a look.

import { dayQuestionText } from "./dayPlan.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

const list = (v) => (Array.isArray(v) ? v : []);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ymd = (s) => String(s || "").slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(ymd(s));
const utc = (s) => {
  const [y, m, d] = ymd(s).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const nightsBetween = (a, b) => (isDate(a) && isDate(b) ? Math.round((utc(b) - utc(a)) / DAY) : 0);
const addDays = (s, n) => {
  const d = new Date(utc(s) + n * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const cityKey = (c) => String(c || "").toLowerCase().split(",")[0].replace(/\bcity\b/g, "").replace(/\s+/g, " ").trim();

/** "10–14 Nov 2026", "29 Nov – 3 Dec 2026", "28 Dec 2026 – 2 Jan 2027". */
export function dateSpan(start, nights) {
  if (!isDate(start)) return "";
  const end = addDays(start, Math.max(0, nights));
  const [ay, am, ad] = ymd(start).split("-").map(Number);
  const [by, bm, bd] = end.split("-").map(Number);
  if (ay === by && am === bm) return ad === bd ? `${ad} ${MONTHS[am - 1]} ${ay}` : `${ad}–${bd} ${MONTHS[bm - 1]} ${by}`;
  if (ay === by) return `${ad} ${MONTHS[am - 1]} – ${bd} ${MONTHS[bm - 1]} ${by}`;
  return `${ad} ${MONTHS[am - 1]} ${ay} – ${bd} ${MONTHS[bm - 1]} ${by}`;
}

/** "4 Adults + 2 Children + 1 Infant". */
export function guestLine(ti) {
  const a = Number(ti?.adults) || 0;
  const c = Number(ti?.kids5to12) || 0;
  const i = Number(ti?.kidsUpto5) || 0;
  const parts = [`${a} Adult${a === 1 ? "" : "s"}`];
  if (c) parts.push(`${c} ${c === 1 ? "Child" : "Children"}`);
  if (i) parts.push(`${i} Infant${i === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

/**
 * snapshot = the Trip Builder state Ching filled (tripInfo, itinerary,
 * accommodations, transportation). meta = { suggestedCities, pickedHotels }:
 * the cities Ching planned and the hotels it picked itself (nobody said them),
 * shown as "suggested" so the agent confirms them knowingly.
 * → { rows, stays, checks, blocking, ok }
 */
export function buildTripDraft(snapshot, meta = {}) {
  const s = snapshot || {};
  const ti = s.tripInfo || {};
  const stays = list(s.accommodations).filter((a) => !a.cancelled);
  const days = list(s.itinerary);
  const cabs = list(s.transportation);
  const suggested = new Set(list(meta.suggestedCities).map(cityKey));
  const picked = new Set(list(meta.pickedHotels).map((h) => String(h).toLowerCase()));

  const nights = Number(ti.duration) || 0;
  const start = ymd(ti.startDate);

  // Consecutive nights in one city with one hotel read as one line.
  const grouped = [];
  stays
    .slice()
    .sort((a, b) => utc(a.checkIn) - utc(b.checkIn))
    .forEach((a) => {
      const n = nightsBetween(a.checkIn, a.checkOut);
      const last = grouped[grouped.length - 1];
      if (last && cityKey(last.city) === cityKey(a.city) && last.hotel === (a.name || "") && last.checkOut === ymd(a.checkIn)) {
        last.nights += n;
        last.checkOut = ymd(a.checkOut);
      } else {
        grouped.push({
          city: String(a.city || "").split(",")[0].trim() || "—",
          nights: n,
          hotel: a.name || "",
          hotelId: a.hotelId ?? null,
          checkIn: ymd(a.checkIn),
          checkOut: ymd(a.checkOut),
          rooms: Number(a.rooms) || 0,
          mealPlan: a.mealPlan || "",
          suggested: suggested.has(cityKey(a.city)),
          picked: picked.has(String(a.name || "").toLowerCase()),
        });
      }
    });
  // Cities planned on the day plan with no hotel row at all (no hotel in that
  // city in the catalog): still show them, so the gap is visible.
  const hotelNights = grouped.reduce((n, g) => n + g.nights, 0);

  const cabNames = [...new Set(cabs.map((c) => c.vehicleType || c.name || c.vehicleName || "").filter(Boolean))];
  const meal = grouped.find((g) => g.mealPlan)?.mealPlan || "";

  const rows = [
    ["Client", ti.clientName || ""],
    ["Guests", guestLine(ti)],
    ["Dates", nights ? dateSpan(start, nights) : ""],
    ["Duration", nights ? `${nights}N / ${nights + 1}D` : ""],
    ["Destination", ti.destination || ""],
    ...(cabNames.length ? [["Vehicle", `${cabNames.join(", ")} · ${plural(cabs.length, "day")}`]] : []),
    ...(meal ? [["Meals", meal]] : []),
  ];

  const checks = [];
  const add = (ok, level, text) => checks.push({ ok, level: ok ? "ok" : level, text });

  add(!!String(ti.clientName || "").trim(), "blocking", ti.clientName ? `Client: ${ti.clientName}` : "Client name is missing");
  add((Number(ti.adults) || 0) >= 1, "blocking", (Number(ti.adults) || 0) >= 1 ? `Guests: ${guestLine(ti)}` : "At least 1 adult is needed");
  add(isDate(start), "blocking", isDate(start) ? `Starts ${dateSpan(start, 0)}` : "Start date is missing");
  add(nights >= 1, "blocking", nights >= 1 ? `${nights + 1}-day / ${nights}-night duration` : "Number of nights is missing");

  if (nights >= 1) {
    const diff = nights - hotelNights;
    add(
      diff === 0,
      "blocking",
      diff === 0
        ? `Hotel nights = ${hotelNights}`
        : diff > 0
          ? `Hotel nights = ${hotelNights}, the trip needs ${nights} — say where the other ${plural(diff, "night")} should be`
          : `Hotel nights = ${hotelNights}, but the trip is only ${plural(nights, "night")} — ${plural(-diff, "night")} too many`,
    );
    const dayCount = days.length;
    add(dayCount === nights + 1, "blocking", dayCount === nights + 1 ? `Itinerary days = ${dayCount}` : `Itinerary has ${plural(dayCount, "day")}, the trip needs ${nights + 1}`);
  }

  const noHotel = grouped.filter((g) => !g.hotel);
  add(!noHotel.length && grouped.length > 0, "blocking", grouped.length === 0 ? "No hotels yet" : noHotel.length ? `No hotel picked in ${noHotel.map((g) => g.city).join(", ")}` : "Every night has a hotel");

  // Back to back from the start date: no gap, no overlap.
  let cursor = start;
  let gap = null;
  for (const g of grouped) {
    if (isDate(cursor) && g.checkIn !== cursor) {
      gap = g;
      break;
    }
    cursor = g.checkOut;
  }
  if (grouped.length) add(!gap, "blocking", gap ? `Hotel dates don't line up at ${gap.city} (check-in ${gap.checkIn})` : "No date gaps or overlaps");

  // Rooms: up to 3 people (adults + 5–12s) a room.
  const people = (Number(ti.adults) || 0) + (Number(ti.kids5to12) || 0);
  const tight = grouped.filter((g) => g.rooms && g.rooms * 3 < people);
  if (grouped.length) add(!tight.length, "warn", tight.length ? `${tight[0].rooms} room${tight[0].rooms === 1 ? "" : "s"} at ${tight[0].hotel} for ${people} guests — add rooms?` : "Rooms fit the guests");

  const noPlace = days.filter((d) => !String(d.location || d.destination || "").trim());
  if (days.length) add(!noPlace.length, "warn", noPlace.length ? `Day ${noPlace[0].day} has no destination` : "Every day has a destination");

  // Questions only the agent can answer (see dayPlan.js / parseCommand.js):
  // a bare "day 2 Gulmarg" — day trip or transfer? — and a hotel we couldn't
  // find. They block Confirm & Build until answered, so nothing is guessed.
  const answeredDays = new Set(list(meta.answeredDays).map(Number));
  list(meta.dayQuestions)
    .filter((q) => !answeredDays.has(Number(q.day)))
    .forEach((q) => add(false, "blocking", dayQuestionText(q)));
  list(meta.unmatchedHotels)
    .filter((u) => {
      // Answered once that city has a hotel the agent chose (not one Ching picked).
      if (meta.answeredHotels) return false;
      return !stays.some((a) => a.hotelId && u.city && cityKey(a.city) === cityKey(u.city) && !picked.has(String(a.name).toLowerCase()));
    })
    .forEach((u) => {
      const where = u.city ? ` in ${u.city}` : "";
      const guess = list(u.suggestions).length ? ` Did you mean ${list(u.suggestions).slice(0, 2).join(" or ")}?` : "";
      const say = u.city ? `"${u.city} hotel <name>"` : `"<city> hotel <name>"`;
      add(false, "blocking", `I heard the hotel "${u.heard}" but it isn't in your hotels${where}.${guess} Say ${say}.`);
    });

  const sug = grouped.filter((g) => g.suggested);
  if (sug.length) add(false, "warn", `Ching suggested ${sug.map((g) => `${g.city} (${plural(g.nights, "night")})`).join(", ")} — change it if that's not right`);

  // "+91" alone (the phone field's default) is no number.
  const phoneDigits = String(ti.clientPhone || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const contact = [phoneDigits.length < 7 ? "phone" : "", !String(ti.clientEmail || "").trim() ? "email" : ""].filter(Boolean);
  add(!contact.length, "save", contact.length ? `Add the client's ${contact.join(" and ")} to save the trip` : "Client contact details present");

  const blocking = checks.filter((c) => c.level === "blocking");
  return { rows, stays: grouped, checks, blocking, ok: blocking.length === 0 };
}

/** One short spoken sentence for the draft. */
export function draftSpeech(draft) {
  const get = (k) => draft.rows.find((r) => r[0] === k)?.[1] || "";
  const who = get("Client") || "the client";
  const route = draft.stays.map((g) => `${g.city} ${plural(g.nights, "night")}`).join(", ");
  const head = `Here's the draft for ${who}: ${get("Guests")}${get("Dates") ? `, ${get("Dates")}` : ""}${route ? `. ${route}` : ""}.`;
  if (!draft.ok) return `${head} Before I build it: ${draft.blocking[0].text}.`;
  return `${head} Say “confirm” to build it, or tell me what to change.`;
}
