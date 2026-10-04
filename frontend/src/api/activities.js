import { request } from "../utils/apiClient";

export const fetchActivities = async (token, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/activities?${query}`, { token });
};

export const fetchActivity = async (id, token) => {
  return request(`/activities/${id}`, { token });
};

export const createActivity = async (data, token) => {
  return request("/activities", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
};

export const updateActivity = async (id, data, token) => {
  return request(`/activities/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(data),
  });
};

export const deleteActivity = async (id, token) => {
  return request(`/activities/${id}`, {
    method: "DELETE",
    token,
  });
};

export const getActivityUsage = async (id, token) => request(`/activities/${id}/usage`, { token });

export const getActivityBlackouts = async (id, token) => request(`/activities/${id}/blackouts`, { token });

export const createActivityBlackout = async (id, data, token) =>
  request(`/activities/${id}/blackouts`, { method: "POST", token, body: JSON.stringify(data) });

export const deleteActivityBlackout = async (id, blackoutId, token) =>
  request(`/activities/${id}/blackouts/${blackoutId}`, { method: "DELETE", token });
