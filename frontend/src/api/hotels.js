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
