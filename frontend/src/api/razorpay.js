import { request } from "../utils/apiClient";

/**
 * Create a Razorpay order on the backend.
 * @param {number} amount - Amount in INR.
 * @param {string} token - Auth token.
 */
export async function createRazorpayOrder(amount, token) {
  return request("/razorpay/create-order", {
    method: "POST",
    token,
    body: JSON.stringify({ amount }),
  });
}

/**
 * Verify Razorpay payment on the backend.
 * @param {Object} paymentData - {razorpay_order_id, razorpay_payment_id, razorpay_signature}
 * @param {string} token - Auth token.
 */
export async function verifyRazorpayPayment(paymentData, token) {
  return request("/razorpay/verify-payment", {
    method: "POST",
    token,
    body: JSON.stringify(paymentData),
  });
}
