// Reports (Accounting → Reports): one pass over the trips in a date range and
// their accounting obligations. Pure — no Prisma — so it can be tested with
// plain objects (scripts/report.test.mjs); app/api/accounting/report loads
// the rows and refreshes stale obligations first.
//
// Definitions (shown on the page, keep them in step):
//  - booked   = status confirmed/completed, or any money received from the client
//  - quote    = any other open trip (pending / draft / …)
//  - lost     = rejected / cancelled
//  - sales    = quoted price (trip.cost, GST included) of booked trips
//  - net      = sales − GST
//  - costs    = hotel + cab payables (accounting obligations) + activity costs
//  - profit   = net − costs  (margin = profit / net)
//  - collected / outstanding = client receipts / what's still owed (booked)
//  - hotel / cab due = supplier payables not yet paid (booked)

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n) => Math.round(n * 100) / 100;

export const LOST_STATUSES = new Set(["rejected", "cancelled", "canceled"]);
const BOOKED_STATUSES = new Set(["confirmed", "completed"]);

export function tripStage(trip) {
  const status = String(trip.status || "").toLowerCase();
  if (LOST_STATUSES.has(status)) return "lost";
  const received = num(trip.paidAmount) - num(trip.refundedAmount) > 0;
  if (BOOKED_STATUSES.has(status) || received) return "booked";
  return "quote";
}

function activityCost(trip) {
  return (trip.tripActivities || []).reduce(
    (sum, a) => sum + num(a.costPerTicket) * (num(a.ticketCount) || 0) + num(a.childCost) * (num(a.childCount) || 0),
    0,
  );
}

const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Month bucket "YYYY-MM" of the trip's report date (start date or booking date in the agent's zone). */
function monthOf(trip, basis, tzOffsetMin) {
  if (basis === "booking") {
    if (!trip.createdAt) return null;
    return new Date(new Date(trip.createdAt).getTime() - tzOffsetMin * 60000).toISOString().slice(0, 7);
  }
  return trip.startDate ? new Date(trip.startDate).toISOString().slice(0, 7) : null;
}

/**
 * trips: rows with { id, tripId, tripTitle, clientName, clientPhone, destination,
 * status, startDate, createdAt, currency, cost, gstAmount, includeGst, paidAmount,
 * refundedAmount, tripActivities[], obligations[] }.
 * now: Date (for overdue); tzOffsetMin: Date#getTimezoneOffset of the agent.
 */
export function buildReport(trips, { basis = "travel", now = new Date(), tzOffsetMin = -330 } = {}) {
  const today = ymd(now);
  const kpi = {
    trips: 0, booked: 0, quotes: 0, lost: 0,
    sales: 0, gst: 0, net: 0, costs: 0, hotelCost: 0, cabCost: 0, activityCost: 0, profit: 0, margin: 0,
    collected: 0, outstanding: 0, overdue: 0,
    hotelDue: 0, cabDue: 0, hotelPaid: 0, cabPaid: 0,
    quoteValue: 0, lostValue: 0, avgBooking: 0, conversion: 0,
  };
  const months = new Map();
  const destinations = new Map();
  const clients = new Map();
  const vendors = { hotels: new Map(), cabs: new Map() };
  const receivables = [];
  const currencies = new Set();

  for (const trip of trips) {
    kpi.trips += 1;
    const stage = tripStage(trip);
    const sales = num(trip.cost);
    if (trip.currency) currencies.add(String(trip.currency));

    if (stage === "lost") {
      kpi.lost += 1;
      kpi.lostValue += sales;
      continue;
    }
    if (stage === "quote") {
      kpi.quotes += 1;
      kpi.quoteValue += sales;
      continue;
    }

    kpi.booked += 1;
    const obligations = trip.obligations || [];
    const gst = trip.includeGst === false ? 0 : num(trip.gstAmount);
    const net = sales - gst;
    const received = Math.max(0, num(trip.paidAmount) - num(trip.refundedAmount));
    const outstanding = Math.max(0, sales - received);

    let hotelCost = 0, cabCost = 0;
    for (const o of obligations) {
      if (o.direction !== "payable") continue;
      const expected = num(o.expectedAmount);
      const settled = num(o.settledAmount);
      if (o.partyType === "hotel") {
        hotelCost += expected;
        kpi.hotelPaid += settled;
        kpi.hotelDue += Math.max(0, expected - settled);
      } else if (o.partyType === "cab") {
        cabCost += expected;
        kpi.cabPaid += settled;
        kpi.cabDue += Math.max(0, expected - settled);
      }
      if ((o.partyType === "hotel" || o.partyType === "cab") && expected > 0) {
        const bucket = o.partyType === "hotel" ? vendors.hotels : vendors.cabs;
        const key = `${o.partyType}:${o.partyId ?? o.partyName ?? "?"}`;
        if (!bucket.has(key)) {
          bucket.set(key, { party_id: o.partyId ?? null, party_name: o.partyName || (o.partyType === "hotel" ? "Hotel" : "Cab"), expected_total: 0, settled_total: 0, trips: [] });
        }
        const v = bucket.get(key);
        v.expected_total += expected;
        v.settled_total += settled;
        const row = v.trips.find((t) => t.trip_id === trip.tripId);
        if (row) {
          row.expected_amount += expected;
          row.settled_amount += settled;
        } else {
          v.trips.push({ trip_id: trip.tripId, trip_title: trip.tripTitle, start_date: ymd(trip.startDate), expected_amount: expected, settled_amount: settled });
        }
      }
    }
    const actCost = activityCost(trip);
    const costs = hotelCost + cabCost + actCost;
    const profit = net - costs;

    kpi.sales += sales;
    kpi.gst += gst;
    kpi.net += net;
    kpi.hotelCost += hotelCost;
    kpi.cabCost += cabCost;
    kpi.activityCost += actCost;
    kpi.costs += costs;
    kpi.profit += profit;
    kpi.collected += received;
    kpi.outstanding += outstanding;

    const start = ymd(trip.startDate);
    const travelled = start && start <= today;
    if (outstanding > 0.5) {
      if (travelled) kpi.overdue += outstanding;
      receivables.push({
        trip_id: trip.tripId,
        trip_title: trip.tripTitle,
        client_name: trip.clientName || "",
        client_phone: trip.clientPhone || "",
        start_date: start,
        sales: r2(sales),
        received: r2(received),
        outstanding: r2(outstanding),
        overdue: !!travelled,
        days_to_travel: start ? Math.round((Date.parse(start) - Date.parse(today)) / 86400000) : null,
      });
    }

    const month = monthOf(trip, basis, tzOffsetMin);
    if (month) {
      if (!months.has(month)) months.set(month, { month, trips: 0, sales: 0, net: 0, costs: 0, profit: 0, collected: 0 });
      const m = months.get(month);
      m.trips += 1;
      m.sales += sales;
      m.net += net;
      m.costs += costs;
      m.profit += profit;
      m.collected += received;
    }

    const dest = String(trip.destination || "").trim() || "—";
    const dKey = dest.toLowerCase();
    if (!destinations.has(dKey)) destinations.set(dKey, { destination: dest, trips: 0, sales: 0, profit: 0 });
    const d = destinations.get(dKey);
    d.trips += 1;
    d.sales += sales;
    d.profit += profit;

    const client = String(trip.clientName || "").trim();
    if (client) {
      const cKey = `${client.toLowerCase()}|${String(trip.clientPhone || "").replace(/\D/g, "").slice(-10)}`;
      if (!clients.has(cKey)) clients.set(cKey, { client_name: client, client_phone: trip.clientPhone || "", trips: 0, sales: 0, outstanding: 0 });
      const c = clients.get(cKey);
      c.trips += 1;
      c.sales += sales;
      c.outstanding += outstanding;
    }
  }

  kpi.margin = kpi.net > 0 ? (kpi.profit / kpi.net) * 100 : 0;
  kpi.avgBooking = kpi.booked ? kpi.sales / kpi.booked : 0;
  const decided = kpi.booked + kpi.lost + kpi.quotes;
  kpi.conversion = decided ? (kpi.booked / decided) * 100 : 0;
  for (const k of Object.keys(kpi)) kpi[k] = r2(kpi[k]);

  const round = (o, keys) => {
    for (const k of keys) o[k] = r2(o[k]);
    return o;
  };
  const vendorList = (map) =>
    [...map.values()]
      .map((v) => ({
        ...round(v, ["expected_total", "settled_total"]),
        due: r2(Math.max(0, v.expected_total - v.settled_total)),
        trips_count: v.trips.length,
      }))
      .sort((a, b) => b.due - a.due || b.expected_total - a.expected_total);

  return {
    basis,
    kpi,
    currencies: [...currencies],
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => round(m, ["sales", "net", "costs", "profit", "collected"])),
    destinations: [...destinations.values()].sort((a, b) => b.sales - a.sales).slice(0, 10).map((d) => round(d, ["sales", "profit"])),
    clients: [...clients.values()].sort((a, b) => b.sales - a.sales).slice(0, 10).map((c) => round(c, ["sales", "outstanding"])),
    receivables: receivables.sort((a, b) => (b.overdue - a.overdue) || String(a.start_date || "9").localeCompare(String(b.start_date || "9"))),
    vendors: { hotels: vendorList(vendors.hotels), cabs: vendorList(vendors.cabs) },
  };
}
