import { request } from "../utils/apiClient";

export const getBookingCalendar = async (month, token) => {
  const query = month ? `?month=${month}` : "";
  return request(`/accommodations/calendar${query}`, { token });
};
