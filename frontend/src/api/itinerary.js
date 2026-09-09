import { request } from "../utils/apiClient";

export const generateItinerary = async (input, token) => {
  return request("/itinerary/generate", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
};

export const commitItinerary = async (input, token) => {
  return request("/itinerary/generate/commit", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
};
