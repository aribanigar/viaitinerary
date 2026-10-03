import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { mailerForAdminId } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import {
  followUpSettings,
  proposalNeedsFollowUp,
  paymentNeedsReminder,
  sendProposalFollowUp,
  sendPaymentReminder,
  attentionFor,
  appOrigin,
} from "@/lib/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_EMAILS_PER_AGENCY = 25; // per run — keeps one agency's backlog from eating the window

/**
 * GET /api/cron/sales-followups — daily (web/vercel.json). For every agency:
 * nudge clients who haven't answered a proposal, remind clients with a payment
 * due, then leave one in-app digest of what needs attention. Agencies without
 * their own SMTP get the digest only. CRON_SECRET-protected like the B2B sync.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && (request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const origin = appOrigin(request);
  const horizon = new Date(now.getTime() - 120 * 86400000);
  // Candidate trips: proposals in play recently, or trips still to start.
  const trips = await prisma.trip.findMany({
    where: {
      isPackage: false,
      OR: [{ proposalSentAt: { gte: horizon } }, { startDate: { gte: now } }],
    },
    include: { clientPayments: { where: { status: "claimed" } } },
    take: 2000,
  });

  const byAgency = new Map();
  trips.forEach((t) => byAgency.set(t.userId, [...(byAgency.get(t.userId) || []), t]));
  const summary = [];

  for (const [adminId, list] of byAgency) {
    const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
    const s = followUpSettings(settings);
    const { mailer } = s.followUpsEnabled || s.paymentRemindersEnabled ? await mailerForAdminId(adminId) : { mailer: null };
    let followUps = 0;
    let reminders = 0;
    let failed = 0;
    let sent = 0;

    for (const trip of list) {
      if (!mailer || sent >= MAX_EMAILS_PER_AGENCY) break;
      try {
        if (proposalNeedsFollowUp(trip, settings, now)) {
          await sendProposalFollowUp(trip, settings, mailer, origin, now);
          followUps += 1;
          sent += 1;
          continue;
        }
        const due = paymentNeedsReminder(trip, settings, now);
        if (due) {
          await sendPaymentReminder(trip, settings, mailer, origin, due, now);
          reminders += 1;
          sent += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(`follow-up for ${trip.tripId} failed:`, err.message);
      }
    }

    const attention = list.map((t) => attentionFor(t, settings, now)).filter(Boolean);
    const count = (key) => attention.filter((a) => a.key === key).length;
    const parts = [];
    if (followUps) parts.push(`${followUps} proposal follow-up${followUps > 1 ? "s" : ""} sent`);
    if (reminders) parts.push(`${reminders} payment reminder${reminders > 1 ? "s" : ""} sent`);
    if (count("payment_claimed")) parts.push(`${count("payment_claimed")} payment${count("payment_claimed") > 1 ? "s" : ""} to verify`);
    if (count("changes_requested")) parts.push(`${count("changes_requested")} change request${count("changes_requested") > 1 ? "s" : ""} waiting`);
    if (count("approved_unpaid")) parts.push(`${count("approved_unpaid")} approved trip${count("approved_unpaid") > 1 ? "s" : ""} awaiting advance`);
    if (count("balance_due")) parts.push(`${count("balance_due")} balance${count("balance_due") > 1 ? "s" : ""} due soon`);
    if (count("not_viewed")) parts.push(`${count("not_viewed")} proposal${count("not_viewed") > 1 ? "s" : ""} not opened`);
    if (parts.length) await notify(adminId, "sales_digest", { type: "sales_digest", message: parts.join(" · ") });
    summary.push({ adminId, followUps, reminders, failed, attention: attention.length, smtp: !!mailer });
  }

  return NextResponse.json({ ranAt: now.toISOString(), agencies: summary.length, summary });
}
