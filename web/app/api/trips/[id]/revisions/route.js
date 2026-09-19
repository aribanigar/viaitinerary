import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { serializeTripRevision } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/trips/:tripId/revisions — the amendment/send history for a trip.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId } });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const revisions = await prisma.tripRevision.findMany({
    where: { tripId: trip.id },
    orderBy: { versionNumber: "desc" },
  });

  return NextResponse.json({ data: revisions.map(serializeTripRevision) });
}
