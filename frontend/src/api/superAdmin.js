import { request } from "../utils/apiClient";

export const fetchSuperAdminDashboard = async (token) => {
  return request("/super-admin/dashboard", { token });
};

export const fetchSuperAdminBusinesses = async (token, params = {}) => {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.perPage) query.append("per_page", params.perPage);
  if (params.search) query.append("search", params.search);
  if (params.all) query.append("all", "1");

  const url = query.toString()
    ? `/super-admin/businesses?${query.toString()}`
    : "/super-admin/businesses";

  return request(url, { token });
};

export const fetchSuperAdminBusinessDetails = async (token, businessId) => {
  return request(`/super-admin/businesses/${businessId}`, { token });
};

export const createSuperAdminBusiness = async (token, businessData) => {
  return request("/super-admin/businesses", {
    method: "POST",
    token,
    body: JSON.stringify(businessData),
  });
};

export const updateSuperAdminBusiness = async (token, userId, businessData) => {
  return request(`/super-admin/businesses/${userId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(businessData),
  });
};

export const deleteSuperAdminBusiness = async (token, userId) => {
  return request(`/super-admin/businesses/${userId}`, {
    method: "DELETE",
    token,
  });
};

export const updateBusinessStatus = async (token, userId, status) => {
  return request(`/super-admin/businesses/${userId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
};

export const toggleBypassSubscription = async (token, userId) => {
  return request(`/super-admin/businesses/${userId}/bypass-subscription`, {
    method: "PATCH",
    token,
  });
};

export const assignBusinessIncludedMember = async (
  token,
  businessId,
  memberUserId,
) => {
  return request(`/super-admin/businesses/${businessId}/assign-member`, {
    method: "POST",
    token,
    body: JSON.stringify({ member_user_id: memberUserId }),
  });
};

export const fetchPublicInquiries = async (token, filters = {}) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.append("status", filters.status);
  }

  if (filters.assigned && filters.assigned !== "all") {
    params.append("assigned", filters.assigned);
  }

  if (filters.start_date) {
    params.append("start_date", filters.start_date);
  }

  if (filters.end_date) {
    params.append("end_date", filters.end_date);
  }

  if (filters.search) {
    params.append("search", filters.search);
  }

  if (filters.page) {
    params.append("page", filters.page);
  }

  if (filters.per_page) {
    params.append("per_page", filters.per_page);
  }

  const queryString = params.toString();
  const url = queryString
    ? `/super-admin/public-inquiries?${queryString}`
    : "/super-admin/public-inquiries";

  return request(url, { token });
};

export const assignInquiry = async (token, inquiryId, adminId) => {
  return request(`/super-admin/public-inquiries/${inquiryId}/assign`, {
    method: "POST",
    token,
    body: JSON.stringify({ admin_id: adminId }),
  });
};
