// What Ching DOES for the assistant requests that reach past the open trip
// (utils/ching/assistant.js understands them; ChingWidget calls this):
// memory (remember / recall / forget), documents for any trip (invoice,
// payment receipt, confirmation, vouchers, itinerary PDF, Excel), supplier
// confirmation requests, drivers, operations questions and trip searches.
//
// ctx = { token, navigate, respond(text, extra?), confirm(question, run), editor, init, core }
import {
  fetchTrips,
  downloadInvoicePdf,
  downloadPaymentVoucherPdf,
  downloadConfirmationPdf,
  downloadTripPdf,
  downloadQuotationExcel,
  sendConfirmationEmail,
  emailItineraryToMe,
  sendProposal,
} from "../../api/trips";
import {
  fetchOperations,
  requestSupplierConfirmations,
  updateBooking,
  downloadVouchersPdf,
} from "../../api/operations";
import { rememberChing, forgetChing, saveHotelTags, savePlaceTags } from "../../api/ching";
import { suggestPlaces, whereReply, pickPlaces, placeTags as tagsOfPlace } from "../../utils/ching/whereTo";
import { logMiss } from "../../utils/ching/insightLog";
import { stayOptions, optionsLine } from "../../utils/ching/stayOptions";
import { matchHotel as meets, tagLabel } from "../../utils/ching/meaning";
import { clearChingConversation as forgetConversation } from "../../utils/ching/chingBus";
import { fetchAccountingTripLedger, createAccountingSettlement } from "../../api/accounting";
import { updateTrip, sendReminder } from "../../api/trips";
import { loadChingMemory, getChingMemory } from "../../utils/ching/memoryStore";
import { cheaperReply, addOnReply } from "../../utils/ching/optimize";
import { searchHotelInventory } from "../../api/hotels";
import { describeCriteria, mealSay } from "../../utils/ching/hotelQuery";
import { placeKey, samePlace } from "../../utils/ching/places";

const list = (v) => (Array.isArray(v) ? v : []);
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const and = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const pad = (n) => String(n).padStart(2, "0");
const localYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const isTripId = (q) => /^trp\d{4,}$/i.test(String(q || "").replace(/[\s-]/g, ""));

/**
 * The trip a request is about: a spoken name / id, else the trip open in the builder.
 * → the trip, null (nothing found — the caller says so) or false (several trips
 * match and Ching already asked which one; the caller just stops). The search
 * is a loose substring match, so acting on its first hit could email the wrong
 * "Rahul": a name is only taken when exactly one trip's client fits it.
 */
async function resolveTrip(ctx, query) {
  if (!query) {
    const id = ctx.editor?.tripId;
    if (!id) return null;
    // The list row carries client_phone / email too (WhatsApp needs the phone).
    const res = await fetchTrips(ctx.token, { search: id, per_page: 5 }).catch(() => null);
    const row = list(res?.data).find((t) => t.trip_id === id);
    return row || { trip_id: id, client_name: ctx.editor?.summary?.()?.clientName || "", trip_title: ctx.editor?.summary?.()?.title || "" };
  }
  const res = await fetchTrips(ctx.token, { search: query, per_page: 10 });
  const rows = list(res?.data);
  if (isTripId(query)) {
    const id = String(query).replace(/[\s-]/g, "").toUpperCase();
    return rows.find((t) => String(t.trip_id).toUpperCase() === id) || null;
  }
  const q = norm(query);
  const exact = rows.filter((t) => norm(t.client_name) === q);
  const byWord = rows.filter((t) => ` ${norm(t.client_name)} `.includes(` ${q} `));
  const candidates = exact.length ? exact : byWord.length ? byWord : rows;
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;
  // Same client, several trips: the one travelling soonest from today, else ask.
  const sameClient = new Set(candidates.map((t) => norm(t.client_name))).size === 1;
  const today = localYmd(new Date());
  const upcoming = candidates.filter((t) => String(t.start_date || "").slice(0, 10) >= today);
  if (sameClient && upcoming.length === 1) return upcoming[0];
  const shown = candidates.slice(0, 3).map((t) => `${t.client_name || "no name"} — ${t.trip_title || "untitled"} (${t.trip_id})`);
  ctx.respond(`I found ${plural(candidates.length, "trip")} for “${query}”: ${and(shown)}${candidates.length > 3 ? " and more" : ""}. Which one? Say the full name or the trip ID.`);
  return false;
}
const whose = (trip) => (trip.client_name ? `${first(trip.client_name)}'s` : `trip ${trip.trip_id}`);

const DOC_LABEL = {
  invoice: "invoice",
  receipt: "payment receipt",
  confirmation: "booking confirmation",
  vouchers: "vouchers",
  itinerary: "itinerary PDF",
  excel: "Excel quotation",
};

async function doDoc(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : `Whose ${DOC_LABEL[ask.doc]}? Say it like “${ask.action === "email" ? "email" : "download"} the ${DOC_LABEL[ask.doc]} for Rahul”.`);
    return;
  }
  const id = trip.trip_id;
  const label = DOC_LABEL[ask.doc];
  const download = async () => {
    const get = {
      invoice: () => downloadInvoicePdf(ctx.token, id),
      receipt: () => downloadPaymentVoucherPdf(ctx.token, id),
      confirmation: () => downloadConfirmationPdf(ctx.token, id),
      vouchers: () => downloadVouchersPdf(ctx.token, id),
      itinerary: () => downloadTripPdf(ctx.token, id),
      excel: () => downloadQuotationExcel(ctx.token, id),
    }[ask.doc];
    const name = { invoice: "Invoice", receipt: "Payment_Receipt", confirmation: "Confirmation", vouchers: "Vouchers", itinerary: "Itinerary", excel: "Quotation" }[ask.doc];
    saveBlob(await get(), `${id}_${name}.${ask.doc === "excel" ? "xlsx" : "pdf"}`);
  };

  if (ask.action === "download" || ask.doc === "excel" || (ask.toMe && ask.doc !== "itinerary")) {
    await download();
    ctx.respond(`Downloaded ${whose(trip)} ${label}.${ask.toMe && ask.action === "email" ? " I can only email the itinerary to you — this one's in your downloads." : ""}`);
    return;
  }
  if (ask.action === "whatsapp") {
    await download();
    const phone = String(trip.client_phone || "").replace(/\D/g, "");
    if (phone.length >= 10) {
      window.open(`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(`Hi ${first(trip.client_name)}, sharing your ${label} for ${trip.trip_title || id}.`)}`, "_blank");
    }
    ctx.respond(`Downloaded ${whose(trip)} ${label}${phone.length >= 10 ? " and opened WhatsApp — attach the file and hit send." : ". There's no client phone on the trip for WhatsApp."}`);
    return;
  }
  // email
  if (ask.doc === "itinerary" && ask.toMe) {
    const r = await emailItineraryToMe(ctx.token, id, {});
    ctx.respond(`Emailed ${whose(trip)} itinerary to ${r?.to || "you"}.`);
    return;
  }
  // Everything below emails the client, so it's confirmed first (with the trip
  // named, so a wrong match is caught before anything is sent).
  const client = trip.client_name || "the client";
  const tripName = trip.trip_title || id;
  if (ask.doc === "itinerary") {
    ctx.confirm(`Email ${client} the itinerary with the approval link for ${tripName}? Say yes or no.`, async () => {
      const r = await sendProposal(ctx.token, id, { send: "email" });
      ctx.respond(`Sent ${first(trip.client_name) || "the client"} the itinerary with the approval link${r?.sent_to ? ` at ${r.sent_to}` : ""}.`);
    });
    return;
  }
  const recipient = { invoice: "invoice", receipt: "payment_voucher", vouchers: "vouchers", confirmation: "client" }[ask.doc];
  const question =
    ask.doc === "confirmation"
      ? `Email ${client} the booking confirmation for ${tripName}? That also marks the trip confirmed. Say yes or no.`
      : `Email ${client} the ${label} for ${tripName}? Say yes or no.`;
  ctx.confirm(question, async () => {
    const r = await sendConfirmationEmail(ctx.token, id, recipient);
    ctx.respond(
      ask.doc === "confirmation"
        ? `Booking confirmation sent for ${whose(trip)} trip, and it's marked confirmed.`
        : `${r?.message || `Emailed ${whose(trip)} ${label}.`}`,
    );
  });
}

async function doSupplier(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : "Which trip? Say “send hotel requests for Rahul's trip”.");
    return;
  }
  const who = ask.kinds.length === 2 ? "hotels and cab suppliers" : ask.kinds[0] === "hotel" ? "hotels" : "cab suppliers";
  ctx.confirm(`Send confirmation requests to the ${who} on ${whose(trip)} trip (${trip.trip_title || trip.trip_id})? Say yes or no.`, async () => {
    const r = await requestSupplierConfirmations(ctx.token, trip.trip_id, { kinds: ask.kinds });
    const wa = list(r.requests).filter((x) => !x.emailed && x.whatsapp_url && !x.skipped);
    ctx.respond(`${whose(trip)} trip — ${r.message}${wa.length ? " The WhatsApp ones are on the trip's Logistics tab and in Daily Ops." : ""}`);
    window.dispatchEvent(new CustomEvent("ching:bookings-updated"));
  });
}

async function doDriver(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : "Which trip is the driver for? Say “the driver for Rahul's trip is Ramesh, 98765 43210”.");
    return;
  }
  await updateBooking(ctx.token, trip.trip_id, {
    kind: "cab",
    group: true,
    driver_name: ask.name,
    ...(ask.phone ? { driver_phone: ask.phone } : {}),
    ...(ask.vehicleNumber ? { vehicle_number: ask.vehicleNumber } : {}),
  });
  window.dispatchEvent(new CustomEvent("ching:bookings-updated"));
  ctx.respond(`${ask.name} is now the driver for ${whose(trip)} trip${ask.phone ? `, ${ask.phone}` : ""}${ask.vehicleNumber ? `, ${ask.vehicleNumber}` : ""}. ${ask.phone ? "" : "Tell me his phone number too when you have it."}`.trim());
}

async function doOps(ask, ctx) {
  const today = localYmd(new Date());
  const tomorrow = localYmd(new Date(Date.now() + 864e5));
  const from = ask.when === "tomorrow" ? tomorrow : today;
  const data = await fetchOperations(ctx.token, { from, days: ask.when === "week" ? 7 : 1 });
  const when = ask.when === "tomorrow" ? "tomorrow" : ask.when === "week" ? "this week" : "today";
  const days = list(data.days);
  const sum = (k) => days.reduce((n, d) => n + list(d[k]).length, 0);
  const names = (k) => [...new Set(days.flatMap((d) => list(d[k]).map((x) => first((x.trip || x).client_name))).filter(Boolean))];
  let reply;
  if (ask.focus === "unpaid") {
    const u = list(data.unpaid);
    const total = u.reduce((n, x) => n + Number(x.balance || 0), 0);
    reply = u.length
      ? `${plural(u.length, "trip")} in the next month still owe ${money(total)} — ${and(u.slice(0, 3).map((x) => `${first(x.trip.client_name)} ${money(x.balance)}`))}${u.length > 3 ? " and more" : ""}.`
      : "Everyone travelling in the next month has paid in full. Love to see it.";
  } else if (ask.focus === "confirmations") {
    const c = list(data.confirmations);
    const declined = c.filter((x) => x.status === "declined").length;
    const notAsked = c.filter((x) => !x.status).length;
    reply = c.length
      ? `${plural(c.length, "booking")} still waiting on suppliers${declined ? `, ${declined} declined` : ""}${notAsked ? `, ${notAsked} not requested yet` : ""}. First up: ${and(c.slice(0, 3).map((x) => `${x.name} for ${first(x.trip.client_name)}`))}. Say “send hotel requests for Rahul's trip” and I'll chase them.`
      : "Every hotel and cab for the next month is confirmed. Smooth sailing.";
  } else if (ask.focus === "drivers") {
    const none = days.flatMap((d) => list(d.cabs)).filter((c) => !c.driver_name);
    reply = none.length
      ? `${plural(none.length, "cab")} ${when} without a driver: ${and([...new Set(none.map((c) => first(c.trip.client_name)))].slice(0, 4))}.`
      : `Every cab ${when} has a driver.`;
  } else {
    const parts = [];
    const a = sum("arrivals");
    const d = sum("departures");
    const ci = sum("checkins");
    const cabs = days.flatMap((x) => list(x.cabs));
    if (ask.focus === "all" || ask.focus === "arrivals") parts.push(a ? `${plural(a, "arrival")} (${and(names("arrivals").slice(0, 4))})` : "no arrivals");
    if (ask.focus === "all" || ask.focus === "departures") parts.push(d ? `${plural(d, "departure")}` : "no departures");
    if (ask.focus === "all" || ask.focus === "checkins") parts.push(ci ? `${plural(ci, "hotel check-in")}` : "no check-ins");
    if (ask.focus === "all" || ask.focus === "cabs") {
      const noDriver = cabs.filter((c) => !c.driver_name).length;
      parts.push(cabs.length ? `${plural(cabs.length, "cab")}${noDriver ? `, ${noDriver} still without a driver` : ", all with drivers"}` : "no cabs");
    }
    const pending = list(data.confirmations).length;
    reply = `${when.charAt(0).toUpperCase() + when.slice(1)}: ${and(parts)}.${ask.focus === "all" && pending ? ` ${plural(pending, "booking")} still to be confirmed by suppliers.` : ""}`;
  }
  ctx.navigate("/operations");
  ctx.respond(reply);
}

async function doFind(ask, ctx) {
  const q = new URLSearchParams(Object.entries(ask.params).filter(([, v]) => v)).toString();
  ctx.navigate(`/my-trips${q ? `?${q}` : ""}`);
  try {
    const res = await fetchTrips(ctx.token, { ...ask.params, ...(ask.params.q ? { search: ask.params.q } : {}), per_page: 1 });
    const n = Number(res?.total) || 0;
    ctx.respond(n ? `Found ${plural(n, "trip")}${ask.label ? ` ${ask.label}` : ""}.` : `No trips${ask.label ? ` ${ask.label}` : ""}. Try a different name or month?`);
  } catch {
    ctx.respond(`Here are your trips${ask.label ? ` ${ask.label}` : ""}.`);
  }
}

// ── money / status / reminders (money and cancellations are confirmed first) ──
const METHOD_VALUE = { UPI: "upi", "Bank transfer": "bank_transfer", Card: "card", Cheque: "cheque", Cash: "cash" };

async function doPayment(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}. Check the name?` : "Whose payment? Say it like “Rahul paid 20000 by UPI”.");
    return;
  }
  const detail = await fetchAccountingTripLedger(ctx.token, trip.trip_id);
  const receivable = list(detail?.obligations).find((o) => o.direction === "receivable");
  if (!receivable) {
    ctx.respond(`${whose(trip)} trip has no amount due in accounts yet — save its price first.`);
    return;
  }
  const due = Number(receivable.expected_amount || 0) - Number(receivable.settled_amount || 0);
  if (ask.amount > due + 0.01) {
    ctx.respond(`${money(ask.amount)} is more than the ${money(due)} still due on ${whose(trip)} trip. Want to try a different amount?`);
    return;
  }
  ctx.confirm(
    `Record ${money(ask.amount)} from ${trip.client_name || trip.trip_id} by ${ask.method === "UPI" ? "UPI" : ask.method.toLowerCase()}${ask.methodSaid ? "" : " (say “by UPI” etc. if it wasn't cash)"} against ${trip.trip_title || trip.trip_id}? Say yes or no.`,
    async () => {
      await createAccountingSettlement(ctx.token, {
        obligation_id: receivable.id,
        amount: ask.amount,
        settlement_type: "receipt",
        settlement_date: localYmd(new Date()),
        method: METHOD_VALUE[ask.method] || "cash",
        notes: "Recorded by voice (Ching)",
      });
      const left = due - ask.amount;
      ctx.respond(`Recorded ${money(ask.amount)} from ${first(trip.client_name) || "the client"}. ${left > 0.5 ? `${money(left)} still due.` : "Fully paid now — nice!"}`);
    },
  );
}

async function doStatus(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : "Which trip? Say “mark Rahul's trip as confirmed”.");
    return;
  }
  const run = async () => {
    await updateTrip(ctx.token, trip.trip_id, { status: ask.status });
    ctx.respond(`${whose(trip)} trip is now ${ask.status}.`);
  };
  if (ask.status === "cancelled") ctx.confirm(`Cancel ${whose(trip)} trip (${trip.trip_title || trip.trip_id})? Say yes or no.`, run);
  else await run();
}

async function doRemind(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (trip === false) return;
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : "Who should I remind? Say “send a payment reminder to Rahul”.");
    return;
  }
  const kind = ask.kind === "payment" ? "payment" : "proposal";
  ctx.confirm(`Email ${trip.client_name || "the client"} a ${kind} reminder for ${trip.trip_title || trip.trip_id}? Say yes or no.`, async () => {
    const r = await sendReminder(ctx.token, trip.trip_id, ask.kind);
    ctx.respond(`Sent ${first(trip.client_name) || "the client"} a ${kind} reminder${r?.sent_to ? ` at ${r.sent_to}` : ""}.`);
  });
}

// ── Phase 4: cheaper plan / add-ons (on the open trip) ──
async function doOptimize(ctx) {
  const ed = ctx.editor;
  if (!ed?.optimize) {
    ctx.respond("Open a trip in the Trip Builder and I'll find you a cheaper version.");
    return;
  }
  const plan = ed.optimize();
  if (!plan.actions.length) {
    ctx.respond(cheaperReply(plan));
    return;
  }
  ctx.confirm(cheaperReply(plan), async () => {
    const r = ed.apply(plan.actions) || {};
    await new Promise((res) => setTimeout(res, 700)); // let the builder re-price
    const total = ed.summary?.()?.total;
    ctx.respond(`Done — ${plural(list(r.changes).length, "change")}.${total ? ` The total is now ${total}.` : ""} Say “undo” to go back.`);
  });
}

function doAddOns(ctx) {
  const ed = ctx.editor;
  if (!ed?.addOns) {
    ctx.respond("Open a trip and I'll suggest add-ons for its destinations.");
    return;
  }
  ctx.respond(addOnReply(ed.addOns()));
}

// ── hotel search ──────────────────────────────────────────────────────────
// "find a 4-star in Srinagar under 6000 with breakfast" lists matches from the
// agency's own hotels (rates for the trip's real nights, real availability);
// "use the cheapest available 4-star with breakfast" / "use X if available,
// otherwise the best under 7000" put one on the open trip (undoable);
// "use the first one" picks from the last list. Nothing is made up: no match
// is said as no match, with the closest miss named — never swapped in.
let lastHotels = null; // { results, city, at }
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (s) => {
  const [, m, d] = String(s || "").slice(0, 10).split("-").map(Number);
  return m ? `${d} ${MONTH[m - 1]}` : "";
};
/** "10–12 Nov", "30 Nov – 2 Dec". */
const span = (a, b) => {
  const [x, y] = [dm(a), dm(b)];
  const [dx, mx] = x.split(" ");
  const [dy, my] = y.split(" ");
  return mx === my ? `${dx}–${dy} ${my}` : `${x} – ${y}`;
};
const titleCase = (s) => String(s || "").replace(/\b[a-z]/g, (c) => c.toUpperCase());
const stars = (r) => (r.stars ? ` (${r.stars}★)` : "");
const hotelLine = (r, i) =>
  `${i + 1}. ${r.name}${stars(r)} — ${money(r.rate_per_night)}/night${r.meal_plan ? `, ${mealSay(r.meal_plan)}` : ""}${r.availability?.status === "blackout" ? " (blackout date)" : ""}`;

function catalogCity(words, init) {
  if (!words) return "";
  const cities = [...new Set(list(init?.hotels).map((h) => String(h.city || "").trim()).filter(Boolean))];
  const k = placeKey(words);
  return cities.find((c) => samePlace(c, words)) || cities.find((c) => k && placeKey(c) === k) || "";
}

/** The open trip's stay in that city (or its only stay when no city was said). */
function tripStay(ctx, city) {
  let c = null;
  try {
    c = ctx.editor?.getContext?.();
  } catch {
    c = null;
  }
  const stays = list(c?.stays).filter((x) => x.nights > 0);
  if (city) return { stay: stays.find((x) => samePlace(x.city, city)) || null, stays };
  return { stay: stays.length === 1 ? stays[0] : null, stays };
}

function putHotel(pick, stay, ctx, lead = "") {
  const res =
    ctx.editor.apply([
      { type: "REPLACE_HOTEL", stay: stay.index, hotelId: pick.id, hotelName: pick.name, city: pick.city, roomType: pick.room_type, mealPlan: pick.meal_plan },
    ]) || {};
  if (!list(res.changes).length) {
    ctx.respond(`${lead}${list(res.warnings)[0] || `${pick.name} is already on the trip.`}`);
    return;
  }
  try {
    ctx.editor.setTab("Logistics");
  } catch {
    // builder gone
  }
  const avail = pick.availability?.status === "blackout" ? " It's a blackout date — confirm with the hotel." : pick.availability?.free_rooms != null ? ` ${pick.availability.free_rooms} rooms free.` : "";
  ctx.respond(
    `${lead}${stay.city}: ${pick.name}${stars(pick)}, ${pick.room_type}${pick.meal_plan ? ` with ${mealSay(pick.meal_plan)}` : ""}, ${money(pick.rate_per_night)}/night.${avail} Say “undo” to switch back.`,
  );
}

async function doHotelSearch(ask, ctx) {
  const words = ask.cityWords;
  let city = catalogCity(words, ctx.init);
  // "Use Grand Mumtaz if available, …": the preferred hotel says where.
  if (!city && ask.criteria?.prefer) {
    const want = String(ask.criteria.prefer).toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !["hotel", "resort", "the"].includes(w));
    const h = list(ctx.init?.hotels).find((x) => want.length && want.every((w) => String(x.name || "").toLowerCase().includes(w)));
    if (h?.city) city = String(h.city).trim();
  }
  const { stay, stays } = tripStay(ctx, city);
  if (!city && stay) city = stay.city;
  if (words && !city) {
    ctx.respond(`I don't have any hotels in ${titleCase(words)} in your catalog.`);
    return;
  }
  if (!city) {
    ctx.respond(stays.length > 1 ? `Which city? This trip stays in ${and(stays.map((x) => x.city))}.` : "Which city? Say it like “find a 4-star hotel in Srinagar under 6000 with breakfast”.");
    return;
  }
  const c = ask.criteria || {};
  const r = await searchHotelInventory(ctx.token, {
    city,
    min_stars: c.minStars,
    max_stars: c.maxStars,
    max_rate: c.maxRate,
    min_rate: c.minRate,
    meal_plan: c.mealPlan,
    room_type: c.roomType,
    sort: c.sort,
    prefer: c.prefer,
    limit: 5,
    ...(stay
      ? { check_in: stay.checkIn, check_out: stay.checkOut, rooms: stay.rooms, exclude_trip: ctx.editor?.tripId || undefined }
      : ask.nights
        ? { nights: ask.nights }
        : {}),
  });
  const results = list(r?.results);
  lastHotels = { results, city, at: Date.now() };
  const what = describeCriteria(c);
  const when = stay ? ` for ${span(stay.checkIn, stay.checkOut)}` : "";
  const where = `in ${city}${when}${what ? ` (${what})` : ""}`;
  const near = r?.near ? ` The closest is ${r.near.name}${stars(r.near)} at ${money(r.near.rate_per_night)}/night.` : "";
  const nothing = `No hotel ${where} in your catalog.${near}`;

  if (ask.mode === "apply" && stay && ctx.editor) {
    const pref = r?.preferred;
    const lead = pref && !pref.usable ? `${titleCase(pref.name)} isn't possible — ${String(pref.why || "").replace(/^./, (x) => x.toLowerCase())}. ` : "";
    const pick = pref?.usable ? pref : results[0];
    if (!pick) {
      ctx.respond(`${lead}${nothing}`);
      return;
    }
    putHotel(pick, stay, ctx, lead ? `${lead}Using ${pick.name} instead. ` : "");
    return;
  }

  if (!results.length) {
    ctx.respond(nothing);
    return;
  }
  const count = r.total > results.length ? `${r.total} matches` : results.length === 1 ? "One match" : `${results.length} matches`;
  const tail = stay
    ? " Say “use the first one” to put it on the trip."
    : r?.check_in
      ? ""
      : " Rates are tonight's; open a trip with dates and I'll check availability too.";
  ctx.respond(`${count} ${where}: ${results.slice(0, 3).map(hotelLine).join("; ")}.${tail}`, {
    hotels: { results, canUse: !!stay, city },
  });
}

async function doHotelPick(ask, ctx) {
  const last = lastHotels;
  if (!last || Date.now() - last.at > 30 * 60 * 1000 || !last.results.length) {
    ctx.respond("Ask me to find hotels first — like “find a 4-star in Srinagar with breakfast”.");
    return;
  }
  const pick = ask.n === -1 ? last.results[last.results.length - 1] : last.results[ask.n - 1];
  if (!pick) {
    ctx.respond(`I only found ${plural(last.results.length, "hotel")}.`);
    return;
  }
  const { stay } = tripStay(ctx, last.city);
  if (!stay || !ctx.editor) {
    ctx.respond(`${pick.name} — open a trip that stays in ${last.city} and say it again, and I'll put it in.`);
    return;
  }
  putHotel(pick, stay, ctx);
}

// ── memory ────────────────────────────────────────────────────────────────
async function doRemember(ask, ctx) {
  if (ask.kind === "name") {
    await rememberChing(ctx.token, { kind: "name", key: "me", value: ask.value });
    await loadChingMemory(ctx.token, { force: true });
    ctx.respond(`Nice to meet you properly, ${ask.value}! I'll remember that.`);
    return;
  }
  if (ask.kind === "alias") {
    await rememberChing(ctx.token, { kind: "alias", key: ask.key, value: ask.value });
    await loadChingMemory(ctx.token, { force: true });
    ctx.respond(`Got it — when you say “${ask.key}”, I'll hear “${ask.value}”.`);
    return;
  }
  if (ask.kind === "hotel") {
    const core = await ctx.core();
    const hotel = core?.matchHotelName?.(ask.hotel, ask.city, ctx.init) || null;
    if (!hotel) {
      ctx.respond(`I couldn't find “${ask.hotel}” in your hotels${ask.city ? ` in ${ask.city}` : ""}. Check the name in Accommodation?`);
      return;
    }
    await rememberChing(ctx.token, { kind: "hotel", key: ask.city || hotel.city, value: String(hotel.id) });
    await loadChingMemory(ctx.token, { force: true });
    ctx.respond(`Noted: ${hotel.name} is your go-to in ${hotel.city || ask.city}. I'll pick it first next time.`);
    return;
  }
  await rememberChing(ctx.token, { kind: "note", key: "", value: ask.value });
  await loadChingMemory(ctx.token, { force: true });
  ctx.respond(`I'll remember that: “${ask.value}”.`);
}

// ── hotel tags: what a hotel is like, for Ching's meaning tree (utils/ching/meaning.js)
async function doTag(ask, ctx) {
  const core = await ctx.core();
  // A destination named ("tag Gulmarg as snow and skiing"): the place's own tags.
  const dest = list(ctx.init?.destinations).find((d) => samePlace(d.name, ask.hotel));
  if (dest && (list(ask.placeAdd).length || list(ask.placeRemove).length)) {
    const memory = getChingMemory() || {};
    const r = await savePlaceTags(ctx.token, { destination_id: dest.id, add: ask.placeAdd, remove: ask.placeRemove, base: tagsOfPlace(dest, memory.placeTags || null) });
    await loadChingMemory(ctx.token, { force: true });
    const now = list(r?.tags).map((t) => t.replace(/-/g, " "));
    ctx.respond(`${dest.name} is now tagged: ${and(now) || "nothing"}. I use these when a client asks where to go.`);
    return;
  }
  const hotel = core?.matchHotelName?.(ask.hotel, "", ctx.init) || null;
  if (hotel && !list(ask.add).length && !list(ask.remove).length) {
    ctx.respond(`Those are tags for a place, not a hotel. Hotel tags are things like riverside, quiet, family, lift. Try “tag ${hotel.name} as quiet”.`);
    return;
  }
  if (!hotel) {
    ctx.respond(`I couldn't find “${ask.hotel}” in your hotels. Check the name in Accommodation?`);
    return;
  }
  const r = await saveHotelTags(ctx.token, { hotel_id: hotel.id, add: ask.add, remove: ask.remove });
  await loadChingMemory(ctx.token, { force: true });
  const now = list(r?.tags).map((t) => tagLabel(t).toLowerCase());
  const did = ask.remove.length ? `Removed ${and(ask.remove.map((t) => tagLabel(t).toLowerCase()))} from ${hotel.name}.` : `Tagged ${hotel.name} as ${and(ask.add.map((t) => tagLabel(t).toLowerCase()))}.`;
  ctx.respond(`${did}${now.length ? ` It's now: ${and(now)}.` : " It has no tags now."}`);
}

async function doTagged(ask, ctx) {
  const memory = (await loadChingMemory(ctx.token)) || getChingMemory() || {};
  const hotels = list(ctx.init?.hotels).filter((h) => h.is_available !== false && (!ask.city || samePlace(String(h.city || "").split(",")[0], ask.city)));
  const what = and(ask.said);
  const where = ask.city ? ` in ${ask.city.replace(/\b[a-z]/g, (c) => c.toUpperCase())}` : "";
  if (!hotels.length) {
    ctx.respond(`I don't have any hotels${where} in your catalog.`);
    return;
  }
  const hits = hotels
    .map((h) => ({ h, m: meets(h, ask.wishes, memory.hotelTags || null) }))
    .filter((x) => x.m.score >= 1)
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 6);
  if (!hits.length) {
    ctx.respond(`No hotel${where} is tagged ${what} yet. Open one in Accommodation and tick its tags, or tell me: “tag Heevan Resort as riverside”.`);
    return;
  }
  const names = hits.map((x) => `${x.h.name}${ask.city ? "" : ` (${String(x.h.city || "").split(",")[0]})`}`);
  ctx.respond(`${plural(hits.length, "hotel")}${where} for ${what}: ${and(names)}.`);
}

// ── three hotels for a stay: the one on the trip, one that costs less, one step up (utils/ching/stayOptions.js)
function optionsForStay(stay, ctx) {
  const memory = getChingMemory() || {};
  const hotels = list(ctx.init?.hotels);
  let acc = null;
  try {
    acc = list(ctx.editor.snapshot().accommodations).find((a) => String(a.hotelId) === String(stay.hotelId) && samePlace(a.city, stay.city)) || null;
  } catch {
    acc = null;
  }
  const stars = /[1-7]/.exec(String(acc?.category || ""))?.[0] || null;
  return stayOptions(stay.city, hotels, { softStars: stars }, memory, { current: stay.hotelId, roomType: acc?.roomType || "", date: acc?.checkIn || stay.checkIn || "" });
}
async function doStayOptions(ask, ctx) {
  if (!ctx.editor) {
    ctx.respond("Open a trip first, then ask me for the hotel options at any of its stays.");
    return;
  }
  const city = ask.city ? catalogCity(ask.city, ctx.init) || ask.city : "";
  const { stay, stays } = tripStay(ctx, city);
  if (ask.city && !stay) {
    ctx.respond(stays.length ? `This trip doesn't stay in ${titleCase(ask.city)}. It stays in ${and(stays.map((x) => x.city))}.` : "This trip has no hotels yet.");
    return;
  }
  if (!stays.length) {
    ctx.respond("This trip has no hotels yet.");
    return;
  }
  // No town said on a trip with several: every stay when offering or clearing, else ask which.
  const targets = stay ? [stay] : ask.mode === "offer" || ask.mode === "clear" ? stays : null;
  if (!targets) {
    ctx.respond(`Which town? This trip stays in ${and(stays.map((x) => x.city))}.`);
    return;
  }
  if (ask.mode === "clear") {
    const res = ctx.editor.apply(targets.map((x) => ({ type: "SET_STAY_OPTIONS", stay: x.index, hotelIds: [] }))) || {};
    ctx.changed?.();
    ctx.respond(list(res.changes).length ? `${list(res.changes).join(". ")}.` : "No hotel choices were being offered there.");
    return;
  }
  if (ask.mode === "offer") {
    const actions = targets
      .map((x) => ({ x, opts: optionsForStay(x, ctx).filter((o) => String(o.id) !== String(x.hotelId)) }))
      .filter((y) => y.opts.length)
      .map((y) => ({ type: "SET_STAY_OPTIONS", stay: y.x.index, hotelIds: y.opts.map((o) => o.id) }));
    if (!actions.length) {
      ctx.respond("There is no other hotel to offer there: it is the only one in your catalog for that town.");
      return;
    }
    const res = ctx.editor.apply(actions) || {};
    ctx.changed?.();
    ctx.respond(list(res.changes).length ? `${list(res.changes).join(". ")}. Each choice shows its price difference on the itinerary. Say “undo” to take it back.` : "Those choices are already offered.");
    return;
  }
  const opts = optionsForStay(targets[0], ctx);
  if (opts.length < 2) {
    ctx.respond(`${targets[0].city}: ${opts[0]?.name || "that hotel"} is the only one in your catalog there.`);
    return;
  }
  // "use the second one" works on these too (doHotelPick reads lastHotels).
  lastHotels = { results: opts.map((o) => ({ id: o.id, name: o.name, city: o.city, stars: o.stars, rate_per_night: o.price })), city: targets[0].city, at: Date.now() };
  if (ask.mode === "pick") {
    const o = opts.find((x) => x.role === ask.role);
    if (!o) {
      ctx.respond(ask.role === "cheaper" ? `Nothing in ${targets[0].city} costs clearly less than ${opts[0].name}.` : `Nothing in ${targets[0].city} is a step up from ${opts[0].name} in your catalog.`);
      return;
    }
    const res = ctx.editor.apply([{ type: "REPLACE_HOTEL", stay: targets[0].index, hotelId: o.id, hotelName: o.name, city: o.city }]) || {};
    ctx.changed?.();
    ctx.respond(list(res.changes).length ? `${targets[0].city}: ${o.name} (${o.why}${o.delta ? `, ${o.delta}` : ""}). Say “undo” to switch back.` : list(res.warnings)[0] || `${o.name} is already on the trip.`);
    return;
  }
  ctx.respond(`${targets[0].city}: ${optionsLine(opts)}. Say “use the second one”, “the cheaper one”, or “offer all ${opts.length} to the client”.`);
}

// ── "where should they go?": the agency's own places, by what was wished (utils/ching/whereTo.js)
let lastPlaces = null; // { names, cover, text, at }
async function doWhere(ask, ctx) {
  const memory = (await loadChingMemory(ctx.token)) || getChingMemory() || {};
  const r = suggestPlaces(ask.wishes, { ...ctx.init, memory }, { tagMap: memory.placeTags || null });
  lastPlaces = r.places.length ? { names: r.places.map((p) => p.name), cover: r.cover?.places || null, text: ask.text, at: Date.now() } : null;
  // Asked for something no place is tagged for: a gap in the catalog's tags, worth seeing in the report.
  if (r.wishes.length && !r.places.length) logMiss("unmet", `a place for ${r.wishes.join(", ").toLowerCase()}`);
  ctx.respond(whereReply(r));
}

/** The place(s) picked from the last suggestions, said as a trip request Ching then plans. */
function pickedTrip(text) {
  const last = lastPlaces;
  if (!last || Date.now() - last.at > 30 * 60 * 1000) return null;
  const names = pickPlaces(text, last.names, last.cover);
  if (!names) return null;
  // What the client wanted goes along, so the hotels are picked for it too.
  const wanted = last.text.replace(/\b(?:where|which|what|should|can|could|do|shall|would|i|we|they|he|she|you|go|send|take|suggest|recommend|me|us|them|a|the|best|good|nice|place|places|destination|destinations|town|is|are|for|to|not sure|don'?t know)\b/g, " ").replace(/\s+/g, " ").trim();
  return `plan a trip to ${names.join(" and ")}${wanted ? `, ${wanted}` : ""}`;
}
async function doWherePick(ask, ctx) {
  const trip = pickedTrip(ask.text);
  if (!trip) {
    ctx.respond("Pick from what? Ask me first, like “where should they go for snow and shopping?”.");
    return;
  }
  lastPlaces = null;
  // Handed back to Ching as a request: it asks what is missing and plans it.
  window.dispatchEvent(new CustomEvent("ching:submit", { detail: { text: trip } }));
}

async function doClearConversation(ctx) {
  await forgetConversation(ctx.token);
  ctx.respond("Done, our conversation is cleared. What I've learned about your hotels and clients stays.");
}

async function doRecall(ctx) {
  const m = (await loadChingMemory(ctx.token, { force: true })) || getChingMemory() || {};
  const hotels = list(ctx.init?.hotels);
  const vehicles = list(ctx.init?.vehicles);
  const hotelName = (id) => hotels.find((h) => String(h.id) === String(id))?.name;
  const bits = [];
  if (m.callMe) bits.push(`You're ${m.callMe}.`);
  const favs = Object.entries(m.hotels || {})
    .map(([city, ids]) => [city, hotelName(ids?.[0])])
    .filter(([, n]) => n)
    .slice(0, 3);
  if (favs.length) bits.push(`Your usual hotels: ${and(favs.map(([city, n]) => `${n} in ${city.replace(/\b[a-z]/g, (c) => c.toUpperCase())}`))}.`);
  const cab = list(m.vehicles).sort((a, b) => b.n - a.n)[0];
  const cabName = cab && vehicles.find((v) => String(v.id) === String(cab.id))?.name;
  if (cabName) bits.push(`Usual cab: ${cabName}.`);
  if (m.mealPlan) bits.push(`Usual meals: ${m.mealPlan}.`);
  const aliases = Object.entries(m.aliases || {});
  if (aliases.length) bits.push(`You told me ${and(aliases.slice(0, 3).map(([k, v]) => `“${k}” means ${v}`))}.`);
  if (list(m.notes).length) bits.push(`Notes: ${and(list(m.notes).slice(0, 3).map((n) => `“${n.text}”`))}.`);
  if (list(m.clients).length) bits.push(`And I know ${plural(m.clients.length, "client")} from past trips.`);
  ctx.respond(
    bits.length
      ? `I've learned from ${plural(m.trips_learned_from || 0, "trip")}. ${bits.join(" ")}`
      : "Not much yet — save a few trips and I'll learn your favourite hotels, cabs and clients. Or say “remember …”.",
  );
}

async function doForget(ask, ctx) {
  if (ask.all && !ask.confirmed) {
    ctx.confirm("Forget everything you've told me — names, aliases, usual hotels and notes? Say yes or no.", () => doForget({ ...ask, confirmed: true }, ctx));
    return;
  }
  const r = await forgetChing(ctx.token, ask.all ? {} : { match: ask.match });
  await loadChingMemory(ctx.token, { force: true });
  const n = Number(r?.forgotten) || 0;
  ctx.respond(
    ask.all
      ? n
        ? `Done — I've forgotten everything you told me (${plural(n, "thing")}). What I learn from your trips stays, because it comes from the trips themselves.`
        : "There was nothing you'd told me to forget."
      : n
        ? `Forgotten: ${plural(n, "thing")} about “${ask.match}”.`
        : `I don't have anything about “${ask.match}”.`,
  );
}

/** → true when handled. Errors become a spoken apology, never a crash. */
export async function handleAssist(ask, ctx) {
  const handlers = {
    doc: () => doDoc(ask, ctx),
    supplier: () => doSupplier(ask, ctx),
    driver: () => doDriver(ask, ctx),
    ops: () => doOps(ask, ctx),
    "find-trips": () => doFind(ask, ctx),
    "stay-options": () => doStayOptions(ask, ctx),
    where: () => doWhere(ask, ctx),
    "where-pick": () => doWherePick(ask, ctx),
    tag: () => doTag(ask, ctx),
    tagged: () => doTagged(ask, ctx),
    "clear-conversation": () => doClearConversation(ctx),
    remember: () => doRemember(ask, ctx),
    recall: () => doRecall(ctx),
    forget: () => doForget(ask, ctx),
    payment: () => doPayment(ask, ctx),
    optimize: () => doOptimize(ctx),
    addons: () => doAddOns(ctx),
    status: () => doStatus(ask, ctx),
    remind: () => doRemind(ask, ctx),
    "hotel-search": () => doHotelSearch(ask, ctx),
    "hotel-pick": () => doHotelPick(ask, ctx),
  };
  const fn = handlers[ask?.type];
  if (!fn) return false;
  try {
    await fn();
  } catch (err) {
    ctx.respond(`Hmm, that didn't work: ${err?.message || "something went wrong"}.`);
  }
  return true;
}
