import { request } from "../utils/apiClient";

export async function submitDemoRequest(demoData) {
  return request("/demo-requests", {
    method: "POST",
    body: JSON.stringify(demoData),
  });
}

export async function fetchDemoRequests(token, params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/demo-requests?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateDemoRequestStatus(id, status, token) {
  return request(`/demo-requests/${id}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
}

export async function deleteDemoRequest(id, token) {
  return request(`/demo-requests/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
