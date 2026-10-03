import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { XLSX_CONTENT_TYPE } from "@/lib/excel";
import { quotationWorkbook } from "@/lib/quotationExcel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trips/:tripId/quotation-xlsx — client-facing Excel quotation.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });

  const buffer = quotationWorkbook(trip, settings);
  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${trip.tripId}_Quotation.xlsx"`,
    },
  });
}
