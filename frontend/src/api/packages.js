import { request } from "../utils/apiClient";

export async function fetchPackages(token, params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/packages${query ? `?${query}` : ""}`, { token });
}

export async function fetchPackage(token, id) {
  return request(`/packages/${id}`, { token });
}

export async function createPackage(token, data) {
  return request("/packages", { method: "POST", token, body: JSON.stringify(data) });
}

export async function updatePackage(token, id, data) {
  return request(`/packages/${id}`, { method: "PUT", token, body: JSON.stringify(data) });
}

export async function deletePackage(token, id) {
  return request(`/packages/${id}`, { method: "DELETE", token });
}

// Instantiate a package into a real client trip.
export async function usePackage(token, id, clientData) {
  return request(`/packages/${id}/use`, {
    method: "POST",
    token,
    body: JSON.stringify(clientData),
  });
}
