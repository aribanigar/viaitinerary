import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip, currencySymbol } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

function slugify(s) {
  return String(s || "trip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
const rand = () => Math.random().toString(36).slice(2, 8);

// GET /api/trips — paginated list scoped to the admin context.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { userId: adminId };
  if (search) {
    where.OR = [
      { tripTitle: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { tripId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
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
    if (!body.tripId) return NextResponse.json({ message: "tripId is required." }, { status: 422 });
    if (!body.tripTitle) return NextResponse.json({ message: "tripTitle is required." }, { status: 422 });

    const clash = await prisma.trip.findUnique({ where: { tripId: body.tripId } });
    if (clash) return NextResponse.json({ message: "A trip with this ID already exists." }, { status: 422 });

    const trip = await prisma.trip.create({
      data: {
        ...buildTripScalars(body),
        userId: adminId,
        teamId,
        tripId: body.tripId,
        slug: `${slugify(body.tripTitle)}-${rand()}`,
      },
    });
    await syncTripRelations(trip.id, body);

    const full = await prisma.trip.findUnique({ where: { id: trip.id }, include: TRIP_INCLUDE });
    return NextResponse.json(serializeTrip(full), { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to create trip" }, { status: 500 });
  }
}
