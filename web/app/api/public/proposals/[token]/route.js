import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TRIP_INCLUDE } from "@/lib/trips";
import { notify } from "@/lib/notify";
import { publicTrip, publicSettings, publicPolicies } from "@/lib/proposal";
import { paymentView, reconcilePendingOrders } from "@/lib/clientPayments";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

// GET /api/public/proposals/:token — the client-facing proposal (no login).
// Only price-free, allowlisted fields leave the server (see lib/proposal.js).
// ?preview=1 (the agent's own preview) doesn't count as a client view.
export async function GET(request, { params }) {
  if (!TOKEN_RE.test(params.token || "")) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const trip = await prisma.trip.findUnique({ where: { proposalToken: params.token }, include: TRIP_INCLUDE });
  if (!trip || trip.isPackage) return NextResponse.json({ message: "This proposal link is no longer valid." }, { status: 404 });

  const [settings, policy] = await Promise.all([
    prisma.agencySetting.findUnique({ where: { userId: trip.userId } }),
    prisma.policy.findUnique({ where: { userId: trip.userId } }),
  ]);

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (!preview) {
    const firstView = !trip.proposalViewedAt;
    await prisma.trip.update({
      where: { id: trip.id },
      data: { proposalViewCount: { increment: 1 }, ...(firstView ? { proposalViewedAt: new Date() } : {}) },
    });
    if (firstView) {
      await notify(trip.userId, "proposal_viewed", {
        type: "proposal_viewed",
        message: `${trip.clientName || "Your client"} opened the proposal for ${trip.tripTitle} (${trip.tripId})`,
        trip_id: trip.tripId,
        client_name: trip.clientName,
        client_phone: trip.clientPhone,
      });
    }
  }

  // Pick up a Razorpay payment whose checkout tab was closed before verify.
  if (await reconcilePendingOrders(trip, settings)) {
    Object.assign(trip, await prisma.trip.findUnique({ where: { id: trip.id } }));
  }
  const payments = await prisma.clientPayment.findMany({ where: { tripId: trip.id }, orderBy: { createdAt: "asc" } });

  return NextResponse.json({
    settings: publicSettings(settings),
    payment: paymentView(trip, settings, payments),
    policies: publicPolicies(policy),
    trip: publicTrip(trip),
    proposal: {
      response: trip.proposalResponse ?? null,
      responded_at: trip.proposalRespondedAt ? trip.proposalRespondedAt.toISOString() : null,
      responder: trip.proposalResponder ?? null,
    },
  });
}
