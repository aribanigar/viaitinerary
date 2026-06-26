const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const DEVICE_STORAGE_KEY = "device_id";

const createFallbackDeviceId = () => {
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateDeviceId = () => {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : createFallbackDeviceId();

  window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
};

export const request = async (endpoint, options = {}) => {
  const { token, responseType = "json", ...customConfig } = options;
  const deviceId = getOrCreateDeviceId();

  const config = {
    ...customConfig,
    headers: {
      Accept: "application/json",
      "X-Device-ID": deviceId,
      ...(token && { Authorization: `Bearer ${token}` }),
      ...customConfig.headers,
    },
  };

  // Only set Content-Type if it's not FormData (fetch sets it automatically for FormData)
  if (responseType === "json" && !(customConfig.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    // Check for authentication/authorization errors
    if (response.status === 401) {
      // Dispatch a custom event for status changes/logouts
      window.dispatchEvent(
        new CustomEvent("unauthorized-access", {
          detail: {
            message: data.message || "Session expired",
            status: response.status,
          },
        }),
      );
    }

    if (data.errors) {
      const firstError = Object.values(data.errors)[0][0];
      throw new Error(firstError);
    }

    throw new Error(
      data.message || `Request failed with status ${response.status}`,
    );
  }

  if (responseType === "blob") {
    return response.blob();
  }

  return response.json().catch(() => ({}));
};
