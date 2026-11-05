import { daysBetween, shiftDateString } from "./dateShift.js";

// The plan window is the trip's start date plus its duration in nights, e.g.
// a 5-night trip starting 10 Oct runs 10 Oct through 15 Oct inclusive.
const DAY_RE = /^\d{4}-\d{2}-\d{2}/;
const isDay = (s) => DAY_RE.test(String(s || ""));

export const getPlanWindow = (startDate, duration) => {
  if (!isDay(startDate)) return null;
  const start = String(startDate).slice(0, 10);
  const nights = Math.max(0, parseInt(duration, 10) || 0);
  return { start, end: shiftDateString(start, nights) };
};

export const isWithinPlanWindow = (dateString, window) => {
  if (!window || !isDay(dateString)) return true;
  const offset = daysBetween(window.start, dateString);
  return offset >= 0 && offset <= daysBetween(window.start, window.end);
};

const short = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

// One line for a toast: the date, which side of the plan it falls on, and the plan's dates.
export const describeOutOfWindow = (dateString, window) => {
  const days = daysBetween(window.start, window.end) + 1;
  const side = daysBetween(window.start, dateString) < 0 ? "before" : "after";
  return `${short(dateString)} is ${side} your ${days}-day plan (${short(window.start)} - ${short(window.end)}). You can still save it, but check the date.`;
};

/** Warn (never block) when a picked date falls outside the trip's dates. */
export const warnIfOutsidePlan = (dateString, tripInfo, warn) => {
  const window = getPlanWindow(tripInfo?.startDate, tripInfo?.duration);
  if (window && !isWithinPlanWindow(dateString, window)) warn(describeOutOfWindow(dateString, window));
};
