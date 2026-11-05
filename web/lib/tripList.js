import prisma from "@/lib/prisma";
import { currencySymbol } from "@/lib/serialize";

// The trip list rows (My Trips, Ching's trip search, the dashboard) — one
// shape for GET /api/trips and GET /api/trips/summary.
export const LIST_COLUMNS = {
  id: true, userId: true, tripId: true, tripTitle: true, clientName: true, clientPhone: true, startDate: true,
  duration: true, cost: true, paidAmount: true, refundedAmount: true, currency: true, imagePath: true, status: true,
  proposalResponse: true, proposalMessage: true, proposalViewedAt: true, updatedAt: true, createdAt: true,
};

/** Prisma rows (selected with LIST_COLUMNS) → the snake_case list rows. */
export async function listRows(trips, user) {
  // Resolve "created_by" labels (no joins).
  const ownerIds = [...new Set(trips.map((t) => t.userId))];
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));

  return trips.map((t) => ({
    id: t.id,
    trip_id: t.tripId,
    trip_title: t.tripTitle,
    client_name: t.clientName,
    client_phone: t.clientPhone,
    start_date: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : null,
    duration: t.duration,
    cost: t.cost == null ? null : Number(t.cost),
    paid_amount: Number(t.paidAmount),
    refunded_amount: Number(t.refundedAmount),
    currency: t.currency,
    currency_symbol: currencySymbol(t.currency),
    image_path: t.imagePath,
    image_url: t.imagePath,
    status: t.status,
    proposal_response: t.proposalResponse ?? null,
    proposal_message: t.proposalMessage ?? null,
    proposal_viewed_at: t.proposalViewedAt ? t.proposalViewedAt.toISOString() : null,
    updated_at: t.updatedAt,
    created_at: t.createdAt,
    created_by: t.userId === user.id ? "You" : ownerName.get(t.userId) || "—",
  }));
}
