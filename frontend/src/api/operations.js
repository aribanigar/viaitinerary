import { request } from "../utils/apiClient";

// Phase 3 operations (web/lib/operations.js).
export async function fetchOperations(token, { from, days = 1 } = {}) {
  const q = new URLSearchParams({ days: String(days), ...(from ? { from } : {}) }).toString();
  return request(`/operations?${q}`, { token });
}

export async function fetchSupplierRequests(token, tripId) {
  return request(`/trips/${tripId}/supplier-requests`, { token });
}

/** body: { kinds?: ["hotel","cab"], ids?: { hotel: [], cab: [] }, email?: true, force?: false } */
export async function requestSupplierConfirmations(token, tripId, body = {}) {
  return request(`/trips/${tripId}/supplier-requests`, { method: "POST", token, body: JSON.stringify(body) });
}

/** body: { kind, id?, date?, group?, status?, reference?, note?, driver_name?, driver_phone?, vehicle_number? } */
export async function updateBooking(token, tripId, body) {
  return request(`/trips/${tripId}/bookings`, { method: "PATCH", token, body: JSON.stringify(body) });
}

export async function downloadVouchersPdf(token, tripId) {
  return request(`/trips/${tripId}/vouchers-pdf`, { token, responseType: "blob" });
}

// Public (no login): the supplier's confirm page.
export async function fetchSupplierBooking(token) {
  return request(`/public/supplier/${token}`);
}

export async function respondSupplierBooking(token, body) {
  return request(`/public/supplier/${token}`, { method: "POST", body: JSON.stringify(body) });
}
