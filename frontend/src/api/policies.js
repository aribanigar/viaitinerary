import { request } from "../utils/apiClient";

export async function fetchPolicies(token) {
  return request("/policies", { token });
}

export async function updatePolicies(token, policiesData) {
  return request("/policies", {
    method: "PUT",
    token,
    body: JSON.stringify(policiesData),
  });
}
