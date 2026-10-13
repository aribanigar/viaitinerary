import { request } from "../utils/apiClient";

export async function fetchAccountingLedger(token, params = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return request(`/accounting/ledger${suffix}`, { token });
}

export async function fetchAccountingTripLedger(token, tripId) {
  return request(`/accounting/ledger/${tripId}`, { token });
}

export async function createAccountingSettlement(token, payload) {
  return request("/accounting/settlements", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateAccountingSettlement(token, settlementId, payload) {
  return request(`/accounting/settlements/${settlementId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteAccountingSettlement(token, settlementId) {
  return request(`/accounting/settlements/${settlementId}`, {
    method: "DELETE",
    token,
  });
}

// Reports: every trip in the range, aggregated on the server (lib/report.js).
// params: { from, to (YYYY-MM-DD), basis: "travel" | "booking", tz }
export async function fetchAccountingReport(token, params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/accounting/report${query ? `?${query}` : ""}`, { token });
}
