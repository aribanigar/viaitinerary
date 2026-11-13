import { request } from "../utils/apiClient";

// Account import from viakashmiritinerary.in (same person, same email).
const call = (token, body) =>
  request("/import/travel-agency", { method: "POST", token, body: JSON.stringify(body) });

export const connectTravelAgency = (token, { email, password }) =>
  call(token, { action: "connect", email, password });

export const runImportStep = (token, { handle, step, page }) =>
  call(token, { action: "step", handle, step, page });

export const finishTravelAgencyImport = (token, handle) => call(token, { action: "finish", handle });
