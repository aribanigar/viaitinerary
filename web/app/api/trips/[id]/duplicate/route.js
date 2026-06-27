import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

const rand = () => Math.random().toString(36).slice(2, 8);

// POST /api/trips/:tripId/duplicate — clone a trip (and its children) as a draft.
export async function POST(request, { params }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const teamId = teamIdOf(user);

    const original = await prisma.trip.findFirst({
      where: { tripId: params.id, userId: adminId },
      include: TRIP_INCLUDE,
    });
    if (!original) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const newTripId = `TRP${Math.floor(100000 + Math.random() * 900000)}`;

    const copy = await prisma.trip.create({
      data: {
        userId: adminId,
        teamId,
        tripId: newTripId,
        tripTitle: `${original.tripTitle} (Copy)`,
        destination: original.destination,
        destinationId: original.destinationId,
        clientName: original.clientName,
        clientPhone: original.clientPhone,
        clientEmail: original.clientEmail,
        adults: original.adults,
        kidsCnb: original.kidsCnb,
        kids5to12: original.kids5to12,
        startDate: original.startDate,
        duration: original.duration,
        cost: original.cost,
        gstAmount: original.gstAmount,
        currency: original.currency,
        imagePath: original.imagePath,
        status: "draft",
        template: original.template,
        slug: `copy-${rand()}`,
        includeGst: original.includeGst,
        useFlight: original.useFlight,
        tagline: original.tagline,
        inclusions: original.inclusions ?? [],
        exclusions: original.exclusions ?? [],
        otherCosts: original.otherCosts ?? [],
        transportDetails: original.transportDetails ?? [],
        itineraries: {
          create: original.itineraries.map((i) => ({
            dayNumber: i.dayNumber,
            title: i.title,
            location: i.location,
            description: i.description,
            imagePath: i.imagePath,
          })),
        },
        accommodations: {
          create: original.accommodations.map((a) => ({
            hotelId: a.hotelId,
            name: a.name,
            city: a.city,
            category: a.category,
            rooms: a.rooms,
            beds: a.beds,
            cnbCount: a.cnbCount,
            extraBeds5To12Count: a.extraBeds5To12Count,
            extraBedsAbove12Count: a.extraBedsAbove12Count,
            mealPlan: a.mealPlan,
            roomType: a.roomType,
            checkIn: a.checkIn,
            checkOut: a.checkOut,
            pricePerRoom: a.pricePerRoom,
            bedPrices: a.bedPrices ?? [],
            imagePath: a.imagePath,
          })),
        },
        transportations: {
          create: original.transportations.map((t) => ({
            vehicleId: t.vehicleId,
            tripType: t.tripType,
            destination: t.destination,
            route: t.route,
            date: t.date,
            vehicleType: t.vehicleType,
            quantity: t.quantity,
            remarks: t.remarks,
          })),
        },
      },
      include: TRIP_INCLUDE,
    });

    return NextResponse.json(serializeTrip(copy), { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to duplicate trip" }, { status: 500 });
  }
}
