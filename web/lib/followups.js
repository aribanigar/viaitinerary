import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { ensureProposalToken } from "@/lib/proposal";
import { paymentSchedule } from "@/lib/paymentSchedule";
import { currencySymbol } from "@/lib/serialize";

// Sales follow-ups: nudge clients who haven't answered a proposal, remind
// clients who approved but haven't paid (advance) or whose balance is due.
// Used by the daily cron (/api/cron/sales-followups), the on-demand
// "remind" route and the dashboard pipeline, so all three agree on what is due.
//
// The decision functions are pure (plain objects in, answer out — `now` is a
// parameter) so they can be tested without a database.

const HOUR = 3600000;
const DAY = 86400000;

export const MAX_ADVANCE_REMINDERS = 3;
// paymentReminderCount is shared by both kinds; cap the total so a balance
// window (3 days before the due date until the trip starts) can't spam.
export const MAX_PAYMENT_REMINDERS_TOTAL = 6;
export const BALANCE_DUE_SOON_DAYS = 3;

const ms = (d) => (d ? new Date(d).getTime() : null);
const hasEmail = (trip) => !!String(trip?.clientEmail ?? "").trim();
const closedStatus = (trip) => ["cancelled", "canceled"].includes(String(trip?.status || "").toLowerCase());
const notStarted = (trip, now) => !trip.startDate || ms(trip.startDate) > ms(now);
const latest = (...ds) => {
  const vals = ds.map(ms).filter((v) => v != null);
  return vals.length ? Math.max(...vals) : null;
};
const intOr = (v, d) => (v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v));

/** Settings with the schema defaults filled in (settings may be null). */
export function followUpSettings(settings) {
  return {
    followUpsEnabled: settings?.followUpsEnabled ?? true,
    followUpAfterHours: intOr(settings?.followUpAfterHours, 24),
    maxFollowUps: intOr(settings?.maxFollowUps, 2),
    paymentRemindersEnabled: settings?.paymentRemindersEnabled ?? true,
    paymentReminderAfterDays: intOr(settings?.paymentReminderAfterDays, 2),
  };
}

/** The client accepted the trip (approved the proposal or the agent confirmed it). */
export const isApproved = (trip) =>
  trip?.proposalResponse === "approved" || ["confirmed", "completed"].includes(String(trip?.status || "").toLowerCase());

/** An "I've paid" claim the agency hasn't verified yet (needs trip.clientPayments loaded). */
export const hasOpenClaim = (trip) => (trip?.clientPayments || []).some((p) => p.status === "claimed");

/**
 * Should the daily cron nudge this client about an unanswered proposal?
 * Rules: proposal sent, no response, not a package, client email, trip not
 * cancelled and not started, fewer than maxFollowUps nudges so far, and the
 * last contact (sent or last nudge) at least followUpAfterHours ago.
 */
export function proposalNeedsFollowUp(trip, settings, now = new Date()) {
  const s = followUpSettings(settings);
  if (!s.followUpsEnabled) return false;
  if (!trip || trip.isPackage || closedStatus(trip)) return false;
  if (!trip.proposalSentAt || trip.proposalResponse) return false;
  if (!hasEmail(trip)) return false;
  if (!notStarted(trip, now)) return false;
  if ((trip.proposalFollowUpCount ?? 0) >= s.maxFollowUps) return false;
  const last = latest(trip.proposalSentAt, trip.proposalLastFollowUpAt);
  return ms(now) - last >= s.followUpAfterHours * HOUR;
}

/**
 * What the client owes next, ignoring reminder timing: { kind, amount, dueDate,
 * schedule } | null. Advance only once the trip is approved/confirmed.
 */
export function paymentDue(trip, settings) {
  if (!trip || trip.isPackage || closedStatus(trip)) return null;
  const schedule = paymentSchedule(trip, settings);
  const next = schedule.next;
  if (!next || !(next.amount > 0)) return null;
  if (next.kind === "advance") {
    if (!isApproved(trip)) return null;
    return { kind: "advance", amount: next.amount, dueDate: null, schedule };
  }
  return { kind: "balance", amount: next.amount, dueDate: schedule.balanceDueDate, schedule };
}

/**
 * Should the daily cron remind this client to pay? → null | { kind, amount, dueDate }
 *  advance: approved (proposal) or confirmed, advance still due, trip not started,
 *           proposal was sent (the client knows the link), the approval / last
 *           reminder at least paymentReminderAfterDays ago, fewer than 3 reminders.
 *  balance: advance paid, balance due, balance due date within 3 days (or past),
 *           trip not started, last reminder at least paymentReminderAfterDays ago.
 * Never while the client has an unverified "I've paid" claim.
 */
export function paymentNeedsReminder(trip, settings, now = new Date()) {
  const s = followUpSettings(settings);
  if (!s.paymentRemindersEnabled) return null;
  if (!trip || !hasEmail(trip) || !notStarted(trip, now)) return null;
  if (hasOpenClaim(trip)) return null;
  const due = paymentDue(trip, settings);
  if (!due) return null;

  const gap = s.paymentReminderAfterDays * DAY;
  const count = trip.paymentReminderCount ?? 0;
  const t = ms(now);

  if (due.kind === "advance") {
    // Never email a payment link out of the blue: the client must have been
    // sent the proposal (older confirmed trips tracked offline are skipped).
    if (!trip.proposalSentAt) return null;
    if (count >= MAX_ADVANCE_REMINDERS) return null;
    const approvedAt = trip.proposalResponse === "approved" ? trip.proposalRespondedAt : null;
    const ref = latest(approvedAt, trip.lastPaymentReminderAt) ?? latest(trip.updatedAt, trip.createdAt, trip.proposalSentAt);
    if (ref == null || t - ref < gap) return null;
    return { kind: "advance", amount: due.amount, dueDate: null };
  }

  // balance
  if (!due.dueDate) return null;
  if (count >= MAX_PAYMENT_REMINDERS_TOTAL) return null;
  if (ms(due.dueDate) - t > BALANCE_DUE_SOON_DAYS * DAY) return null;
  const last = ms(trip.lastPaymentReminderAt);
  if (last != null && t - last < gap) return null;
  return { kind: "balance", amount: due.amount, dueDate: due.dueDate };
}

// ── Emails ─────────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "").trim()) ? String(c).trim() : "#181c22");

export function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  } catch {
    return new Date(d).toISOString().slice(0, 10);
  }
}

export function fmtMoney(amount, currency) {
  const n = Number(amount) || 0;
  return `${currencySymbol(currency)} ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`.trim();
}

/** App origin for links in emails sent without a request (the cron). */
export function appOrigin(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return request ? new URL(request.url).origin : "";
}

function emailShell({ settings, greetingName, paragraphs, button, details, url }) {
  const agency = settings?.agencyName || "Your travel agent";
  const brand = safeColor(settings?.brandColor);
  const rows = (details || [])
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#666;width:45%">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#181c22;max-width:560px;line-height:1.5">
    <p>Dear ${esc(greetingName || "Guest")},</p>
    ${paragraphs.map((p) => `<p>${p}</p>`).join("\n    ")}
    ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 4px">${rows}</table>` : ""}
    <p style="margin:28px 0"><a href="${esc(url)}" style="background:${esc(brand)};color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:bold">${esc(button)}</a></p>
    <p style="font-size:13px;color:#666">If the button doesn't work, open this link:<br>${esc(url)}</p>
    <p>Warm regards,<br>${esc(agency)}${settings?.contactPhone ? `<br>${esc(settings.contactPhone)}` : ""}</p>
  </div>`;
}

/** { subject, html } for a proposal nudge. */
export function proposalFollowUpEmail(trip, settings, url) {
  const agency = settings?.agencyName || "your travel agent";
  const title = trip.tripTitle || "your trip";
  const viewed = !!trip.proposalViewedAt;
  const paragraphs = viewed
    ? [
        `We hope you enjoyed going through the itinerary for <b>${esc(title)}</b>.`,
        `If you'd like anything changed — hotels, dates, activities — just tell us from the link below. And when it looks right, you can approve it there in one tap.`,
      ]
    : [
        `Just checking that you received the itinerary we put together for <b>${esc(title)}</b>.`,
        `It has the day-wise plan, hotels and price. Have a look whenever you're free, and approve it or tell us what to change.`,
      ];
  if (trip.startDate) {
    paragraphs.push(`Your travel date is <b>${esc(fmtDate(trip.startDate))}</b> — confirming early helps us hold the best hotels for you.`);
  }
  return {
    subject: viewed ? `Any changes to your ${title} plan? — ${agency}` : `Your ${title} itinerary from ${agency}`,
    html: emailShell({
      settings,
      greetingName: trip.clientName,
      paragraphs,
      button: "View your trip",
      url,
    }),
  };
}

/** { subject, html } for a payment reminder. due = { kind, amount, dueDate }. */
export function paymentReminderEmail(trip, settings, url, due, now = new Date()) {
  const agency = settings?.agencyName || "your travel agent";
  const title = trip.tripTitle || "your trip";
  const amount = fmtMoney(due.amount, trip.currency);
  const overdue = due.dueDate && ms(due.dueDate) < ms(now);
  let subject;
  let paragraphs;
  if (due.kind === "advance") {
    subject = `Advance payment for ${title} — ${agency}`;
    paragraphs = [
      `Thank you for choosing us for <b>${esc(title)}</b>!`,
      `To lock in your hotels and cab, please pay the advance of <b>${esc(amount)}</b>. You can pay securely from the link below — it takes a minute.`,
    ];
  } else {
    subject = overdue
      ? `Balance payment for ${title} is overdue — ${agency}`
      : `Balance payment for ${title} due ${fmtDate(due.dueDate)} — ${agency}`;
    paragraphs = [
      trip.startDate
        ? `Your trip <b>${esc(title)}</b> is coming up on <b>${esc(fmtDate(trip.startDate))}</b> — we're getting everything ready.`
        : `We're getting everything ready for <b>${esc(title)}</b>.`,
      overdue
        ? `The balance of <b>${esc(amount)}</b> was due on <b>${esc(fmtDate(due.dueDate))}</b>. Please clear it from the link below so we can finalise your bookings.`
        : `The balance of <b>${esc(amount)}</b> is due by <b>${esc(fmtDate(due.dueDate))}</b>. You can pay from the link below.`,
    ];
  }
  paragraphs.push(`Already paid? Please ignore this message — thank you!`);
  return {
    subject,
    html: emailShell({
      settings,
      greetingName: trip.clientName,
      paragraphs,
      button: due.kind === "advance" ? "Pay advance" : "Pay balance",
      url,
      details: [
        ["Amount due", amount],
        ["Due date", due.dueDate ? fmtDate(due.dueDate) : ""],
        ["Trip starts", trip.startDate ? fmtDate(trip.startDate) : ""],
      ],
    }),
  };
}

/** Email the client a proposal nudge and bump the follow-up counters. → { sent_to } */
export async function sendProposalFollowUp(trip, settings, mailer, origin, now = new Date()) {
  const token = await ensureProposalToken(trip);
  const url = `${origin}/p/${token}`;
  const { subject, html } = proposalFollowUpEmail(trip, settings, url);
  await sendMail(mailer, { to: trip.clientEmail.trim(), subject, html });
  await prisma.trip.update({
    where: { id: trip.id },
    data: { proposalFollowUpCount: { increment: 1 }, proposalLastFollowUpAt: now },
  });
  return { sent_to: trip.clientEmail.trim() };
}

/** Email the client a payment reminder and bump the reminder counters. → { sent_to, kind, amount } */
export async function sendPaymentReminder(trip, settings, mailer, origin, due = null, now = new Date()) {
  const what = due || paymentDue(trip, settings);
  if (!what) throw new Error("Nothing is due on this trip.");
  const token = await ensureProposalToken(trip);
  const url = `${origin}/p/${token}#pay`;
  const { subject, html } = paymentReminderEmail(trip, settings, url, what, now);
  await sendMail(mailer, { to: trip.clientEmail.trim(), subject, html });
  await prisma.trip.update({
    where: { id: trip.id },
    data: { paymentReminderCount: { increment: 1 }, lastPaymentReminderAt: now },
  });
  return { sent_to: trip.clientEmail.trim(), kind: what.kind, amount: what.amount };
}

// ── Pipeline (dashboard) ───────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  "drafts_not_sent",
  "sent_not_viewed",
  "viewed_no_response",
  "changes_requested",
  "approved_unpaid",
  "partially_paid",
  "fully_paid",
];

/** Which pipeline stage a trip is in (exactly one). */
export function pipelineStage(trip, settings) {
  const sch = paymentSchedule(trip, settings);
  if (sch.total > 0 && sch.paid >= sch.total) return "fully_paid";
  if (sch.paid > 0) return "partially_paid";
  if (isApproved(trip)) return "approved_unpaid";
  if (trip.proposalResponse === "changes_requested") return "changes_requested";
  if (trip.proposalSentAt && trip.proposalViewedAt) return "viewed_no_response";
  if (trip.proposalSentAt) return "sent_not_viewed";
  return "drafts_not_sent";
}

const NOT_VIEWED_HOURS = 48;

/**
 * Why a trip needs the agent's attention now, or null.
 * → { rank, key, reason, since } — lower rank = more urgent.
 */
export function attentionFor(trip, settings, now = new Date()) {
  if (!trip || trip.isPackage || closedStatus(trip)) return null;
  if (String(trip.status || "").toLowerCase() === "completed") return null;
  const t = ms(now);
  const sym = (a) => fmtMoney(a, trip.currency);

  if (trip.proposalResponse === "changes_requested" && !(ms(trip.proposalSentAt) > ms(trip.proposalRespondedAt))) {
    return { rank: 0, key: "changes_requested", reason: "Asked for changes", since: trip.proposalRespondedAt };
  }
  const claim = (trip.clientPayments || []).find((p) => p.status === "claimed");
  if (claim) {
    return { rank: 1, key: "payment_claimed", reason: `Says they paid ${sym(claim.amount)} — verify`, since: claim.createdAt };
  }
  const due = paymentDue(trip, settings);
  const started = trip.startDate && ms(trip.startDate) <= t;
  if (due?.kind === "advance" && due.schedule.paid <= 0 && !started) {
    return {
      rank: 2,
      key: "approved_unpaid",
      reason: `Approved — advance ${sym(due.amount)} not paid`,
      since: (trip.proposalResponse === "approved" && trip.proposalRespondedAt) || trip.updatedAt || trip.createdAt,
    };
  }
  if (due?.kind === "balance" && due.dueDate && !started && ms(due.dueDate) - t <= BALANCE_DUE_SOON_DAYS * DAY) {
    const overdue = ms(due.dueDate) < t;
    return {
      rank: 3,
      key: "balance_due",
      reason: overdue
        ? `Balance ${sym(due.amount)} overdue since ${fmtDate(due.dueDate)}`
        : `Balance ${sym(due.amount)} due ${fmtDate(due.dueDate)}`,
      since: due.dueDate,
    };
  }
  if (
    trip.proposalSentAt &&
    !trip.proposalViewedAt &&
    !trip.proposalResponse &&
    !started &&
    t - ms(trip.proposalSentAt) > NOT_VIEWED_HOURS * HOUR
  ) {
    const days = Math.floor((t - ms(trip.proposalSentAt)) / DAY);
    return { rank: 4, key: "not_viewed", reason: `Proposal not opened in ${days} days`, since: trip.proposalSentAt };
  }
  return null;
}
