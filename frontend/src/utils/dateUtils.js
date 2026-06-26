/**
 * Formats a date string or object to dd/mm/yyyy
 * @param {Date|string} date
 * @returns {string}
 */
export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Parses a dd/mm/yyyy string into a Date object
 * @param {string} dateStr
 * @returns {Date|null}
 */
export const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date(dateStr); // Fallback to native parsing

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  return new Date(year, month, day);
};
