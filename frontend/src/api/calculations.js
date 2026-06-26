import { request } from "../utils/apiClient";

export const getCalculations = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/calculations?${query}`, { token });
};

export const getCalculation = async (token, id) => {
  return request(`/calculations/${id}`, { token });
};

export const createCalculation = async (token, data) => {
  return request("/calculations", {
    token,
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateCalculation = async (token, id, data) => {
  return request(`/calculations/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCalculation = async (token, id) => {
  return request(`/calculations/${id}`, {
    token,
    method: "DELETE",
  });
};

export const downloadCalculationPdf = async (token, id) => {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  const response = await fetch(`${API_URL}/calculations/${id}/pdf`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to download PDF");
  }

  return response.blob();
};
