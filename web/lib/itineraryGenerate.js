// Server-side glue for the itinerary generator API routes: loads the
// agency's catalogs and validates wizard input, so both the preview
// (/api/itinerary/generate) and commit (/api/itinerary/generate/commit)
// routes share identical, deterministic inputs into itineraryEngine.js.
import prisma from "@/lib/prisma";
import {
  catalogHotel,
  catalogVehicle,
  catalogDestination,
  catalogComplementaryService,
} from "@/lib/serialize";

export async function loadItineraryCatalogs(adminId, destinationId) {
  const [destination, hotels, vehicles, complementaryServices, settings] = await Promise.all([
    prisma.destination.findFirst({ where: { id: destinationId, userId: adminId } }),
    prisma.hotel.findMany({ where: { userId: adminId } }),
    prisma.vehicle.findMany({ where: { userId: adminId } }),
    prisma.complementaryService.findMany({ where: { userId: adminId, isActive: true } }),
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
  ]);

  return {
    destination: destination ? catalogDestination(destination) : null,
    hotels: hotels.map(catalogHotel),
    vehicles: vehicles.map(catalogVehicle),
    complementaryServices: complementaryServices.map(catalogComplementaryService),
    gstPercent: settings?.gstPercentage != null ? Number(settings.gstPercentage) : 5,
    includeGst: settings?.includeGst ?? true,
    costActivities: settings?.costActivities ?? false,
  };
}

/** Parse + validate the wizard's generation inputs (shared by preview + commit). */
export function parseGenerateInput(body) {
  const destinationId = parseInt(body.destination_id ?? body.destinationId, 10);
  if (Number.isNaN(destinationId)) return { error: "destination_id is required." };

  const days = parseInt(body.days, 10) || 0;
  if (days < 1) return { error: "days must be at least 1." };

  const budget = Number(body.budget);
  if (!budget || budget <= 0) return { error: "budget is required." };

  const profitType = body.profit_type === "fixed" ? "fixed" : "percentage";
  const profitValue = Number(body.profit_value ?? body.profitValue) || 0;

  return {
    data: {
      destinationId,
      adults: Math.max(1, parseInt(body.adults, 10) || 1),
      kids5to12: Math.max(0, parseInt(body.kids_5_to_12 ?? body.kids5to12, 10) || 0),
      kidsCnb: Math.max(0, parseInt(body.kids_cnb ?? body.kidsCnb, 10) || 0),
      days,
      budget,
      profitType,
      profitValue,
      mealPlan: body.meal_plan || body.mealPlan || null,
    },
  };
}
