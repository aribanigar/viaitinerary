import { request } from "../utils/apiClient";

export const fetchComplementaryServices = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/complementary-services?${query}`, { token });
};

export const fetchComplementaryService = async (id, token) => {
  return request(`/complementary-services/${id}`, { token });
};

export const createComplementaryService = async (data, token) => {
  return request("/complementary-services", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
};

export const updateComplementaryService = async (id, data, token) => {
  return request(`/complementary-services/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(data),
  });
};

export const deleteComplementaryService = async (id, token) => {
  return request(`/complementary-services/${id}`, {
    method: "DELETE",
    token,
  });
};
