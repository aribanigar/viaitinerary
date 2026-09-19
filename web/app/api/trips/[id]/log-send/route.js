import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { recordTripRevision } from "@/lib/revisions";
import { serializeTripRevision } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const TRIGGERS = ["export", "whatsapp_share"];

// POST /api/trips/:tripId/log-send { trigger } — called by the frontend right
// after the itinerary is actually exported/shared, so the amendment trail
// captures client-side send actions the server otherwise never sees.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId } });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const trigger = TRIGGERS.includes(body.trigger) ? body.trigger : "export";

  const revision = await recordTripRevision(trip.id, trigger);
  return NextResponse.json({ revision: revision ? serializeTripRevision(revision) : null });
}
