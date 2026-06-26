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
