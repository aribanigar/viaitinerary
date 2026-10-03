import { request } from "../utils/apiClient";

// Ching's memory (web/app/api/ching/memory): learned habits + what the agency told it.
export async function fetchChingMemory(token) {
  return request("/ching/memory", { token });
}

export async function rememberChing(token, { kind, key, value }) {
  return request("/ching/memory", { method: "POST", token, body: JSON.stringify({ kind, key, value }) });
}

export async function forgetChing(token, body = {}) {
  return request("/ching/memory", { method: "DELETE", token, body: JSON.stringify(body) });
}
