import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { PIPELINE_STAGES, pipelineStage, attentionFor } from "@/lib/followups";

export const dynamic = "force-dynamic";

// GET /api/sales/pipeline — where this agency's trips are, from draft to
// fully paid, plus the trips that need the agent now (most urgent first).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const now = new Date();

  const [settings, trips] = await Promise.all([
    prisma.agencySetting.findUnique({ where: { userId: adminId } }),
    prisma.trip.findMany({
      where: {
        userId: adminId,
        isPackage: false,
        status: { notIn: ["rejected", "completed", "cancelled"] },
        OR: [{ createdAt: { gte: new Date(now.getTime() - 90 * 86400000) } }, { startDate: { gte: now } }],
      },
      include: { clientPayments: { where: { status: "claimed" } } },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  const counts = Object.fromEntries(PIPELINE_STAGES.map((k) => [k, 0]));
  const attention = [];
  for (const trip of trips) {
    counts[pipelineStage(trip, settings)] += 1;
    const a = attentionFor(trip, settings, now);
    if (a) attention.push({ ...a, trip });
  }
  attention.sort((a, b) => a.rank - b.rank || new Date(a.since || 0) - new Date(b.since || 0));

  return NextResponse.json({
    counts,
    attention: attention.slice(0, 8).map(({ trip, key, reason, since }) => ({
      trip_id: trip.tripId,
      trip_title: trip.tripTitle,
      client_name: trip.clientName,
      client_phone: trip.clientPhone,
      key,
      reason,
      since: since ? new Date(since).toISOString() : null,
    })),
  });
}
