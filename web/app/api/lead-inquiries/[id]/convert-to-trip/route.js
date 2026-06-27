import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf, teamIdOf } from "@/lib/scope";
import { serializeTrip } from "@/lib/serialize";
import { TRIP_INCLUDE } from "@/lib/trips";

export const dynamic = "force-dynamic";

const rand = () => Math.random().toString(36).slice(2, 8);

// POST /api/lead-inquiries/:id/convert-to-trip
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const teamId = teamIdOf(user);

  const lead = await prisma.leadInquiry.findFirst({ where: { id: parseInt(params.id, 10), userId: adminId } });
  if (!lead) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (lead.status === "converted") {
    return NextResponse.json({ message: "This inquiry has already been converted to a trip." }, { status: 400 });
  }

  let tripId;
  do {
    tripId = `TRP${Math.floor(100000 + Math.random() * 900000)}`;
  } while (await prisma.trip.findUnique({ where: { tripId } }));

  const title = `${lead.destination || "Trip"} Trip for ${lead.clientName}`;
  const trip = await prisma.trip.create({
    data: {
      userId: adminId,
      teamId,
      tripId,
      tripTitle: title,
      destination: lead.destination,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail,
      clientPhone: lead.clientPhone,
      adults: lead.adults ?? 1,
      kidsCnb: lead.kidsCnb ?? 0,
      kids5to12: lead.kids5to12 ?? 0,
      startDate: lead.startDate,
      duration: lead.duration ?? "2",
      cost: lead.approximateBudget ?? 0,
      currency: lead.currency ?? "INR (₹)",
      status: "draft",
      template: "ModernTemplate",
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${rand()}`,
    },
    include: TRIP_INCLUDE,
  });

  await prisma.leadInquiry.update({ where: { id: lead.id }, data: { status: "converted" } });

  return NextResponse.json(
    { message: "Inquiry converted to trip successfully.", trip_id: trip.tripId, trip: serializeTrip(trip) },
    { status: 201 }
  );
}
