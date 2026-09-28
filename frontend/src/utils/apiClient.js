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

    // Only a 401 on a request that carried a session token means that
    // session is dead. A 401 on a tokenless request (a wrong password on the
    // login form) used to trip this too — wiping auth and bouncing the user
    // to the homepage. `token` lets AuthContext ignore a late 401 from an
    // older token after a newer login has already replaced it.
    if (response.status === 401 && token) {
      window.dispatchEvent(
        new CustomEvent("unauthorized-access", {
          detail: {
            message: data.message || "Session expired",
            status: response.status,
            token,
          },
        }),
      );
    }

    if (data.errors) {
      const firstError = Object.values(data.errors)[0][0];
      const err = new Error(firstError);
      err.status = response.status;
      throw err;
    }

    const err = new Error(
      data.message || `Request failed with status ${response.status}`,
    );
    err.status = response.status;
    throw err;
  }

  if (responseType === "blob") {
    return response.blob();
  }

  return response.json().catch(() => ({}));
};
