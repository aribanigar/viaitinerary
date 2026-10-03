import { request } from "../utils/apiClient";

export async function fetchTrips(token, params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/trips?${query}`, { token });
}

export async function fetchTrip(token, id) {
  return request(`/trips/${id}`, { token });
}

export async function createTrip(token, tripData) {
  return request("/trips", {
    method: "POST",
    token,
    body: JSON.stringify(tripData),
  });
}

export async function updateTrip(token, id, tripData) {
  return request(`/trips/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(tripData),
  });
}

export async function deleteTrip(token, id) {
  return request(`/trips/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function downloadTripPdf(token, id) {
  return request(`/trips/${id}/pdf`, {
    token,
    responseType: "blob",
  });
}

export async function downloadConfirmationPdf(token, id) {
  return request(`/trips/${id}/confirmation-pdf`, {
    token,
    responseType: "blob",
  });
}

export async function downloadPaymentVoucherPdf(token, id) {
  return request(`/trips/${id}/payment-voucher-pdf`, {
    token,
    responseType: "blob",
  });
}

export async function downloadInvoicePdf(token, id) {
  return request(`/trips/${id}/invoice-pdf`, {
    token,
    responseType: "blob",
  });
}

export async function sendConfirmationEmail(token, id, recipient = "client") {
  return request(`/trips/${id}/send-confirmation`, {
    method: "POST",
    token,
    body: JSON.stringify({ recipient }),
  });
}

export async function duplicateTrip(token, id) {
  return request(`/trips/${id}/duplicate`, {
    method: "POST",
    token,
  });
}

export async function fetchSubscriptionStatus(token) {
  return request("/subscription/status", { token });
}

export async function fetchBuilderInit(token, tripId = null) {
  const url = tripId ? `/builder/init?trip_id=${tripId}` : "/builder/init";
  return request(url, { token });
}

export async function fetchTripRevisions(token, id) {
  return request(`/trips/${id}/revisions`, { token });
}

export async function logTripSend(token, id, trigger) {
  return request(`/trips/${id}/log-send`, {
    method: "POST",
    token,
    body: JSON.stringify({ trigger }),
  });
}

// Email the itinerary PDF to the signed-in user. `pdfBase64` is the exact PDF
// exported from the live preview; omit it to have the server render one.
export async function emailItineraryToMe(token, id, { pdfBase64, filename } = {}) {
  return request(`/trips/${id}/email-itinerary`, {
    method: "POST",
    token,
    body: JSON.stringify({ pdf_base64: pdfBase64 || null, filename }),
  });
}

// Client proposal link (/p/:token) — status, and create/send it.
export async function fetchProposal(token, id) {
  return request(`/trips/${id}/proposal`, { token });
}

// body: {} (just ensure a link) | { send: "whatsapp" } | { send: "email", pdf_base64 } | { regenerate: true }
export async function sendProposal(token, id, body = {}) {
  return request(`/trips/${id}/proposal`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

// Client-facing Excel quotation (Summary / Itinerary / Hotels / Transport / Activities).
export async function downloadQuotationExcel(token, id) {
  return request(`/trips/${id}/quotation-xlsx`, { token, responseType: "blob" });
}

// Email the client a reminder now. kind: "proposal" | "payment" → { sent_to, kind }
export async function sendReminder(token, id, kind = "proposal") {
  return request(`/trips/${id}/remind`, { method: "POST", token, body: JSON.stringify({ kind }) });
}

// Dashboard sales pipeline: stage counts + trips that need attention.
export async function fetchSalesPipeline(token) {
  return request("/sales/pipeline", { token });
}

// Client payments for a trip: schedule, payments, "I've paid" claims.
export async function fetchTripPayments(token, id) {
  return request(`/trips/${id}/payments`, { token });
}

// Set (number) or clear (null) the trip's advance-amount override.
export async function setTripAdvance(token, id, advanceAmount) {
  return request(`/trips/${id}/payments`, {
    method: "POST",
    token,
    body: JSON.stringify({ advance_amount: advanceAmount }),
  });
}

// Verify or reject a client's "I've paid" claim. action: "verify" | "reject"
export async function decideClientPayment(token, id, paymentId, action) {
  return request(`/trips/${id}/payments/${paymentId}`, {
    method: "POST",
    token,
    body: JSON.stringify({ action }),
  });
}
