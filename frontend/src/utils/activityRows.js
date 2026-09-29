// Shared by both itinerary templates (Modern + Classic) for the Activities page.

// Rows that fit on one A4 page under the header, section bar and footer, with
// room for a location that wraps onto a second line.
export const ACTIVITIES_PER_PAGE = 9;

/** One activity row as the templates print it (builder state or API shape). */
export function activityRow(item) {
  const persons = Number(item.ticketCount ?? item.ticket_count) || 1;
  const day = item.dayNumber ?? item.day_number;
  return {
    key: item.id,
    name: item.name || "—",
    location: (item.location || "").trim() || "—",
    day: day ? `Day ${day}` : "—",
    persons,
    personsLabel: `${persons} ${persons > 1 ? "persons" : "person"}`,
  };
}

/** Split into per-page chunks; empty list → no pages (the page is optional). */
export function activityPages(activities) {
  const rows = (activities || []).map(activityRow);
  const pages = [];
  for (let i = 0; i < rows.length; i += ACTIVITIES_PER_PAGE) {
    pages.push(rows.slice(i, i + ACTIVITIES_PER_PAGE));
  }
  return pages;
}
