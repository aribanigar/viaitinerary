// What Ching DOES for the assistant requests that reach past the open trip
// (utils/ching/assistant.js understands them; ChingWidget calls this):
// memory (remember / recall / forget), documents for any trip (invoice,
// payment receipt, confirmation, vouchers, itinerary PDF, Excel), supplier
// confirmation requests, drivers, operations questions and trip searches.
//
// ctx = { token, navigate, respond(text, extra?), editor, init, core }
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
import { rememberChing, forgetChing } from "../../api/ching";
import { loadChingMemory, getChingMemory } from "../../utils/ching/memoryStore";

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

/** The trip a request is about: a spoken name / id, else the trip open in the builder. */
async function resolveTrip(ctx, query) {
  if (!query) {
    const id = ctx.editor?.tripId;
    if (id) return { trip_id: id, client_name: ctx.editor?.summary?.()?.clientName || "", trip_title: ctx.editor?.summary?.()?.title || "" };
    return null;
  }
  const res = await fetchTrips(ctx.token, { search: query, per_page: 5 });
  return list(res?.data)[0] || null;
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
  if (ask.doc === "itinerary") {
    if (ask.toMe) {
      const r = await emailItineraryToMe(ctx.token, id, {});
      ctx.respond(`Emailed ${whose(trip)} itinerary to ${r?.to || "you"}.`);
    } else {
      const r = await sendProposal(ctx.token, id, { send: "email" });
      ctx.respond(`Sent ${first(trip.client_name) || "the client"} the itinerary with the approval link${r?.sent_to ? ` at ${r.sent_to}` : ""}.`);
    }
    return;
  }
  const recipient = { invoice: "invoice", receipt: "payment_voucher", vouchers: "vouchers", confirmation: "client" }[ask.doc];
  const r = await sendConfirmationEmail(ctx.token, id, recipient);
  ctx.respond(
    ask.doc === "confirmation"
      ? `Booking confirmation sent for ${whose(trip)} trip, and it's marked confirmed.`
      : `${r?.message || `Emailed ${whose(trip)} ${label}.`}`,
  );
}

async function doSupplier(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
  if (!trip) {
    ctx.respond(ask.query ? `I couldn't find a trip for ${ask.query}.` : "Which trip? Say “send hotel requests for Rahul's trip”.");
    return;
  }
  const r = await requestSupplierConfirmations(ctx.token, trip.trip_id, { kinds: ask.kinds });
  const wa = list(r.requests).filter((x) => !x.emailed && x.whatsapp_url && !x.skipped);
  ctx.respond(`${whose(trip)} trip — ${r.message}${wa.length ? " The WhatsApp ones are on the trip's Logistics tab and in Daily Ops." : ""}`);
  window.dispatchEvent(new CustomEvent("ching:bookings-updated"));
}

async function doDriver(ask, ctx) {
  const trip = await resolveTrip(ctx, ask.query);
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
    remember: () => doRemember(ask, ctx),
    recall: () => doRecall(ctx),
    forget: () => doForget(ask, ctx),
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
