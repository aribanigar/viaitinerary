import { request } from "../utils/apiClient";

export const getHotels = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/hotels?${query}`, { token });
};

export const getHotel = async (id, token) => {
  return request(`/hotels/${id}`, { token });
};

export const createHotel = async (hotelData, token) => {
  return request("/hotels", {
    method: "POST",
    token,
    body: JSON.stringify(hotelData),
  });
};

export const updateHotel = async (id, hotelData, token) => {
  return request(`/hotels/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(hotelData),
  });
};

export const deleteHotel = async (id, token) => {
  return request(`/hotels/${id}`, {
    method: "DELETE",
    token,
  });
};

export const getHotelUsage = async (id, token) => {
  return request(`/hotels/${id}/usage`, { token });
};

export const requestHotelAvailability = async (id, token) => {
  return request(`/hotels/${id}/request`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
};

export const getHotelBlackouts = async (id, token) => {
  return request(`/hotels/${id}/blackouts`, { token });
};

export const createHotelBlackout = async (id, blackoutData, token) => {
  return request(`/hotels/${id}/blackouts`, {
    method: "POST",
    token,
    body: JSON.stringify(blackoutData),
  });
};

export const deleteHotelBlackout = async (id, blackoutId, token) => {
  return request(`/hotels/${id}/blackouts/${blackoutId}`, {
    method: "DELETE",
    token,
  });
};

export const getHotelB2BRates = async (id, token) => {
  return request(`/hotels/${id}/b2b-rates`, { token });
};

export const importB2BHotels = async (token) => {
  return request("/hotels/import-b2b", {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
};

// Ching's hotel search (web/app/api/hotels/search): the agency's own hotels,
// filtered and ranked with real rates for the dates and real availability.
export const searchHotelInventory = async (token, params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return request(`/hotels/search${q ? `?${q}` : ""}`, { token });
};
