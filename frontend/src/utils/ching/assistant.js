// Ching as an assistant (not just a trip builder): moving around the app,
// small talk, and the replies Ching speaks back. Pure — no React, no network;
// the widget acts on what `understandAssistant` returns.

const clean = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/^\s*(?:(?:hello|hey|hi|ok|okay|oye)\s+)?(?:ching|chin|jing)\b[\s,.!:-]*/i, "")
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Pages Ching can open: [route, label, keyword patterns]. Order matters: more
// specific first ("hotel calendar" before "hotels", "accounting summary" before "accounting").
const PAGES = [
  ["/operations", "today's operations", /\b(?:daily )?op(?:eration)?s(?: board| desk)?\b|\bdaily ops\b|\bschedule\b|\bdrivers?\b|\bsupplier confirmations?\b/],
  ["/accommodation/calendar", "the hotel calendar", /\bhotel (?:booking )?calendar|availability calendar|room calendar\b/],
  ["/accounting-summary", "the accounting summary", /\b(?:accounting|accounts|profit|p ?and ?l|p&l) summary\b|\bprofit and loss\b|\bprofits?\b/],
  ["/ledger", "the ledger", /\bledgers?\b|\bkhata\b|\bbahi\b/],
  ["/accounting", "accounting", /\baccounting\b|\baccounts\b|\bpayables?\b|\breceivables?\b/],
  ["/trip-builder/generate", "the itinerary generator", /\b(?:itinerary|trip) generator\b|\bauto[- ]?generate\b/],
  ["/trip-builder", "a new trip", /\bnew (?:trip|itinerary)\b|\btrip builder\b|\bcreate (?:a )?trip\b/],
  ["/my-trips", "your trips", /\b(?:my )?trips\b|\bitineraries\b|\bbookings\b|\ball trips\b/],
  ["/package-builder", "the package builder", /\bpackage builder\b|\bnew package\b/],
  ["/packages", "packages", /\bpackages?\b|\btemplates?\b/],
  ["/quotes", "quotes", /\bquotes?\b|\bquotations?\b/],
  ["/lead-inquiries", "lead inquiries", /\bleads?\b|\binquir(?:y|ies)\b|\benquir(?:y|ies)\b/],
  ["/public-leads", "public leads", /\bpublic leads?\b/],
  ["/notifications", "notifications", /\bnotifications?\b|\balerts?\b/],
  ["/team-report", "team reports", /\bteam reports?\b|\bteam performance\b|\bsales report\b/],
  ["/team", "your team", /\bteam\b|\bstaff\b|\bemployees?\b/],
  ["/accommodation", "hotels", /\bhotels?\b|\baccommodations?\b|\bstays\b/],
  ["/transportation", "transport", /\btransport(?:ation)?\b|\bvehicles?\b|\bcabs?\b|\bcars?\b|\bfleet\b/],
  ["/destinations", "destinations", /\bdestinations?\b|\bplaces\b/],
  ["/activities", "activities", /\bactivit(?:y|ies)\b/],
  ["/complementary-services", "complementary services", /\bcomplementary\b|\badd[- ]?ons?\b|\bextras\b/],
  ["/policies", "policies", /\bpolic(?:y|ies)\b|\bterms\b|\bcancellation policy\b/],
  ["/payment-details", "bank details", /\bbank details\b|\bpayment details\b|\bbank account\b/],
  ["/accounting", "the voucher desk", /\bvoucher desk\b|\bvouchers?\b/],
  ["/confirmation-email", "confirmation emails", /\bconfirmation emails?\b|\bemail templates?\b/],
  ["/subscription", "your subscription", /\bsubscription\b|\bplan\b|\bbilling\b|\bupgrade\b/],
  ["/integrations", "integrations", /\bintegrations?\b/],
  ["/profile", "your profile", /\bprofile\b|\bmy account\b|\bpassword\b/],
  ["/settings", "settings", /\bsettings?\b|\bbranding\b|\bpreferences\b|\bsmtp\b|\brazorpay\b/],
  ["/assistant", "the assistant", /\bassistant\b/],
  ["/dashboard", "the dashboard", /\bdashboard\b|\bhome\b|\bmain (?:page|screen)\b|\bpipeline\b/],
];

const TABS = [
  ["Trip Info", /\btrip info\b|\bclient (?:details|info)\b|\bbasic (?:details|info)\b/],
  ["Itinerary", /\bitinerary tab\b|\bday[- ]wise\b|\bday plan\b|\bdays tab\b/],
  ["Logistics", /\blogistics\b|\bhotels? tab\b|\bcabs? tab\b/],
  ["Pricing", /\bpricing\b|\bprice tab\b|\bcosting\b|\bpayments? tab\b/],
  ["Template", /\btemplates? tab\b|\bdesign tab\b/],
];

const NAV_VERB = /^(?:please |can you |could you |kindly )?(?:open|go to|goto|take me to|show(?: me)?|navigate to|jump to|switch to|bring up|launch|load|visit|kholo|khol do|dikhao)\b(?: (?:up|the|my|our|me))*\s*/;

/**
 * What the agent asked Ching for, beyond building/editing a trip:
 *   { type: "navigate", path, label }        "open the ledger"
 *   { type: "tab", tab }                     "go to logistics" (inside the builder)
 *   { type: "open-trip", query }             "open trip TRP123456", "open Rahul's trip"
 *   { type: "find-trips", params, label }    "find unpaid trips to Gulmarg in October"
 *   { type: "doc", doc, action, query, toMe } "email the invoice to Rahul", "download Rahul's vouchers"
 *   { type: "supplier", kinds, query }       "send hotel requests for Rahul's trip"
 *   { type: "driver", name, phone, vehicleNumber, query } "driver for Rahul's trip is Ramesh 98765 43210"
 *   { type: "payment", amount, method, query } "Rahul paid 20000 by UPI" (Ching asks to confirm first)
 *   { type: "status", status, query }        "mark Rahul's trip as confirmed"
 *   { type: "remind", kind, query }          "send a payment reminder to Rahul"
 *   { type: "ops", when, focus }             "today's arrivals", "who hasn't paid", "pending confirmations"
 *   { type: "remember", kind, … }            "call me Arif", "when I say Heaven I mean Heevan", "remember …"
 *   { type: "recall" } / { type: "forget", all | match }
 *   { type: "back" }                         "go back"
 *   { type: "pending" }                      "what's pending?"
 *   { type: "total" }                        "what's the total?"
 *   { type: "voice", on }                    "stop talking" / "talk to me"
 *   { type: "smalltalk", reply }             "how are you", "tell me a joke"…
 *   null                                     anything else (trip building / editing)
 */
export function understandAssistant(text, { inBuilder = false } = {}) {
  const t = clean(text);
  if (!t) return null;
  const words = t.split(" ").length;

  const memory = understandMemory(t, inBuilder);
  if (memory) return memory;

  if (/^(?:go |take me )?back$|^previous page$/.test(t)) return { type: "back" };
  if (/\b(?:what(?:'s| is)?|anything|which (?:fields?|sections?)|kya)\b.*\b(?:pending|missing|left|remaining|baki|baaki)\b|\bwhat else (?:do i need|is needed)\b|\bis (?:it|the trip) (?:ready|complete)\b/.test(t)) {
    return { type: "pending" };
  }
  if (/\b(?:what(?:'s| is)|tell me|how much is)\b.*\b(?:total|price|cost|quote)\b/.test(t) && words <= 9) return { type: "total" };

  const pay = understandPayment(t);
  if (pay) return pay;
  const status = understandStatus(t);
  if (status) return status;
  const remind = understandRemind(t);
  if (remind) return remind;
  const ops = understandOps(t);
  if (ops) return ops;
  const supplier = understandSupplier(t);
  if (supplier) return supplier;
  const driver = understandDriver(t);
  if (driver) return driver;
  const doc = understandDoc(t, { inBuilder });
  if (doc) return doc;
  const find = understandFindTrips(t);
  if (find) return find;
  if (/\b(?:stop|don't|do not|no more) (?:talking|speaking|replying)\b|\b(?:mute|be quiet|quiet please|shut up|silent mode)\b/.test(t)) return { type: "voice", on: false };
  if (/\b(?:talk|speak|reply) (?:to me|back|again)\b|\bunmute\b|\bvoice (?:on|replies on)\b/.test(t)) return { type: "voice", on: true };

  // "open trip TRP123456" / "open rahul's trip" / "open the trip for rahul sharma"
  const tripId = /\btrp\s?-?\s?(\d{4,})\b/.exec(t);
  if (tripId && (NAV_VERB.test(t) || words <= 4)) return { type: "open-trip", query: `TRP${tripId[1]}` };
  const named =
    /^(?:open|show(?: me)?|pull up|load|find)\s+(?:the\s+)?([a-z]+(?: [a-z]+)?)'s\s+(?:trip|itinerary|booking|quote)\b/.exec(t) ||
    /^(?:open|show(?: me)?|pull up|load|find)\s+(?:the\s+)?(?:trip|itinerary|booking|quote)\s+(?:of|for)\s+([a-z]+(?: [a-z]+)?)$/.exec(t);
  if (named && !/^(?:new|a|this|my)$/.test(named[1])) return { type: "open-trip", query: named[1] };

  // Navigation needs a navigation verb and a short sentence, so "show me a
  // 3 night trip for Rahul…" stays a trip request.
  if (NAV_VERB.test(t) && words <= 8) {
    const rest = t.replace(NAV_VERB, "");
    if (inBuilder) {
      const tab = TABS.find(([, re]) => re.test(rest));
      if (tab) return { type: "tab", tab: tab[0] };
    }
    const page = PAGES.find(([, , re]) => re.test(rest));
    if (page) return { type: "navigate", path: page[0], label: page[1] };
    if (inBuilder && /^(?:itinerary|template)$/.test(rest)) return { type: "tab", tab: rest[0].toUpperCase() + rest.slice(1) };
  }

  const reply = smallTalk(t);
  if (reply) return { type: "smalltalk", reply };
  return null;
}


// ── memory: "call me…", "when I say X I mean Y", "my usual hotel in Gulmarg is…", "remember…", "forget…"
const title = (x) => String(x || "").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
function understandMemory(t, inBuilder = false) {
  let m;
  if (/\bwhat do you (?:remember|know)\b|\bwhat have you learn(?:ed|t)\b|\b(?:show|tell)(?: me)? (?:your |what's in your )?memory\b/.test(t)) return { type: "recall" };
  if ((m = /^(?:please )?forget (?:about )?(everything|all|it all|all of it|everything i (?:told|taught) you)$/.exec(t))) return { type: "forget", all: true };
  // In the builder a bare "forget the gondola" is a trip edit; memory needs "forget about / that …".
  if ((m = (inBuilder ? /^(?:please )?forget (?:about|that|what i said about)\s+(.{2,60})$/ : /^(?:please )?forget (?:about |that )?(.{2,60})$/).exec(t))) {
    return { type: "forget", match: m[1].replace(/^(?:the |my )/, "") };
  }
  if ((m = /^(?:please )?(?:call me|you can call me|my name is|i am called)\s+([a-z][a-z .']{1,40})$/.exec(t))) return { type: "remember", kind: "name", value: title(m[1]) };
  if (
    (m = /^(?:remember(?: that)?\s+)?(?:when|whenever|if) i say\s+(.+?)\s*,?\s+(?:i mean|i mean the|it means|that means|means|that's|that is)\s+(.+)$/.exec(t)) ||
    (m = /^remember(?: that)?\s+(.+?)\s+(?:means|is short for|stands for)\s+(.+)$/.exec(t))
  ) {
    return { type: "remember", kind: "alias", key: m[1].trim(), value: m[2].trim() };
  }
  if ((m = /^(?:remember(?: that)?\s+)?(?:my|our)\s+(?:usual|favourite|favorite|default|preferred|go-to|go to)\s+hotel\s+(?:in|at|for)\s+([a-z ]+?)\s+is\s+(.+)$/.exec(t))) {
    return { type: "remember", kind: "hotel", city: m[1].trim(), hotel: m[2].trim() };
  }
  if ((m = /^(?:remember(?: that)?\s+)?(?:i|we)\s+(?:always\s+|usually\s+)?(?:prefer|use|like|book)\s+(.+?)\s+(?:in|at|for)\s+([a-z ]+?)(?:\s+(?:always|usually))?$/.exec(t))) {
    return { type: "remember", kind: "hotel", hotel: m[1].trim(), city: m[2].trim() };
  }
  if ((m = /^(?:please )?(?:remember|note|make a note)(?: that| this)?[:,]?\s+(.{3,300})$/.exec(t))) return { type: "remember", kind: "note", value: m[1] };
  return null;
}

// Who a request is about: "for rahul", "rahul's", "trip TRP123" — or null (the open trip).
const NOT_A_NAME = /^(?:confirm|pay|book|check|see|send|do|go|me|myself|the client|client|the customer|customer|him|her|them|this trip|this|the trip|it|everyone|all|the guest|guest|today|tomorrow|this week|whatsapp|email|mail)$/;
function targetOf(t) {
  const id = /\btrp\s?-?\s?(\d{4,})\b/.exec(t);
  if (id) return `TRP${id[1]}`;
  let m = /\b([a-z]+(?: [a-z]+)?)'s\s+(?:trip|booking|itinerary|invoice|bill|vouchers?|receipt|confirmation|quotation|pdf|excel|hotels?|cabs?)\b/.exec(t);
  if (m && !/^(?:today|tomorrow|client|customer|guest)$/.test(m[1])) return m[1].replace(/^(?:the|send|email|download|get|for|of) /, "");
  m = /\b(?:for|of|to)\s+(?:mr |mrs |ms |dr )?([a-z]+(?: [a-z]+)?)(?:'s)?(?:\s+(?:trip|booking|itinerary))?(?:\s+on\s+(?:whatsapp|email|mail))?\s*$/.exec(t);
  if (m && !NOT_A_NAME.test(m[1]) && !/\b(?:whatsapp|email|mail|me|client|hotel|hotels|cab|cabs|supplier|suppliers)\b/.test(m[1])) return m[1];
  return null;
}

// ── documents: invoice / payment receipt / confirmation / vouchers / itinerary PDF / Excel
const DOCS = [
  ["receipt", /\bpayment (?:voucher|receipt|slip)s?\b|\breceipts?\b/],
  ["invoice", /\b(?:tax )?invoices?\b|\bbills?\b/],
  ["confirmation", /\b(?:booking )?confirmation (?:pdf|letter|email|voucher)\b|\bconfirmation\b(?! number)/],
  ["vouchers", /\b(?:hotel |service |travel |transport |cab )?vouchers?\b/],
  ["itinerary", /\b(?:itinerary|trip) pdf\b|\bpdf\b|\bitinerary\b/],
  ["excel", /\bexcel\b|\bquotation\b|\bspreadsheet\b/],
];
function understandDoc(t, { inBuilder }) {
  const doc = DOCS.find(([, re]) => re.test(t))?.[0];
  if (!doc) return null;
  const action = /\bwhats ?app\b/.test(t)
    ? "whatsapp"
    : /\b(?:e-?mail|mail|send)\b/.test(t)
      ? "email"
      : /\b(?:download|get|generate|make|create|export|print|give me|show|open|pull|prepare)\b/.test(t)
        ? "download"
        : null;
  if (!action || t.split(" ").length > 14) return null;
  if (/\b\d+\s*(?:nights?|days?)\b/.test(t)) return null; // a trip request that mentions a PDF
  const query = targetOf(t);
  const toMe = /\b(?:to|for) me\b|\bemail me\b|\bmail me\b/.test(t);
  // Inside the builder, "export the PDF" / "email it to me" / "export excel" /
  // "send the itinerary to the client" are the builder's own commands.
  if (inBuilder && !query && (doc === "itinerary" || doc === "excel")) return null;
  if (inBuilder && !query && doc === "confirmation" && action === "email" && !/\bpdf|letter\b/.test(t)) return null;
  return { type: "doc", doc, action, query, toMe };
}

// ── supplier confirmations: "send hotel requests", "ask the cabs to confirm for Rahul's trip"
function understandSupplier(t) {
  const asks =
    /\b(?:hotel|cab|supplier|vendor|booking|room|taxi)s?\s+(?:requests?|confirmations?|confirmation requests?)\b/.test(t) ||
    /\b(?:ask|tell|request)\s+(?:the\s+|all\s+)?(?:hotels?|cabs?|suppliers?|vendors?|taxis?)\s+(?:to\s+)?confirm/.test(t) ||
    /\brequest (?:all )?(?:the )?confirmations?\b/.test(t);
  if (!asks || !/\b(?:send|request|ask|email|whatsapp|get|tell|remind)\b/.test(t)) return null;
  if (/\b(?:which|any|pending|who)\b/.test(t) && !/\bsend\b/.test(t)) return null; // a question → ops
  const hotel = /\b(?:hotels?|rooms?)\b/.test(t);
  const cab = /\b(?:cabs?|taxis?|cars?|vehicles?|transport)\b/.test(t);
  return { type: "supplier", kinds: hotel && !cab ? ["hotel"] : cab && !hotel ? ["cab"] : ["hotel", "cab"], query: targetOf(t) };
}

// ── driver: "the driver for Rahul's trip is Ramesh 98765 43210 JK01AB1234"
function understandDriver(t) {
  const m = /\bdriver(?:'s name)?\s+(?:for\s+(.+?)\s+)?(?:is|will be|=)\s+([a-z]+(?: [a-z]+)?)(.*)$/.exec(t);
  if (!m) return null;
  const rest = m[3] || "";
  const digits = (rest.match(/\+?\d[\d\s-]{8,16}\d/) || [""])[0].replace(/[^\d+]/g, "");
  const plate = /\b([a-z]{2}\s?-?\d{1,2}\s?-?[a-z]{0,3}\s?-?\d{3,4})\b/.exec(rest.replace(/\+?\d[\d\s-]{8,16}\d/, " "));
  let query = null;
  if (m[1]) {
    const who = m[1].replace(/'s\s+(?:trip|booking)$|\s+(?:trip|booking)$/, "").replace(/^(?:the|this)\s+/, "");
    if (!/^(?:this|the|today|tomorrow|it)$/.test(who)) query = /^trp/.test(who) ? who.replace(/\s|-/g, "").toUpperCase() : who;
  }
  return {
    type: "driver",
    name: title(m[2]),
    phone: digits.length >= 10 ? digits : "",
    vehicleNumber: plate ? plate[1].replace(/[\s-]/g, "").toUpperCase() : "",
    query,
  };
}

// ── operations questions: "today's arrivals", "who's arriving tomorrow", "pending confirmations", "who hasn't paid"
function understandOps(t) {
  const when = /\btomorrow\b/.test(t) ? "tomorrow" : /\b(?:this week|next 7 days|coming week)\b/.test(t) ? "week" : "today";
  if (/\bwho (?:hasn't|has not|didn't|haven't|have not|is yet to) (?:paid|pay)\b|\b(?:unpaid|outstanding|pending) (?:payments?|balances?|amounts?|dues?|bookings?)\b|\bbalances? due\b|\bwho owes\b/.test(t)) {
    return { type: "ops", when, focus: "unpaid" };
  }
  if (/\b(?:pending|unconfirmed|awaiting|outstanding|any|which)\b.*\bconfirm(?:ation)?s?\b|\b(?:hotels?|cabs?|suppliers?)\b.*\b(?:not|haven't|have not|didn't|yet to)\b.*\bconfirm/.test(t)) {
    return { type: "ops", when, focus: "confirmations" };
  }
  if (/\b(?:cabs?|bookings?) (?:without|with no) (?:a )?drivers?\b|\bno drivers?\b|\bdrivers? (?:missing|pending|not assigned|unassigned)\b|\bunassigned drivers?\b/.test(t)) {
    return { type: "ops", when, focus: "drivers" };
  }
  if (
    /\b(?:today'?s?|tomorrow'?s?|this week'?s?)\s+(?:arrivals?|departures?|check[- ]?ins?|check[- ]?outs?|pick ?ups?|cabs?|drivers?|operations|ops|schedule|movements|plan|bookings?)\b/.test(t) ||
    /\bwho(?:'s| is| are)?\s+(?:arriving|coming|landing|leaving|departing|travel+ing|checking (?:in|out))\b/.test(t) ||
    /\bwhat(?:'s| is)?\s+(?:happening|on|planned|scheduled|lined up)\s+(?:for\s+)?(?:today|tomorrow|this week)\b/.test(t) ||
    /\b(?:arrivals?|departures?|check[- ]?ins?)\s+(?:today|tomorrow|this week)\b/.test(t)
  ) {
    const focus = /\bdepart|leaving\b/.test(t) ? "departures" : /\bcheck/.test(t) ? "checkins" : /\bcabs?|drivers?|pick ?ups?\b/.test(t) ? "cabs" : /\barriv|coming|landing\b/.test(t) ? "arrivals" : "all";
    return { type: "ops", when, focus };
  }
  return null;
}

// ── trip search: "find unpaid trips to Gulmarg in October", "show confirmed bookings for Rahul", "Rahul's trips"
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad2 = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function rangeOf(t, now = new Date()) {
  const y = now.getFullYear();
  const mon = (yy, mm) => [ymdOf(new Date(yy, mm, 1)), ymdOf(new Date(yy, mm + 1, 0))];
  if (/\bthis month\b/.test(t)) return mon(y, now.getMonth());
  if (/\bnext month\b/.test(t)) return mon(y, now.getMonth() + 1);
  if (/\blast month\b/.test(t)) return mon(y, now.getMonth() - 1);
  if (/\bthis year\b/.test(t)) return [`${y}-01-01`, `${y}-12-31`];
  if (/\bnext week\b/.test(t)) return [ymdOf(new Date(y, now.getMonth(), now.getDate() + 7 - now.getDay())), ymdOf(new Date(y, now.getMonth(), now.getDate() + 13 - now.getDay()))];
  if (/\bthis week\b/.test(t)) return [ymdOf(new Date(y, now.getMonth(), now.getDate() - now.getDay())), ymdOf(new Date(y, now.getMonth(), now.getDate() + 6 - now.getDay()))];
  if (/\b(?:upcoming|coming up|future)\b/.test(t)) return [ymdOf(now), null];
  const m = new RegExp(`\\b(${MONTHS.join("|")}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\b(?:\\s+(\\d{4}))?`).exec(t);
  if (m) {
    const idx = MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3)));
    let yy = m[2] ? Number(m[2]) : y;
    if (!m[2] && idx < now.getMonth() - 6) yy += 1; // "in February", said in October → next one
    return mon(yy, idx);
  }
  return null;
}
function understandFindTrips(t) {
  const plural = /\b(?:trips|itineraries|bookings|quotes|quotations)\b/;
  if (!plural.test(t) || /\b\d+\s*(?:nights?|days?)\b/.test(t)) return null;
  const verb = /^(?:find|search(?: for)?|show(?: me)?|list|look up|get|pull up|which|any|give me|open)\b/.test(t) || /^(?:all |my )?(?:[a-z]+ )?(?:trips|bookings)\b/.test(t) || /^[a-z]+(?: [a-z]+)?'s (?:trips|bookings)\b/.test(t);
  if (!verb) return null;
  const params = {};
  const status = /\b(confirmed|pending|cancelled|canceled|completed|draft|rejected)\b/.exec(t);
  if (status) params.status = status[1] === "canceled" ? "cancelled" : status[1];
  if (/\b(?:unpaid|not paid|outstanding|due|balance)\b/.test(t)) params.payment = "unpaid";
  else if (/\b(?:fully paid|paid in full|paid)\b/.test(t)) params.payment = "paid";
  const range = rangeOf(t);
  if (range) {
    if (range[0]) params.from = range[0];
    if (range[1]) params.to = range[1];
  }
  let q = null;
  let m = /\b([a-z]+(?: [a-z]+)?)'s (?:trips|bookings|itineraries|quotes)\b/.exec(t);
  if (m) q = m[1];
  if (!q && (m = /\b(?:for|of|to|in|with|from|named|called)\s+([a-z]+(?: [a-z]+)?)\b/.exec(t.replace(new RegExp(`\\b(?:in|from)\\s+(?:${MONTHS.join("|")}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|this|next|last)\\b.*$`), "")))) {
    if (!/^(?:the|this|next|last|me|my|all|client|clients|customer|customers)\b/.test(m[1])) q = m[1].replace(/\s+(?:in|on|this|next|last|that|which|who)$/, "");
  }
  if (q) params.q = q.replace(/\b(?:trip|trips|booking|bookings)\b/g, "").trim() || undefined;
  if (!params.q) delete params.q;
  if (!Object.keys(params).length) return { type: "navigate", path: "/my-trips", label: "your trips" };
  const bits = [];
  if (params.status) bits.push(params.status);
  if (params.payment) bits.push(params.payment === "unpaid" ? "with a balance due" : "fully paid");
  if (params.q) bits.push(`matching “${title(params.q)}”`);
  if (range) bits.push(range[1] ? `travelling ${range[0]} to ${range[1]}` : "upcoming");
  return { type: "find-trips", params, label: bits.join(", ") };
}


// ── money and status: "Rahul paid 20000 by UPI", "received 15k from Rahul in cash",
// "mark Rahul's trip as confirmed", "send a payment reminder to Rahul"
const METHOD = [
  ["UPI", /\b(?:upi|gpay|google pay|phonepe|phone pe|paytm|bhim)\b/],
  ["Bank transfer", /\b(?:bank(?: transfer)?|neft|imps|rtgs|net ?banking|transfer)\b/],
  ["Card", /\b(?:card|credit card|debit card|swipe)\b/],
  ["Cheque", /\b(?:cheque|check)\b/],
  ["Cash", /\bcash\b/],
];
const amountOf = (n, unit) => {
  const v = Number(String(n).replace(/[, ]/g, ""));
  if (!Number.isFinite(v)) return 0;
  return /lakh|lac/.test(unit || "") ? v * 100000 : /k|thousand/.test(unit || "") ? v * 1000 : v;
};
function understandPayment(t) {
  const AMT = "(?:rs\\.?|₹|inr|rupees)?\\s*(\\d{1,3}(?:[ ,]\\d{2,3})+|\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakhs?|lacs?)?\\s*(?:rupees|rs)?";
  let m = new RegExp(`^(?:mr |mrs |ms )?([a-z]+(?: [a-z]+)?) (?:has |have )?(?:paid|sent|transferred|gave|deposited) (?:us |me )?${AMT}`).exec(t);
  let who;
  let amt;
  if (m) {
    who = m[1];
    amt = amountOf(m[2], m[3]);
  } else if ((m = new RegExp(`\\b(?:record|add|log|enter|note)?\\s*(?:a |the )?(?:payment|receipt|advance|balance)?\\s*(?:of )?(?:received |got )?${AMT}\\s+(?:received |paid |payment )?from ([a-z]+(?: [a-z]+)?)`).exec(t)) && /\b(?:record|add|log|enter|note|received?|got|payment|receipt)\b/.test(t)) {
    who = m[3];
    amt = amountOf(m[1], m[2]);
  } else return null;
  if (!(amt >= 1) || /^(?:i|we|you|client|the client)$/.test(who)) return null;
  const method = (METHOD.find(([, re]) => re.test(t)) || ["Cash"])[0];
  return { type: "payment", amount: Math.round(amt * 100) / 100, method, methodSaid: METHOD.some(([, re]) => re.test(t)), query: who.replace(/\s+(?:by|via|in|on|through)$/, "") };
}
function understandStatus(t) {
  const m = /^(?:please )?(?:mark|set|change|make|move)\s+(.+?)\s+(?:as\s+|to\s+)?(confirmed|cancelled|canceled|completed|complete|pending)$/.exec(t);
  if (!m) return null;
  const who = m[1].replace(/'s\s+(?:trip|booking)$|\s+(?:trip|booking)$/, "").replace(/^(?:the|this)\s*/, "").trim();
  const status = { canceled: "cancelled", complete: "completed" }[m[2]] || m[2];
  return { type: "status", status, query: !who || /^(?:it|trip|booking)$/.test(who) ? null : /^trp/.test(who) ? who.replace(/\s|-/g, "").toUpperCase() : who };
}
function understandRemind(t) {
  let m = /\b(?:send\s+(?:a\s+|the\s+)?)?(payment|balance|advance|proposal|itinerary)?\s*reminder\s+(?:to|for)\s+(?!the client\b|client\b|him\b|her\b|them\b)([a-z]+(?: [a-z]+)?)(?:\s+on\s+(?:email|mail))?$/.exec(t);
  if (m) return { type: "remind", kind: /proposal|itinerary/.test(m[1] || "") ? "proposal" : "payment", query: m[2] };
  m = /^remind\s+(?!the client\b|client\b|him\b|her\b|them\b)([a-z]+(?: [a-z]+)?)\s+(?:about|to pay|of|for)\s+(?:the\s+|his\s+|her\s+)?(payment|balance|advance|dues?|proposal|itinerary|quote|trip)\b/.exec(t);
  if (m) return { type: "remind", kind: /proposal|itinerary|quote|trip/.test(m[2]) ? "proposal" : "payment", query: m[1] };
  return null;
}

// ── personality ────────────────────────────────────────────────────────────
const JOKES = [
  "Why did the tourist bring a ladder to Gulmarg? Because he heard the prices there were sky high. Don't worry — ours aren't.",
  "I tried to book a trip to the Dal Lake, but the shikara said it was fully booked. It just wanted to float the idea.",
  "What's a travel agent's favourite exercise? Running the numbers. Twice. With GST.",
  "Why don't mountains ever get tired? Because they peak early.",
  "My doctor said I need a change of scenery. So I changed the trip template from Classic to Modern.",
  "I'd tell you a joke about the Gondola, but it goes over most people's heads.",
  "Why was the hotel invoice so calm? It had already checked out.",
];

const SMALLTALK = [
  [/^(?:hello|hi|hey|namaste|namaskar|salaam|good (?:morning|afternoon|evening))\b(?: there)?$/, () =>
    pick(["Hello! Ching here. Who are we sending on holiday today?", "Hi! Ready when you are — tell me the trip.", "Namaste! Where are we off to today?"])],
  [/^(?:how are you|how's it going|how are you doing|kaise ho|kya haal hai)\b/, () =>
    pick(["Fully charged and fully booked — in a good way. How can I help?", "Better than a Gulmarg sunrise. What are we planning?", "Great, thanks for asking! Got a trip for me?"])],
  [/^(?:who are you|what are you|what is your name|what's your name|tumhara naam)\b/, () =>
    "I'm Ching, your travel desk assistant. Tell me a trip and I'll fill the whole thing — hotels, cabs, day plan, price — while you talk."],
  [/\b(?:what can you do|help me|how do i use you|what do you do|commands)\b/, () =>
    "Try: \"3 night Srinagar trip for Rahul, 4 adults from 10 November\". Then \"make Gulmarg 2 nights\", \"give me 20% margin\", \"what's pending?\", \"send it to the client on WhatsApp\" — or \"open the ledger\" to go anywhere."],
  [/\b(?:joke|make me laugh|funny|mazak|chutkula)\b/, () => pick(JOKES)],
  [/^(?:thank you|thanks|thank u|shukriya|dhanyavad|great job|well done|awesome|nice|perfect|good job)\b/, () =>
    pick(["Anytime! That's what I'm here for.", "My pleasure. Next trip?", "Happy to help — go close that deal!", "Shukriya! Ping me whenever."])],
  [/\b(?:i love you|you're the best|you are the best|best assistant)\b/, () =>
    pick(["Aww. I'd blush, but I'm mostly code. Thank you!", "You're making my circuits warm. Let's book something!"])],
  [/\b(?:are you better than|better than) (?:alexa|siri|google)\b/, () =>
    "Alexa plays music, Siri sets alarms. I build Kashmir itineraries with GST. I'll let you decide."],
  [/^(?:bye|goodbye|good night|see you|later)\b/, () => pick(["Bye! Go sell some holidays.", "Good night! I'll keep the trips warm."])],
  [/\b(?:weather)\b/, () => "I don't have a weather feed yet — but if it's Kashmir, pack a jacket. Always pack a jacket."],
  [/^(?:what time is it|time)\b/, () => `It's ${new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}.`],
  [/^(?:what(?:'s| is) (?:the )?date|today'?s date)\b/, () =>
    `Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}.`],
];

function smallTalk(t) {
  for (const [re, fn] of SMALLTALK) if (re.test(t)) return fn();
  return null;
}

// "Client phone" → "client phone", but "Meal plan for Hotel Heevan" keeps its names.
const lower1 = (label) => label.charAt(0).toLowerCase() + label.slice(1);
const list3 = (items) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Spoken reply after a fill / edit, from what changed and what's still pending. */
export function replyAfter({ mode, changes = [], pending = [], total = null, clientName = "", commandLines = [] }) {
  const required = pending.filter((p) => p.level === "required").map((p) => lower1(p.label));
  const money = total ? ` Total comes to ${total}.` : "";
  const missing = required.length
    ? ` Still need ${list3(required.slice(0, 3))}${required.length > 3 ? ` and ${required.length - 3} more` : ""}.`
    : " Everything's filled — just hit save or export.";
  if (mode === "fill") {
    const who = clientName ? `${clientName.split(" ")[0]}'s trip` : "The trip";
    return `${pick(["Done!", "All set!", "There you go!", "Ta-da!"])} ${who} is filled in.${money}${missing}`;
  }
  if (changes.length) {
    const first = changes[0].replace(/\s*\(.*?\)\s*$/, "");
    const more = changes.length > 1 ? ` and ${changes.length - 1} more change${changes.length > 2 ? "s" : ""}` : "";
    return `${pick(["Done.", "Got it.", "Updated."])} ${first}${more}.${money}`;
  }
  if (commandLines.length) return `${commandLines[0]}.`;
  return notUnderstood();
}

export function notUnderstood() {
  return pick([
    "Hmm, I didn't catch that. Try something like \"make Gulmarg 2 nights\".",
    "Sorry, that one flew over my head — like the Gondola. Say it another way?",
    "I didn't get that. You can say \"what's pending\" or \"open the ledger\".",
  ]);
}

export const navigatingTo = (label) =>
  pick([`Opening ${label}.`, `Taking you to ${label}.`, `Here's ${label}.`]) +
  (/ledger|accounting/.test(label) ? " Let's follow the money." : "");

export function pendingReply(pending) {
  if (!pending.length) return "Nothing's pending — this trip is ready to save or send. Nicely done.";
  const req = pending.filter((p) => p.level === "required");
  const rec = pending.filter((p) => p.level !== "required");
  const parts = [];
  if (req.length) parts.push(`Must fill: ${list3(req.slice(0, 4).map((p) => lower1(p.label)))}${req.length > 4 ? ` and ${req.length - 4} more` : ""}`);
  if (rec.length) parts.push(`Nice to have: ${list3(rec.slice(0, 3).map((p) => lower1(p.label)))}${rec.length > 3 ? ` and ${rec.length - 3} more` : ""}`);
  return `${parts.join(". ")}.`;
}
