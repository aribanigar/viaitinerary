// Lead pipeline helpers shared by the Leads page, the lead drawer and the
// Add Lead form: stages, sources, follow-up dates, WhatsApp links + templates.

export const STAGES = [
  { key: "new", label: "New", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { key: "contacted", label: "Contacted", tone: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { key: "quoted", label: "Quoted", tone: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { key: "negotiating", label: "Negotiating", tone: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  { key: "converted", label: "Won", tone: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  { key: "lost", label: "Lost", tone: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
];
const CLOSED = { key: "closed", label: "Closed", tone: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
export const stageOf = (key) => STAGES.find((s) => s.key === key) || (key === "closed" ? CLOSED : STAGES[0]);
export const isOpenStage = (key) => ["new", "contacted", "quoted", "negotiating"].includes(key);

export const SOURCES = [
  { key: "website", label: "Website" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "phone", label: "Phone call" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "google", label: "Google" },
  { key: "referral", label: "Referral" },
  { key: "repeat", label: "Repeat client" },
  { key: "walk_in", label: "Walk-in" },
  { key: "b2b", label: "B2B / Agent" },
  { key: "other", label: "Other" },
];
export const sourceLabel = (key) => SOURCES.find((s) => s.key === key)?.label || "—";

export const PRIORITIES = [
  { key: "hot", label: "Hot", tone: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  { key: "warm", label: "Warm", tone: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  { key: "cold", label: "Cold", tone: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-400" },
];
export const priorityOf = (key) => PRIORITIES.find((p) => p.key === key) || PRIORITIES[1];

export const LOST_REASONS = [
  "Price too high",
  "Booked with another agency",
  "Plans cancelled / postponed",
  "No response",
  "Dates / hotels not available",
  "Just exploring",
  "Other",
];

export const CALL_OUTCOMES = ["Connected", "No answer", "Busy", "Call back later", "Switched off", "Wrong number"];

// ---- Follow-up dates ------------------------------------------------------

const at = (d, h, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Quick follow-up choices, computed from `now` (local time). */
export function followUpPresets(now = new Date()) {
  const later = new Date(now.getTime() + 2 * 3600000);
  return [
    { key: "2h", label: "In 2 hours", at: later },
    { key: "tomorrow", label: "Tomorrow 10 AM", at: at(addDays(now, 1), 10) },
    { key: "3d", label: "In 3 days", at: at(addDays(now, 3), 10) },
    { key: "1w", label: "Next week", at: at(addDays(now, 7), 10) },
  ];
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Overdue · 2 days", "Today 4:30 PM", "Tomorrow 10:00 AM", "15 Oct" — with a tone. */
export function followUpBadge(value, now = new Date()) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay(d, now)) {
    return d < now
      ? { label: `Due ${time}`, tone: "bg-red-50 text-red-700 border-red-200", state: "due" }
      : { label: `Today ${time}`, tone: "bg-amber-50 text-amber-800 border-amber-200", state: "today" };
  }
  if (d < now) {
    const days = Math.max(1, Math.round((at(now, 0) - at(d, 0)) / 86400000));
    return { label: `Overdue · ${days} day${days > 1 ? "s" : ""}`, tone: "bg-red-50 text-red-700 border-red-200", state: "overdue" };
  }
  if (sameDay(d, addDays(now, 1))) return { label: `Tomorrow ${time}`, tone: "bg-blue-50 text-blue-700 border-blue-200", state: "upcoming" };
  return {
    label: d.toLocaleDateString([], { day: "numeric", month: "short" }) + ` · ${time}`,
    tone: "bg-slate-50 text-slate-600 border-slate-200",
    state: "upcoming",
  };
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", else a date. */
export function timeAgo(value, now = new Date()) {
  if (!value) return "";
  const d = new Date(value);
  const s = Math.round((now - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} day${Math.round(s / 86400) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** A value for <input type="datetime-local"> from a Date / ISO string. */
export function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- WhatsApp -------------------------------------------------------------

/** International digits for WhatsApp ("98765 43210" → "919876543210"), or null. */
export function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = `91${d.slice(1)}`;
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

const isMobile = () =>
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

/** WhatsApp Web on a computer, the WhatsApp app on a phone. */
export function waLink(phone, text = "", mobile = isMobile()) {
  const n = waNumber(phone);
  if (!n) return null;
  const q = text ? `${mobile ? "?" : "&"}text=${encodeURIComponent(text)}` : "";
  return mobile ? `https://wa.me/${n}${q}` : `https://web.whatsapp.com/send?phone=${n}${q}`;
}

/**
 * Open the chat. On a computer every message goes to the same WhatsApp Web
 * tab (named window), so agents don't pile up tabs. Must run inside the click.
 * Returns false when there's no usable number or the pop-up was blocked.
 */
export function openWhatsApp(phone, text = "") {
  const url = waLink(phone, text);
  if (!url) return false;
  const win = window.open(url, isMobile() ? "_blank" : "via-whatsapp");
  try {
    if (win) win.opener = null; // a reused WhatsApp tab is cross-origin: setting it may throw
  } catch {
    /* ignore */
  }
  return !!win; // false: the browser blocked the pop-up

}

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

function tripBits(lead) {
  const dest = lead.destination || "your trip";
  let when = "";
  if (lead.start_date) {
    const d = new Date(lead.start_date);
    if (!Number.isNaN(d.getTime())) when = ` on ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }
  const month = lead.start_date ? new Date(lead.start_date).toLocaleDateString("en-IN", { month: "long" }) : "your dates";
  return { dest, when, month };
}

/** Message templates a top travel desk sends at each stage of a lead. */
export const WA_TEMPLATES = [
  {
    key: "first_reply",
    label: "First reply",
    stages: ["new"],
    text: (l, ctx) => {
      const { dest, when } = tripBits(l);
      return `Hi ${firstName(l.client_name)}, thank you for your enquiry about ${dest}${when}! I'm ${ctx.agent} from ${ctx.agency}.\n\nTo plan it perfectly, could you share:\n1) Exact travel dates\n2) Adults and kids (with ages)\n3) Hotel category — 3★, 4★ or 5★\n4) Anything special (honeymoon, snow, houseboat…)\n\nI'll send you a tailored itinerary right after.`;
    },
  },
  {
    key: "missed_call",
    label: "Tried calling",
    stages: ["new", "contacted"],
    text: (l, ctx) => `Hi ${firstName(l.client_name)}, this is ${ctx.agent} from ${ctx.agency}. I just tried calling you about your ${tripBits(l).dest} trip. When is a good time to talk?`,
  },
  {
    key: "quote_sent",
    label: "Quote sent",
    stages: ["contacted", "quoted"],
    text: (l) => `Hi ${firstName(l.client_name)}, I've shared your ${tripBits(l).dest} itinerary and quote. Have a look and tell me what you'd like changed — hotels, days or budget, everything can be adjusted.`,
  },
  {
    key: "follow_up",
    label: "Follow-up",
    stages: ["quoted", "negotiating", "contacted"],
    text: (l) => `Hi ${firstName(l.client_name)}, just checking in on your ${tripBits(l).dest} plans. Did you get a chance to go through the itinerary? Happy to answer any questions.`,
  },
  {
    key: "availability",
    label: "Rooms filling up",
    stages: ["quoted", "negotiating"],
    text: (l) => {
      const { dest, month } = tripBits(l);
      return `Hi ${firstName(l.client_name)}, rooms in ${dest} for ${month} are filling up fast. Shall I hold them for you? A small advance confirms the booking.`;
    },
  },
  {
    key: "last_try",
    label: "Last try",
    stages: ["contacted", "quoted", "negotiating"],
    text: (l) => `Hi ${firstName(l.client_name)}, I haven't heard back, so I'll pause your ${tripBits(l).dest} enquiry for now. Whenever you're ready to travel, just reply here and I'll pick it up right away.`,
  },
  {
    key: "custom",
    label: "Blank",
    stages: [],
    text: (l) => `Hi ${firstName(l.client_name)}, `,
  },
];

/** The template that fits the lead's stage best. */
export const suggestedTemplate = (lead) =>
  WA_TEMPLATES.find((t) => t.stages.includes(lead.status)) || WA_TEMPLATES[0];
