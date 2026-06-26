import { request } from "../utils/apiClient";

export async function fetchShowcaseItems(activeOnly = false) {
  const query = activeOnly ? "?active_only=1" : "";
  return request(`/showcase-items${query}`);
}

export async function createShowcaseItem(token, data) {
  return request("/showcase-items", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function updateShowcaseItem(token, id, data) {
  return request(`/showcase-items/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteShowcaseItem(token, id) {
  return request(`/showcase-items/${id}`, {
    method: "DELETE",
    token,
  });
}
