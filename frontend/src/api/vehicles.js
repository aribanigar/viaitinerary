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
