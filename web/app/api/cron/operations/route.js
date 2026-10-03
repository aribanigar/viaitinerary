import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { mailerForAdminId } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import { appOrigin } from "@/lib/followups";
import { TRIP_INCLUDE } from "@/lib/trips";
import { requestSupplierConfirmations, cabGroups, isLive, todayIST, ymd } from "@/lib/operations";
import {
  operationsSettings,
  supplierNeedsReminder,
  preArrivalDue,
  driverDetailsDue,
  feedbackDue,
  sendPreArrival,
  sendDriverDetails,
  sendFeedbackRequest,
  addDaysYmd,
  tripEnd,
} from "@/lib/tripMessages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EMAILS_PER_AGENCY = 30;

/**
 * GET /api/cron/operations — daily (web/vercel.json), lib/tripMessages.js rules.
 * Per agency: chase unanswered supplier requests, send pre-arrival vouchers,
 * tomorrow's driver details and post-trip feedback requests, then one in-app
 * digest (including confirmations still pending for trips this week).
 * CRON_SECRET-protected like the other crons.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && (request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const now = new Date();
  const today = todayIST();
  const origin = appOrigin(request);
  // Trips that started up to 2 weeks ago (feedback) or start within 30 days.
  const trips = await prisma.trip.findMany({
    where: {
      isPackage: false,
      status: { notIn: ["cancelled", "rejected"] },
      startDate: { gte: new Date(`${addDaysYmd(today, -40)}T00:00:00Z`), lte: new Date(`${addDaysYmd(today, 30)}T23:59:59Z`) },
    },
    include: TRIP_INCLUDE,
    take: 3000,
  });

  const byAgency = new Map();
  trips.forEach((t) => byAgency.set(t.userId, [...(byAgency.get(t.userId) || []), t]));
  const summary = [];

  for (const [adminId, list] of byAgency) {
    const { settings, mailer } = await mailerForAdminId(adminId);
    const s = operationsSettings(settings);
    const c = { supplier: 0, preArrival: 0, drivers: 0, feedback: 0, failed: 0 };
    let sent = 0;
    const room = () => mailer && sent < MAX_EMAILS_PER_AGENCY;

    for (const trip of list) {
      try {
        // Supplier reminders (only for trips that haven't ended).
        if (s.supplierReminders && room() && (tripEnd(trip) || "") >= today) {
          const hotelIds = trip.accommodations
            .filter((a) => isLive(a) && supplierNeedsReminder(a, { now, today, date: ymd(a.checkOut) }))
            .map((a) => a.id);
          const cabIds = cabGroups(trip.transportations.filter(isLive))
            .filter((g) => supplierNeedsReminder(g[0], { now, today, date: ymd(g[g.length - 1].date) }))
            .map((g) => g[0].id);
          if (hotelIds.length || cabIds.length) {
            const rows = await requestSupplierConfirmations(trip, {
              kinds: ["hotel", "cab"],
              ids: { hotel: hotelIds, cab: cabIds },
              email: true,
              origin,
              mailer,
              settings,
            });
            const n = rows.filter((r) => r.emailed).length;
            c.supplier += n;
            sent += n;
          }
        }
        if (s.preArrival && room() && preArrivalDue(trip, today)) {
          await sendPreArrival(trip, settings, mailer);
          await prisma.trip.update({ where: { id: trip.id }, data: { preArrivalSentAt: now } });
          c.preArrival += 1;
          sent += 1;
        }
        const due = s.driverDetails && room() ? driverDetailsDue(trip, today) : null;
        if (due) {
          await sendDriverDetails(trip, settings, mailer, due);
          await prisma.trip.update({ where: { id: trip.id }, data: { driverDetailsSentOn: due.date } });
          c.drivers += 1;
          sent += 1;
        }
        if (s.feedback && room() && feedbackDue(trip, today)) {
          await sendFeedbackRequest(trip, settings, mailer);
          await prisma.trip.update({ where: { id: trip.id }, data: { feedbackRequestedAt: now } });
          c.feedback += 1;
          sent += 1;
        }
      } catch (err) {
        c.failed += 1;
        console.error(`operations cron for ${trip.tripId} failed:`, err.message);
      }
    }

    // Digest: what was sent + what still needs a human this week.
    const week = addDaysYmd(today, 7);
    const pendingThisWeek = list.reduce((n, t) => {
      const start = ymd(t.startDate);
      if (!start || start > week || (tripEnd(t) || "") < today) return n;
      return (
        n +
        t.accommodations.filter((a) => isLive(a) && a.supplierStatus !== "confirmed").length +
        cabGroups(t.transportations.filter(isLive)).filter((g) => g[0].supplierStatus !== "confirmed").length
      );
    }, 0);
    const tomorrow = addDaysYmd(today, 1);
    const noDriver = list.reduce(
      (n, t) => n + t.transportations.filter((x) => ymd(x.date) === tomorrow && !x.driverName).length,
      0,
    );
    const parts = [];
    if (c.supplier) parts.push(`${c.supplier} supplier reminder${c.supplier > 1 ? "s" : ""} sent`);
    if (pendingThisWeek) parts.push(`${pendingThisWeek} booking${pendingThisWeek > 1 ? "s" : ""} this week not confirmed yet`);
    if (noDriver) parts.push(`${noDriver} cab${noDriver > 1 ? "s" : ""} tomorrow without a driver`);
    if (c.preArrival) parts.push(`${c.preArrival} pre-arrival email${c.preArrival > 1 ? "s" : ""} with vouchers`);
    if (c.drivers) parts.push(`${c.drivers} client${c.drivers > 1 ? "s" : ""} sent tomorrow's driver`);
    if (c.feedback) parts.push(`${c.feedback} feedback request${c.feedback > 1 ? "s" : ""}`);
    if (parts.length) await notify(adminId, "operations_digest", { type: "operations_digest", message: `Operations: ${parts.join(" · ")}` });
    summary.push({ adminId, ...c, pendingThisWeek, noDriver, smtp: !!mailer });
  }

  return NextResponse.json({ ranAt: now.toISOString(), today, agencies: summary.length, summary });
}
