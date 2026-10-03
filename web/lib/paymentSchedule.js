// A trip's client payment schedule — advance now, balance before the trip —
// shared by the proposal page (what to pay), the payment routes (what may be
// charged) and the follow-up cron (what to remind about), so all three agree.

const num = (v) => (v == null || v === "" ? 0 : Number(v) || 0);
const round2 = (n) => Math.round(n * 100) / 100;
const DAY = 86400000;

/**
 * trip: Prisma Trip (cost, paidAmount, refundedAmount, advanceAmount, startDate)
 * settings: Prisma AgencySetting (advancePercentage, balanceDueDays) or null
 * → { total, paid, advance, advanceRemaining, balance, balanceDueDate, next }
 *   next = { kind: "advance" | "balance", amount } | null (fully paid / no price)
 */
export function paymentSchedule(trip, settings) {
  const total = round2(num(trip.cost));
  const paid = round2(Math.max(0, num(trip.paidAmount) - num(trip.refundedAmount)));
  const pct = settings?.advancePercentage == null ? 30 : num(settings.advancePercentage);
  const advance = round2(
    Math.min(total, trip.advanceAmount != null ? num(trip.advanceAmount) : (total * pct) / 100),
  );
  const advanceRemaining = round2(Math.max(0, advance - paid));
  const balance = round2(Math.max(0, total - paid));

  const dueDays = settings?.balanceDueDays ?? 15;
  const balanceDueDate = trip.startDate ? new Date(new Date(trip.startDate).getTime() - dueDays * DAY) : null;

  let next = null;
  if (total > 0) {
    if (advanceRemaining > 0) next = { kind: "advance", amount: advanceRemaining };
    else if (balance > 0) next = { kind: "balance", amount: balance };
  }
  return { total, paid, advance, advanceRemaining, balance, balanceDueDate, next };
}

/** Amount allowed for a requested payment kind ("advance" | "balance" | "full"), or 0. */
export function amountFor(kind, schedule) {
  if (kind === "advance") return schedule.advanceRemaining;
  if (kind === "balance" || kind === "full") return schedule.balance;
  return 0;
}
