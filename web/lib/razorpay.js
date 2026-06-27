import crypto from "crypto";

const KEY = process.env.RAZORPAY_KEY || "";
const SECRET = process.env.RAZORPAY_SECRET || "";

export const razorpayConfigured = () => Boolean(KEY && SECRET);
export const razorpayKey = () => KEY;

/** Create a Razorpay order via the REST API (no SDK needed). */
export async function createRazorpayOrder({ amountPaise, currency = "INR", notes }) {
  const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receipt: `rcpt_${Date.now()}`, amount: amountPaise, currency, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.error?.description || "Razorpay order failed"), { status: res.status });
  }
  return data;
}

/** Verify the checkout signature: HMAC_SHA256(order_id + "|" + payment_id). */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!SECRET) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}
