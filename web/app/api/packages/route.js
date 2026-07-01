import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip, currencySymbol } from "@/lib/serialize";
import { buildTripScalars, syncTripRelations, TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rand = () => Math.random().toString(36).slice(2, 8);

// GET /api/packages — list reusable package templates for the agency.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const where = { userId: adminId, isPackage: true };
  if (search) {
    where.OR = [
      { tripTitle: { contains: search, mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { tripId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, packages] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ]);

  return NextResponse.json({
    data: packages.map((p) => ({
      id: p.id,
      package_id: p.tripId,
      trip_id: p.tripId,
      trip_title: p.tripTitle,
      destination: p.destination,
      duration: p.duration,
      cost: p.cost == null ? null : Number(p.cost),
      currency: p.currency,
      currency_symbol: currencySymbol(p.currency),
      image_path: p.imagePath,
      image_url: p.imagePath,
      locked: p.locked,
      updated_at: p.updatedAt,
    })),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
}

// POST /api/packages — create a package template (no client, no trip quota).
export async function POST(request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const teamId = teamIdOf(user);

    const body = await request.json();
    if (!body.tripTitle) return NextResponse.json({ message: "Package name is required." }, { status: 422 });

    let packageId;
    do {
      packageId = `PKG${Math.floor(100000 + Math.random() * 900000)}`;
    } while (await prisma.trip.findUnique({ where: { tripId: packageId } }));

    const scalars = await buildTripScalars(body);
    const pkg = await prisma.trip.create({
      data: {
        ...scalars,
        userId: adminId,
        teamId,
        tripId: packageId,
        isPackage: true,
        locked: !!body.locked,
        status: "template",
        slug: `pkg-${rand()}`,
      },
    });
    await syncTripRelations(pkg.id, body);

    const full = await prisma.trip.findUnique({ where: { id: pkg.id }, include: TRIP_INCLUDE });
    return NextResponse.json(serializeTrip(full), { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to create package" }, { status: 500 });
  }
}
