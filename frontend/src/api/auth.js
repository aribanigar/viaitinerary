import { request } from "../utils/apiClient";

export async function signup(userData) {
  return request("/signup", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function login(credentials) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function logout(token) {
  return request("/logout", {
    method: "POST",
    token,
  });
}

export async function getMe(token) {
  return request("/user", { token });
}

export async function sendOtp(email) {
  return request("/otp/send", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function forgotPassword(email) {
  return request("/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(resetData) {
  return request("/password/reset", {
    method: "POST",
    body: JSON.stringify(resetData),
  });
}

export async function updateProfile(userData, token) {
  return request("/user/update-profile", {
    method: "POST",
    token,
    body: JSON.stringify(userData),
  });
}
