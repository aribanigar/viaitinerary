// Shared by DatePicker.jsx (the light stand-in) and DatePickerFull.jsx (the
// real calendar): how a value is read and shown, so both look the same.

// Legacy flatpickr-like formats used in the project → date-fns tokens.
export function normalizePickerFormat(formatValue, enableTime = false) {
  if (!formatValue) return enableTime ? "dd-MM-yyyy HH:mm" : "dd-MM-yyyy";
  return formatValue
    .replace(/Y/g, "yyyy")
    .replace(/m/g, "MM")
    .replace(/d/g, "dd")
    .replace(/H/g, "HH")
    .replace(/i/g, "mm");
}

// "YYYY-MM-DD[ HH:mm]", "DD-MM-YYYY[ HH:mm]", a Date or anything Date can read.
export function parsePickerDate(val) {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") {
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = val.split(/[- T:]/);
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(parts[3] || 0), Number(parts[4] || 0));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parts = val.split(/[- :]/);
    if (parts.length >= 3 && parts[2].length === 4) {
      const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(parts[3] || 0), Number(parts[4] || 0));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(val);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

const pad = (n) => String(n).padStart(2, "0");
// The date-fns tokens the picker formats use (yyyy MM dd HH mm), no library.
export function formatPickerDate(date, fmt) {
  if (!date) return "";
  return fmt.replace(/yyyy|MM|dd|HH|mm/g, (t) =>
    t === "yyyy" ? String(date.getFullYear())
    : t === "MM" ? pad(date.getMonth() + 1)
    : t === "dd" ? pad(date.getDate())
    : t === "HH" ? pad(date.getHours())
    : pad(date.getMinutes()),
  );
}
