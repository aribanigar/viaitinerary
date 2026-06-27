import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { renderConfirmationPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const applyVars = (tpl, vars) => Object.entries(vars).reduce((str, [k, v]) => str.split(k).join(v), tpl);

// GET /api/trips/:tripId/confirmation-pdf — booking confirmation document.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });

  const agencyName = settings?.agencyName || "ViaItinerary";
  const defaultMsg = `Warm greetings from ${agencyName},\n\nThank you for choosing ${agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.`;
  const message = applyVars(settings?.confirmationPdfMessage || settings?.confirmationMessage || defaultMsg, {
    "{agencyName}": agencyName,
    "{clientName}": trip.clientName || "Guest",
  });

  const buffer = await renderConfirmationPdf(trip, settings, message);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${trip.tripId}_Confirmation.pdf"`,
    },
  });
}
