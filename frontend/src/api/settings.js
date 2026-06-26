import { request } from "../utils/apiClient";

export async function fetchSettings(token) {
  return request("/settings", { token });
}

export async function updateSettings(token, settingsData) {
  return request("/settings", {
    method: "PUT",
    token,
    body: JSON.stringify(settingsData),
  });
}

export async function verifyIfsc(token, ifscCode) {
  const normalized = String(ifscCode || "").trim();
  return request(
    `/settings/verify-ifsc?ifsc=${encodeURIComponent(normalized)}`,
    { token },
  );
}

export async function fetchInclusionExclusions(token) {
  return request("/inclusion-exclusions", { token });
}

export async function createInclusionExclusion(token, data) {
  return request("/inclusion-exclusions", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function updateInclusionExclusion(token, id, data) {
  return request(`/inclusion-exclusions/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteInclusionExclusion(token, id) {
  return request(`/inclusion-exclusions/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function bulkImport(token, file) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/bulk-import", {
    method: "POST",
    token,
    body: formData,
  });
}

export async function downloadBulkTemplate(token) {
  return request("/bulk-import/template", {
    token,
    responseType: "blob",
  });
}

export async function bulkExport(token) {
  return request("/bulk-export", {
    token,
    responseType: "blob",
  });
}

export async function sendSmtpTest(token, testEmail) {
  return request("/settings/smtp/test", {
    method: "POST",
    token,
    body: JSON.stringify({ testEmail }),
  });
}
