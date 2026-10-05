import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip, currencySymbol } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";
import { canCreateTrip, incrementTripsUsed } from "@/lib/subscription";
import { pushDmcItinerary } from "@/lib/dmcBridge";

export const dynamic = "force-dynamic";

function slugify(s) {
  return String(s || "trip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
const rand = () => Math.random().toString(36).slice(2, 8);

// The columns the list below sends — a trip row has ~55 (JSON lists, proposal
// and reminder bookkeeping…), and the dashboard asks for up to 1000 trips.
const LIST_COLUMNS = {
  id: true, userId: true, tripId: true, tripTitle: true, clientName: true, clientPhone: true, startDate: true,
  duration: true, cost: true, paidAmount: true, refundedAmount: true, currency: true, imagePath: true, status: true,
  proposalResponse: true, proposalMessage: true, proposalViewedAt: true, updatedAt: true,
};

// GET /api/trips — paginated list scoped to the admin context.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { userId: adminId, isPackage: false };
  if (search) {
    where.OR = [
      { tripTitle: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { tripId: { contains: search, mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { clientPhone: { contains: search.replace(/[^\d+]/g, "") || search } },
      { clientEmail: { contains: search, mode: "insensitive" } },
    ];
  }
  // Filters (My Trips and Ching's "find trips…"): status, travel dates, payment.
  const status = searchParams.get("status");
  if (status) where.status = status;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || "") || /^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    where.startDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
    };
  }
  // payment=unpaid|paid compares two columns, which Prisma can't express in
  // `where` — resolve the matching ids first (tenant-scoped, capped).
  const payment = searchParams.get("payment");
  if (payment === "unpaid" || payment === "paid") {
    const rows = await prisma.trip.findMany({
      where: { ...where, cost: { gt: 0 } },
      select: { id: true, cost: true, paidAmount: true, refundedAmount: true },
      take: 2000,
    });
    const ids = rows
      .filter((r) => {
        const due = Number(r.cost) - (Number(r.paidAmount) - Number(r.refundedAmount));
        return payment === "unpaid" ? due > 0.5 : due <= 0.5;
      })
      .map((r) => r.id);
    where.id = { in: ids.length ? ids : [-1] };
  }

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: LIST_COLUMNS,
    }),
  ]);

  // Resolve "created_by" labels (no joins).
  const ownerIds = [...new Set(trips.map((t) => t.userId))];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  });
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));

  const data = trips.map((t) => ({
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
    created_by: t.userId === user.id ? "You" : ownerName.get(t.userId) || "—",
  }));

  return NextResponse.json({
    data,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}

// POST /api/trips — create a trip with its nested itineraries/logistics.
export async function POST(request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const teamId = teamIdOf(user);

    const body = await request.json();

    // Always guarantee a unique trip ID — never reject a save on collision.
    // Use the client's id only if it's free; otherwise mint a fresh unique one.
    let tripId = (body.tripId || "").trim();
    if (!tripId || (await prisma.trip.findUnique({ where: { tripId } }))) {
      do {
        tripId = `TRP${Math.floor(100000 + Math.random() * 900000)}`;
      } while (await prisma.trip.findUnique({ where: { tripId } }));
    }

    // Title is optional for client trips — default it so saving never errors.
    const tripTitle =
      (body.tripTitle && body.tripTitle.trim()) ||
      (body.clientName ? `Trip — ${body.clientName}` : "Untitled Trip");

    // Subscription gate (mirrors the EnsureSubscriptionAllowsTripCreation middleware).
    const gate = await canCreateTrip(user);
    if (!gate.allowed) return NextResponse.json({ message: gate.reason }, { status: gate.status });

    const scalars = await buildTripScalars({ ...body, tripTitle });
    const trip = await prisma.trip.create({
      data: {
        ...scalars,
        userId: adminId,
        teamId,
        tripId,
        slug: `${slugify(tripTitle)}-${rand()}`,
      },
    });
    await syncTripRelations(trip.id, body);
    await incrementTripsUsed(adminId);
    pushDmcItinerary(trip).catch(() => {});

    const full = await prisma.trip.findUnique({ where: { id: trip.id }, include: TRIP_INCLUDE });
    return NextResponse.json(serializeTrip(full), { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to create trip" }, { status: 500 });
  }
}
