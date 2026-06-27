import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { renderReceiptPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trips/:tripId/payment-voucher-pdf — payment receipt document.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const [settings, payments] = await Promise.all([
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
    prisma.accountingSettlement.findMany({ where: { tripId: trip.id }, orderBy: { settlementDate: "desc" } }),
  ]);

  const buffer = await renderReceiptPdf(trip, settings, payments);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${trip.tripId}_Payment_Voucher.pdf"`,
    },
  });
}
