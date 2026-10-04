import * as XLSX from "xlsx";
import { currencySymbol } from "@/lib/serialize";
import { paymentSchedule } from "@/lib/paymentSchedule";

// Client-facing quotation workbook (Summary / Itinerary / Hotels / Transport /
// Activities). Same rule as the PDF: the client sees the total price and the
// payment schedule, never room rates, cab prices, markups or margin.

const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const nightsBetween = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)) : "");
const lines = (text) =>
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("; ");

function sheet(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

/** trip: Prisma Trip with TRIP_INCLUDE; settings: AgencySetting | null → xlsx Buffer. */
export function quotationWorkbook(trip, settings) {
  const sym = currencySymbol(trip.currency);
  const money = (n) => (n == null || n === "" ? "" : `${sym}${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  const s = paymentSchedule(trip, settings);
  const nights = Number(trip.duration) || 0;
  const guests = [`${trip.adults || 0} adults`];
  if (trip.kids5to12) guests.push(`${trip.kids5to12} children (5–12)`);
  if (trip.kidsCnb) guests.push(`${trip.kidsCnb} children (under 5)`);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        [settings?.agencyName || "Quotation"],
        [settings?.contactPhone || "", settings?.contactEmail || "", settings?.website || ""],
        [],
        ["Quotation", trip.tripTitle || ""],
        ["Trip ID", trip.tripId],
        ["Client", trip.clientName || ""],
        ["Destination", trip.destination || ""],
        ["Travel dates", trip.startDate ? `${ymd(trip.startDate)} (${nights}N/${nights + 1}D)` : `${nights}N/${nights + 1}D`],
        ["Guests", guests.join(", ")],
        [],
        ["Total price", money(s.total), trip.includeGst ? "incl. GST" : ""],
        ["Advance", money(s.advance)],
        ["Paid so far", money(s.paid)],
        ["Balance", money(s.balance), s.balanceDueDate ? `due by ${ymd(s.balanceDueDate)}` : ""],
        [],
        ["Inclusions", (Array.isArray(trip.inclusions) ? trip.inclusions : []).map((i) => i?.content ?? i).filter(Boolean).join("; ")],
        ["Exclusions", (Array.isArray(trip.exclusions) ? trip.exclusions : []).map((i) => i?.content ?? i).filter(Boolean).join("; ")],
      ],
      [18, 40, 28],
    ),
    "Summary",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [["Day", "Title", "Location", "Plan"], ...(trip.itineraries || []).map((d) => [d.dayNumber, d.title || "", d.location || "", lines(d.description)])],
      [6, 36, 18, 70],
    ),
    "Itinerary",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["City", "Hotel", "Category", "Room type", "Rooms", "Meal plan", "Check-in", "Check-out", "Nights"],
        ...(trip.accommodations || [])
          .filter((a) => !a.cancelledAt)
          .map((a) => [
            a.hotel?.city ?? a.city ?? "",
            a.hotel?.name ?? a.name ?? "",
            a.category || "",
            a.roomType || "",
            Number(a.rooms) || "",
            a.mealPlan || "",
            ymd(a.checkIn),
            ymd(a.checkOut),
            nightsBetween(a.checkIn, a.checkOut),
          ]),
      ],
      [14, 32, 10, 14, 7, 24, 12, 12, 8],
    ),
    "Hotels",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Date", "Type", "Route", "Vehicle", "Qty"],
        ...(trip.transportations || []).map((t) => [ymd(t.date), t.tripType || "", t.route || "", t.vehicleType || "", t.quantity || 1]),
      ],
      [12, 12, 40, 22, 6],
    ),
    "Transport",
  );

  if ((trip.tripActivities || []).length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheet(
        [
          ["Day", "Activity", "Location", "Persons"],
          ...trip.tripActivities.map((a) => [a.dayNumber ?? "", a.name || "", a.location || "", (a.ticketCount || 1) + (a.childCount || 0)]),
        ],
        [6, 32, 18, 9],
      ),
      "Activities",
    );
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
