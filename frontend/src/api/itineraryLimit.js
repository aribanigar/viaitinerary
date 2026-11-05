import { request } from "../utils/apiClient";

export async function fetchItineraryLimit(token) {
  return request("/itinerary-limit", { token });
}

export async function fetchItineraryLimitSettings(token) {
  return request("/super-admin/itinerary-limit", { token });
}

export async function updateItineraryLimitSettings(token, settings) {
  return request("/super-admin/itinerary-limit", {
    method: "PUT",
    token,
    body: JSON.stringify(settings),
  });
}
