import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { TRIP_INCLUDE, cloneTripChildren, parseDate } from "@/lib/trips";
import { canCreateTrip, incrementTripsUsed } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rand = () => Math.random().toString(36).slice(2, 8);
const int = (v, d) => (v === undefined || v === null || v === "" ? d : parseInt(v, 10) || d);

// POST /api/packages/:id/use — instantiate a package as a client trip.
export async function POST(request, { params }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const teamId = teamIdOf(user);

    const pkg = await prisma.trip.findFirst({
      where: { tripId: params.id, userId: adminId, isPackage: true },
      include: TRIP_INCLUDE,
    });
    if (!pkg) return NextResponse.json({ message: "Package not found" }, { status: 404 });

    // Instantiating a package creates a real trip → subject to the plan limit.
    const gate = await canCreateTrip(user);
    if (!gate.allowed) return NextResponse.json({ message: gate.reason }, { status: gate.status });

    const b = await request.json().catch(() => ({}));

    let tripId;
    do {
      tripId = `TRP${Math.floor(100000 + Math.random() * 900000)}`;
    } while (await prisma.trip.findUnique({ where: { tripId } }));

    const title = b.trip_title || b.client_name ? `${pkg.tripTitle} — ${b.client_name || "Client"}` : pkg.tripTitle;

    const trip = await prisma.trip.create({
      data: {
        userId: adminId,
        teamId,
        tripId,
        isPackage: false,
        locked: pkg.locked, // locked packages produce a trip the UI keeps read-only for logistics
        tripTitle: title,
        destination: pkg.destination,
        destinationId: pkg.destinationId,
        clientName: b.client_name ?? null,
        clientEmail: b.client_email ?? null,
        clientPhone: b.client_phone ?? null,
        adults: int(b.adults, pkg.adults),
        kidsCnb: int(b.kids_cnb, pkg.kidsCnb),
        kids5to12: int(b.kids_5_to_12, pkg.kids5to12),
        startDate: b.start_date ? parseDate(b.start_date) : pkg.startDate,
        duration: pkg.duration,
        cost: pkg.cost,
        gstAmount: pkg.gstAmount,
        currency: pkg.currency,
        imagePath: pkg.imagePath,
        status: "draft",
        template: pkg.template,
        slug: `${(pkg.tripTitle || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${rand()}`,
        includeGst: pkg.includeGst,
        useFlight: pkg.useFlight,
        tagline: pkg.tagline,
        inclusions: pkg.inclusions ?? [],
        exclusions: pkg.exclusions ?? [],
        otherCosts: pkg.otherCosts ?? [],
        transportDetails: pkg.transportDetails ?? [],
        ...cloneTripChildren(pkg),
      },
      include: TRIP_INCLUDE,
    });

    await incrementTripsUsed(adminId);

    return NextResponse.json(
      { message: "Trip created from package.", trip_id: trip.tripId, trip: serializeTrip(trip) },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to create trip from package" }, { status: 500 });
  }
}
