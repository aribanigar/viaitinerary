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

// Hotel tags (web/app/api/ching/hotel-tags): what each hotel is like, for Ching's meaning tree.
export async function fetchHotelTags(token) {
  return request("/ching/hotel-tags", { token });
}

/** { hotel_id, tags } replaces a hotel's tags; { hotel_id, add, remove } changes them. */
export async function saveHotelTags(token, body) {
  return request("/ching/hotel-tags", { method: "PUT", token, body: JSON.stringify(body) });
}

// The agent's own conversation with Ching (web/app/api/ching/conversation).
export async function fetchChingConversation(token) {
  return request("/ching/conversation", { token });
}

export async function saveChingConversation(token, conversation) {
  return request("/ching/conversation", { method: "PUT", token, body: JSON.stringify(conversation) });
}

export async function clearChingConversation(token) {
  return request("/ching/conversation", { method: "DELETE", token });
}
