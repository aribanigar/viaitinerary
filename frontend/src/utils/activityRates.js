// Activity rate sheet lookup, shared by the Trip Builder's activity picker
// (and anything else that prices a catalog activity for a date).
//
// A catalog activity carries a base adult/child price plus optional rate rows
// `price_sections: [{ option, cost, price, child_cost, child_price, valid_from, valid_to }]`.
// The rate for a date is the row for the chosen option whose validity covers
// that date, else that option's undated row, else the base prices.

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const covers = (s, date) => {
  if (!s.valid_from && !s.valid_to) return false;
  if (!date) return false;
  if (s.valid_from && date < String(s.valid_from).slice(0, 10)) return false;
  if (s.valid_to && date > String(s.valid_to).slice(0, 10)) return false;
  return true;
};

export const activityRateOptions = (activity) =>
  (activity?.price_sections || [])
    .map((s) => String(s.option || "").trim())
    .filter((v, i, all) => v && all.indexOf(v) === i);

export const findActivityRate = (activity, { option = "", date = "" } = {}) => {
  const base = {
    option: "",
    price: n(activity?.selling_price),
    childPrice: n(activity?.child_price),
    cost: n(activity?.cost),
    childCost: n(activity?.child_cost),
    seasonal: false,
  };
  if (!activity) return base;
  const rows = (activity.price_sections || []).filter(
    (s) => String(s.option || "").trim() === String(option || "").trim(),
  );
  const row = rows.find((s) => covers(s, date)) || rows.find((s) => !s.valid_from && !s.valid_to);
  if (!row) return { ...base, option: "" };
  return {
    option: String(row.option || "").trim(),
    price: n(row.price),
    childPrice: n(row.child_price),
    cost: n(row.cost),
    childCost: n(row.child_cost),
    seasonal: !!(row.valid_from || row.valid_to),
  };
};

// Day N of the trip as a yyyy-mm-dd date, and back.
export const dateForDay = (startDate, dayNumber) => {
  const d = parseInt(dayNumber, 10);
  if (!startDate || !d) return "";
  const t = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCDate(t.getUTCDate() + d - 1);
  return t.toISOString().slice(0, 10);
};

export const dayForDate = (startDate, date) => {
  if (!startDate || !date) return "";
  const a = Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "";
  return String(Math.round((b - a) / 86400000) + 1);
};

// What a trip activity row costs the client before margin: adults + children.
export const tripActivityTotal = (item) =>
  n(item?.pricePerTicket) * (parseInt(item?.ticketCount, 10) || 1) +
  n(item?.childPrice) * (parseInt(item?.childCount, 10) || 0);
