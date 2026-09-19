import prisma from "@/lib/prisma";

const round2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);

/** Compact, client-facing snapshot of a fully-loaded (TRIP_INCLUDE) trip. */
export function snapshotTrip(trip) {
  return {
    cost: round2(trip.cost),
    gstPercentage: round2(trip.gstPercentage),
    profitMarginPercentage: round2(trip.profitMarginPercentage),
    currency: trip.currency,
    startDate: trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 10) : null,
    duration: trip.duration,
    itineraries: (trip.itineraries || [])
      .slice()
      .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))
      .map((i) => ({ day: i.dayNumber, title: i.title, location: i.location })),
    accommodations: (trip.accommodations || []).map((a) => ({
      name: a.name,
      checkIn: a.checkIn ? new Date(a.checkIn).toISOString().slice(0, 10) : null,
      checkOut: a.checkOut ? new Date(a.checkOut).toISOString().slice(0, 10) : null,
      roomType: a.roomType,
      pricePerRoom: round2(a.pricePerRoom),
      markupPercentage: round2(a.markupPercentage),
      cancelled: !!a.cancelledAt,
    })),
    transportations: (trip.transportations || []).map((t) => ({
      route: t.route,
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : null,
      vehicleType: t.vehicleType,
      quantity: t.quantity,
      markupPercentage: round2(t.markupPercentage),
    })),
  };
}

const fmtMoney = (v) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const itemLabel = (item) => `${item.name || item.route || "item"}${item.checkIn ? ` (${item.checkIn})` : item.date ? ` (${item.date})` : ""}`;

/** Diff two snapshots into a list of short, human-readable change strings. */
export function diffTripSnapshots(prev, next) {
  const changes = [];
  if (!prev) return changes;

  if (prev.cost !== next.cost) {
    changes.push(`Total cost changed from ₹${fmtMoney(prev.cost)} to ₹${fmtMoney(next.cost)}`);
  }
  if (prev.gstPercentage !== next.gstPercentage) {
    changes.push(`GST changed from ${prev.gstPercentage ?? 0}% to ${next.gstPercentage ?? 0}%`);
  }
  if (prev.profitMarginPercentage !== next.profitMarginPercentage) {
    changes.push(`Profit margin changed from ${prev.profitMarginPercentage ?? 0}% to ${next.profitMarginPercentage ?? 0}%`);
  }
  if (prev.startDate !== next.startDate) {
    changes.push(`Start date changed from ${prev.startDate || "—"} to ${next.startDate || "—"}`);
  }
  if (prev.duration !== next.duration) {
    changes.push(`Duration changed from ${prev.duration || "—"} to ${next.duration || "—"}`);
  }

  const diffList = (prevList, nextList, describe) => {
    const prevKeys = new Set(prevList.map(describe));
    const nextKeys = new Set(nextList.map(describe));
    for (const key of nextKeys) if (!prevKeys.has(key)) changes.push(`Added ${key}`);
    for (const key of prevKeys) if (!nextKeys.has(key)) changes.push(`Removed ${key}`);
  };

  diffList(prev.accommodations, next.accommodations, (a) => `hotel: ${itemLabel(a)}`);
  diffList(prev.transportations, next.transportations, (t) => `transport: ${itemLabel(t)}`);

  // For items present on both sides (matched by name/route+date), flag price/markup edits.
  const matchAccommodation = (a) => `${a.name}|${a.checkIn}`;
  const prevAccByKey = new Map(prev.accommodations.map((a) => [matchAccommodation(a), a]));
  for (const a of next.accommodations) {
    const before = prevAccByKey.get(matchAccommodation(a));
    if (!before) continue;
    if (before.pricePerRoom !== a.pricePerRoom) {
      changes.push(`${a.name}: price changed from ₹${fmtMoney(before.pricePerRoom)} to ₹${fmtMoney(a.pricePerRoom)}`);
    }
    if (before.markupPercentage !== a.markupPercentage) {
      changes.push(`${a.name}: margin override changed from ${before.markupPercentage ?? "trip default"}% to ${a.markupPercentage ?? "trip default"}%`);
    }
    if (before.cancelled !== a.cancelled) {
      changes.push(`${a.name}: ${a.cancelled ? "marked cancelled" : "cancellation cleared"}`);
    }
  }

  return changes;
}

/**
 * Log a new revision for this trip if anything client-facing changed since
 * the last logged send. Returns the created revision, or null if nothing
 * changed (avoids spamming the trail when an untouched quote is re-sent).
 */
export async function recordTripRevision(tripDbId, trigger) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripDbId },
    include: { itineraries: true, accommodations: true, transportations: true },
  });
  if (!trip) return null;

  const snapshot = snapshotTrip(trip);

  const last = await prisma.tripRevision.findFirst({
    where: { tripId: tripDbId },
    orderBy: { versionNumber: "desc" },
  });

  if (!last) {
    return prisma.tripRevision.create({
      data: { tripId: tripDbId, versionNumber: 1, trigger, snapshot, changeSummary: ["Initial version"] },
    });
  }

  const changeSummary = diffTripSnapshots(last.snapshot, snapshot);
  if (changeSummary.length === 0) return null;

  return prisma.tripRevision.create({
    data: { tripId: tripDbId, versionNumber: last.versionNumber + 1, trigger, snapshot, changeSummary },
  });
}
