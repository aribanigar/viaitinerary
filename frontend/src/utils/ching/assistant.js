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
  ["/confirmation-email", "the voucher desk", /\bvouchers?\b|\bvoucher desk\b|\bconfirmation emails?\b/],
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

  if (/^(?:go |take me )?back$|^previous page$/.test(t)) return { type: "back" };
  if (/\b(?:what(?:'s| is)?|anything|which (?:fields?|sections?)|kya)\b.*\b(?:pending|missing|left|remaining|baki|baaki)\b|\bwhat else (?:do i need|is needed)\b|\bis (?:it|the trip) (?:ready|complete)\b/.test(t)) {
    return { type: "pending" };
  }
  if (/\b(?:what(?:'s| is)|tell me|how much is)\b.*\b(?:total|price|cost|quote)\b/.test(t) && words <= 9) return { type: "total" };
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
