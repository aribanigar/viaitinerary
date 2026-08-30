// Destination.activities is stored as [{ name, cost }] (cost 0 = free/bundled),
// but legacy rows may still be a flat array of plain strings. This normalizes
// either shape into display labels for places that just need text (day-card
// descriptions, itinerary seeding) — not for anything that needs the cost.
export const destinationActivityLabels = (activities) =>
  (activities || [])
    .map((a) => {
      if (typeof a === "string") return a;
      if (!a?.name) return null;
      const cost = Number(a.cost) || 0;
      return cost > 0 ? `${a.name} (₹${cost.toLocaleString("en-IN")})` : a.name;
    })
    .filter(Boolean);
