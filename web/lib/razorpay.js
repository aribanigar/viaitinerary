import crypto from "crypto";

// Platform keys (subscriptions). Client trip payments pass the AGENCY's own
// keys instead ({ keyId, keySecret } from AgencySetting) — money for a trip
// goes to the agency's Razorpay account, never the platform's.
const KEY = process.env.RAZORPAY_KEY || "";
const SECRET = process.env.RAZORPAY_SECRET || "";

export const razorpayConfigured = () => Boolean(KEY && SECRET);
export const razorpayKey = () => KEY;

const creds = (keys) => ({ id: keys?.keyId || KEY, secret: keys?.keySecret || SECRET });
const authHeader = (keys) => {
  const { id, secret } = creds(keys);
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
};

/** Create a Razorpay order via the REST API (no SDK needed). */
export async function createRazorpayOrder({ amountPaise, currency = "INR", notes, receipt }, keys) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: authHeader(keys), "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: receipt || `rcpt_${Date.now()}`, amount: amountPaise, currency, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.description || "Razorpay order failed"), { status: res.status });
  }
  return data;
}

/** Payments made against an order (to catch a payment whose checkout tab was closed). */
export async function fetchOrderPayments(orderId, keys) {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { Authorization: authHeader(keys) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || "Razorpay lookup failed");
  return Array.isArray(data?.items) ? data.items : [];
}

/** Verify the checkout signature: HMAC_SHA256(order_id + "|" + payment_id). */
export function verifyRazorpaySignature({ orderId, paymentId, signature }, keys) {
  const { secret } = creds(keys);
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}
