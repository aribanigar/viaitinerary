import prisma from "@/lib/prisma";

// Port of Laravel's AccountingLedgerService. The "obligations" are derived
// from a trip's client cost (receivable) and its accommodation/transportation
// line items (payables); "settlements" record money received or paid against
// them. Everything is scoped by the resolved admin user_id.

const num = (v) => (v == null ? 0 : Number(v));
const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

function statusFromAmounts(expected, settled) {
  if (expected <= 0) return "settled";
  if (settled <= 0) return "pending";
  if (settled >= expected) return "settled";
  return "partial";
}

function resolveBedPrice(bedPrices, needleTokens) {
  for (const entry of bedPrices || []) {
    const category = String(entry?.category ?? "").toLowerCase();
    for (const token of needleTokens) {
      if (category.includes(String(token).toLowerCase())) return num(entry?.price);
    }
  }
  return 0;
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;
  const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const end = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 1;
}

function accommodationCost(acc) {
  const nights = nightsBetween(acc.checkIn, acc.checkOut);
  let rooms = num(acc.rooms) || 1;
  if (rooms <= 0) rooms = 1;
  const pricePerRoom = num(acc.pricePerRoom);
  const roomSubtotal = rooms * pricePerRoom * nights;

  const bedPrices = Array.isArray(acc.bedPrices) ? acc.bedPrices : [];
  const cnbPrice = resolveBedPrice(bedPrices, ["cnb"]);
  const extra512Price = resolveBedPrice(bedPrices, ["5-12", "5 to 12"]);
  const extraAbove12Price = resolveBedPrice(bedPrices, ["above 12", "12+"]);

  const cnbCost = cnbPrice * num(acc.cnbCount) * nights;
  const extra512Cost = extra512Price * num(acc.extraBeds5To12Count) * nights;
  const extraAbove12Cost = extraAbove12Price * num(acc.extraBedsAbove12Count) * nights;

  return Math.max(0, roomSubtotal + cnbCost + extra512Cost + extraAbove12Cost);
}

function transportationCost(trans) {
  const price = num(trans.vehicle?.price);
  let qty = num(trans.quantity) || 1;
  if (qty <= 0) qty = 1;
  return Math.max(0, price * qty);
}

async function upsertObligation(key, payload) {
  const existing = await prisma.accountingObligation.findUnique({
    where: { obligation_source: key },
  });
  if (existing) {
    return prisma.accountingObligation.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.accountingObligation.create({ data: { ...key, ...payload } });
}

async function syncClientReceivable(trip, ownerUserId, ownerTeamId) {
  const expected = round2(trip.cost);
  const settled = round2(Math.max(0, num(trip.paidAmount) - num(trip.refundedAmount)));

  const obligation = await upsertObligation(
    { tripId: trip.id, direction: "receivable", sourceType: "trip", sourceId: trip.id },
    {
      userId: ownerUserId,
      teamId: ownerTeamId,
      partyType: "client",
      partyId: null,
      partyName: trip.clientName || "Client",
      expectedAmount: expected,
      settledAmount: settled,
      status: statusFromAmounts(expected, settled),
    }
  );

  // recalculateWithoutSettlementsIfManual: if no settlements recorded, trust the trip totals.
  const count = await prisma.accountingSettlement.count({ where: { obligationId: obligation.id } });
  if (count === 0) {
    await prisma.accountingObligation.update({
      where: { id: obligation.id },
      data: { settledAmount: settled, status: statusFromAmounts(num(obligation.expectedAmount), settled) },
    });
  }
}

async function syncPayables(trip, ownerUserId, ownerTeamId, sourceType, items, costFn, partyType, mapParty) {
  const activeIds = [];
  for (const item of items) {
    activeIds.push(item.id);
    const expected = round2(costFn(item));
    const existing = await prisma.accountingObligation.findUnique({
      where: { obligation_source: { tripId: trip.id, direction: "payable", sourceType, sourceId: item.id } },
    });
    const settledAmount = existing ? num(existing.settledAmount) : 0;
    const party = mapParty(item);

    await upsertObligation(
      { tripId: trip.id, direction: "payable", sourceType, sourceId: item.id },
      {
        userId: ownerUserId,
        teamId: ownerTeamId,
        partyType,
        partyId: party.partyId,
        partyName: party.partyName,
        expectedAmount: expected,
        settledAmount,
        status: statusFromAmounts(expected, settledAmount),
      }
    );
  }

  // Zero out obligations whose source line item no longer exists.
  await prisma.accountingObligation.updateMany({
    where: {
      tripId: trip.id,
      direction: "payable",
      sourceType,
      ...(activeIds.length ? { sourceId: { notIn: activeIds } } : { sourceId: { not: null } }),
    },
    data: { expectedAmount: 0, status: "settled" },
  });
}

/** Build/refresh obligations for a trip from its current line items. */
export async function syncTrip(trip, fallbackUserId, fallbackTeamId) {
  const ownerUserId = trip.userId || fallbackUserId;
  if (!ownerUserId) return;
  const ownerTeamId = trip.teamId ?? fallbackTeamId ?? null;

  await prisma.$transaction(async () => {
    await syncClientReceivable(trip, ownerUserId, ownerTeamId);
    await syncPayables(
      trip,
      ownerUserId,
      ownerTeamId,
      "accommodation",
      trip.accommodations || [],
      accommodationCost,
      "hotel",
      (acc) => ({ partyId: acc.hotelId ?? null, partyName: acc.name || acc.hotel?.name || "Hotel" })
    );
    await syncPayables(
      trip,
      ownerUserId,
      ownerTeamId,
      "transportation",
      trip.transportations || [],
      transportationCost,
      "cab",
      (t) => ({ partyId: t.vehicleId ?? null, partyName: t.vehicleType || t.vehicle?.name || "Cab" })
    );
  });
}

export async function recalculateObligation(obligationId) {
  const obligation = await prisma.accountingObligation.findUnique({
    where: { id: obligationId },
    include: { trip: true, settlements: true },
  });
  if (!obligation) return;

  const expected = num(obligation.expectedAmount);

  if (obligation.direction === "receivable" && obligation.sourceType === "trip") {
    const trip = obligation.trip;
    const settledFromTrip = Math.max(0, num(trip?.paidAmount) - num(trip?.refundedAmount));
    await prisma.accountingObligation.update({
      where: { id: obligation.id },
      data: { settledAmount: round2(settledFromTrip), status: statusFromAmounts(expected, settledFromTrip) },
    });
    return;
  }

  const settled = (obligation.settlements || []).reduce((sum, row) => {
    const amount = num(row.amount);
    return sum + (row.settlementType === "refund" ? -amount : amount);
  }, 0);

  let status = "pending";
  if (settled >= expected && expected > 0) status = "settled";
  else if (settled > 0) status = "partial";
  if (expected <= 0 && settled <= 0) status = "settled";

  await prisma.accountingObligation.update({
    where: { id: obligation.id },
    data: { settledAmount: Math.max(0, round2(settled)), status },
  });
}

export async function recordSettlement(obligation, data, actorId) {
  const settlementType = data.settlement_type || (obligation.direction === "receivable" ? "receipt" : "payment");

  const settlement = await prisma.accountingSettlement.create({
    data: {
      obligationId: obligation.id,
      tripId: obligation.tripId,
      userId: obligation.userId,
      createdBy: actorId,
      amount: num(data.amount),
      settlementType,
      settlementDate: data.settlement_date ? new Date(data.settlement_date) : today(),
      method: data.method ?? null,
      notes: data.notes ?? null,
    },
  });

  // Receivable against a trip flows back into the trip's paid/refunded totals.
  if (obligation.direction === "receivable" && obligation.sourceType === "trip") {
    const trip = await prisma.trip.findUnique({ where: { id: obligation.tripId } });
    if (trip) {
      if (settlementType === "refund") {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { refundedAmount: round2(num(trip.refundedAmount) + num(settlement.amount)) },
        });
      } else {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { paidAmount: round2(num(trip.paidAmount) + num(settlement.amount)) },
        });
      }
    }
  }

  await recalculateObligation(obligation.id);
  return settlement;
}

export async function updateSettlement(settlement, data) {
  const updated = await prisma.accountingSettlement.update({
    where: { id: settlement.id },
    data: {
      amount: num(data.amount ?? settlement.amount),
      settlementType: data.settlement_type ?? settlement.settlementType,
      settlementDate: data.settlement_date ? new Date(data.settlement_date) : settlement.settlementDate,
      method: data.method ?? settlement.method,
      notes: data.notes ?? settlement.notes,
    },
  });
  await recalculateObligation(updated.obligationId);
  return updated;
}

export async function deleteSettlement(settlement) {
  await prisma.accountingSettlement.delete({ where: { id: settlement.id } });
  await recalculateObligation(settlement.obligationId);
}

export function serializeObligation(o) {
  return {
    id: o.id,
    trip_id: o.tripId,
    direction: o.direction,
    party_type: o.partyType,
    party_id: o.partyId,
    party_name: o.partyName,
    source_type: o.sourceType,
    source_id: o.sourceId,
    expected_amount: num(o.expectedAmount),
    settled_amount: num(o.settledAmount),
    remaining_amount: Math.max(0, round2(num(o.expectedAmount) - num(o.settledAmount))),
    status: o.status,
    due_date: o.dueDate ? o.dueDate.toISOString().slice(0, 10) : null,
    notes: o.notes ?? null,
    settlements: (o.settlements || []).map(serializeSettlement),
  };
}

export function serializeSettlement(s) {
  return {
    id: s.id,
    obligation_id: s.obligationId,
    trip_id: s.tripId,
    amount: num(s.amount),
    settlement_type: s.settlementType,
    settlement_date: s.settlementDate ? s.settlementDate.toISOString().slice(0, 10) : null,
    method: s.method ?? null,
    notes: s.notes ?? null,
    created_by: s.createdBy ?? null,
    created_at: s.createdAt ? s.createdAt.toISOString() : null,
  };
}
