import { request } from "../utils/apiClient";

export const fetchVehicles = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/vehicles?${query}`, { token });
};

export const fetchVehicle = async (id, token) => {
  return request(`/vehicles/${id}`, { token });
};

export const createVehicle = async (vehicleData, token) => {
  return request("/vehicles", {
    method: "POST",
    token,
    body: JSON.stringify(vehicleData),
  });
};

export const updateVehicle = async (id, vehicleData, token) => {
  return request(`/vehicles/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(vehicleData),
  });
};

export const deleteVehicle = async (id, token) => {
  return request(`/vehicles/${id}`, {
    method: "DELETE",
    token,
  });
};

export const getVehicleUsage = async (id, token) => {
  return request(`/vehicles/${id}/usage`, { token });
};

export const requestVehicleAvailability = async (id, token) => {
  return request(`/vehicles/${id}/request`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
};

export const getVehicleBlackouts = async (id, token) => {
  return request(`/vehicles/${id}/blackouts`, { token });
};

export const createVehicleBlackout = async (id, blackoutData, token) => {
  return request(`/vehicles/${id}/blackouts`, {
    method: "POST",
    token,
    body: JSON.stringify(blackoutData),
  });
};

export const deleteVehicleBlackout = async (id, blackoutId, token) => {
  return request(`/vehicles/${id}/blackouts/${blackoutId}`, {
    method: "DELETE",
    token,
  });
};
