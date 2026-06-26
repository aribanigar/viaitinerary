import { request } from "../utils/apiClient";

export const getNotifications = (params = {}) => {
  const token = localStorage.getItem("token");
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.perPage) query.append("per_page", params.perPage);
  if (params.search) query.append("search", params.search);

  const url = query.toString()
    ? `/notifications?${query.toString()}`
    : "/notifications";

  return request(url, { token });
};

/**
 * Lightweight endpoint — returns only { unread_count: N }.
 * Used for header badge polling; does not load notification data.
 */
export const getUnreadCount = () => {
  const token = localStorage.getItem("token");
  return request("/notifications/unread-count", { token });
};

export const markAsRead = (id) => {
  const token = localStorage.getItem("token");
  return request(`/notifications/${id}/read`, {
    method: "POST",
    token,
  });
};

export const markAllAsRead = () => {
  const token = localStorage.getItem("token");
  return request("/notifications/read-all", {
    method: "POST",
    token,
  });
};

export const deleteNotification = (id) => {
  const token = localStorage.getItem("token");
  return request(`/notifications/${id}`, {
    method: "DELETE",
    token,
  });
};
