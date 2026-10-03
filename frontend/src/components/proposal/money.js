// Amount formatting for the public proposal page: Indian digit grouping for
// rupees (₹1,43,640), whole units, currency symbol from the trip.
export function formatMoney(amount, symbol = "₹") {
  const n = Number(amount);
  const value = Number.isFinite(n) ? Math.round(n) : 0;
  const indian = !symbol || symbol === "₹";
  return `${symbol || "₹"}${new Intl.NumberFormat(indian ? "en-IN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export const KIND_LABEL = { advance: "Advance", balance: "Balance", full: "Full payment" };
export const METHOD_LABEL = {
  razorpay: "Online",
  upi: "UPI",
  bank: "Bank transfer",
  cash: "Cash",
  card: "Card",
};

/** Friendly text for a failed payment API call. */
export function paymentErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (err?.status === 429) return "Please wait a minute and try again.";
  if (err?.status === 422) return err.message || "There's nothing to pay for this right now.";
  if (err?.status === 404) return "This proposal link is no longer valid.";
  return err?.message || fallback;
}
