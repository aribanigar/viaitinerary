import { request } from "../utils/apiClient";

export const fetchDestinations = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/destinations?${query}`, { token });
};

export const fetchDestination = async (id, token) => {
  return request(`/destinations/${id}`, { token });
};

export const createDestination = async (destinationData, token) => {
  return request("/destinations", {
    method: "POST",
    token,
    body: JSON.stringify(destinationData),
  });
};

export const updateDestination = async (id, destinationData, token) => {
  return request(`/destinations/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(destinationData),
  });
};

export const deleteDestination = async (id, token) => {
  return request(`/destinations/${id}`, {
    method: "DELETE",
    token,
  });
};
