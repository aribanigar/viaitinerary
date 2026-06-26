import { request } from "../utils/apiClient";

/**
 * Submit a new lead inquiry (public endpoint, no auth required)
 */
export const submitLeadInquiry = async (agencyId, data) => {
  return request(`/lead-inquiries/${agencyId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Submit a public lead inquiry (no agency, goes to super admin)
 */
export const submitPublicLeadInquiry = async (data) => {
  return request(`/public-inquiries`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Get all lead inquiries for the authenticated user
 */
export const getLeadInquiries = async (token, filters = {}) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.append("status", filters.status);
  }

  if (filters.search) {
    params.append("search", filters.search);
  }

  if (filters.start_date) {
    params.append("start_date", filters.start_date);
  }

  if (filters.end_date) {
    params.append("end_date", filters.end_date);
  }

  if (filters.per_page) {
    params.append("per_page", filters.per_page);
  }

  if (filters.page) {
    params.append("page", filters.page);
  }

  const queryString = params.toString();
  const url = queryString
    ? `/lead-inquiries?${queryString}`
    : "/lead-inquiries";

  return request(url, { token });
};

/**
 * Get assignable users (admin + active team members) for lead assignment
 */
export const getLeadAssignableMembers = async (token) => {
  return request("/lead-inquiries/assignable-members", { token });
};

/**
 * Store a new manual lead inquiry (admin only)
 */
export const createManualLeadInquiry = async (token, data) => {
  return request("/lead-inquiries", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
};

/**
 * Bulk import lead inquiries from Excel
 */
export const importLeadInquiries = async (token, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return request("/lead-inquiries-bulk-import", {
    method: "POST",
    token,
    body: formData,
  });
};

/**
 * Update a lead inquiry's status and notes
 */
export const updateLeadInquiry = async (token, id, data) => {
  return request(`/lead-inquiries/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
};

/**
 * Delete a lead inquiry
 */
export const deleteLeadInquiry = async (token, id) => {
  return request(`/lead-inquiries/${id}`, {
    method: "DELETE",
    token,
  });
};

/**
 * Convert a trip inquiry to a trip
 */
export const convertInquiryToTrip = async (token, id) => {
  return request(`/lead-inquiries/${id}/convert-to-trip`, {
    method: "POST",
    token,
  });
};
