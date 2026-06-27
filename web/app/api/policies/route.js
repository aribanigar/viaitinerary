import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Generic defaults returned on first access (matches the original behaviour).
const DEFAULTS = {
  termsConditions: [
    "A 50% advance is required to confirm the booking; the balance is due one week before arrival.",
    "Rates are net and non-commissionable.",
    "No refund will be made against any unutilized services.",
    "Any additional services taken by the guest and not included in the package will be charged as per prevailing rates.",
  ],
  mustHaves: [
    "Carry a valid local SIM card or enable roaming for your destination.",
    "Pack clothing suitable for the season and weather at your destination.",
    "Carry valid photo ID for all travellers.",
  ],
  rolesResponsibilities: [
    "Timely payment of the tour balance",
    "Carrying valid IDs and documents",
    "Paying directly for optional activities",
    "Following local rules and regulations",
  ],
  cancellationPolicy: [
    "Within 60 days prior to arrival: 25% retention of the total tour cost.",
    "Within 25 days prior to arrival: 50% retention of the total tour cost.",
    "Within 15 days prior to arrival: 100% retention of the total tour cost.",
  ],
  additionalExpenses: [
    "Entry tickets and local activity charges",
    "Adventure activities charged locally",
    "Anything not mentioned in the inclusions",
  ],
  defaultInclusions: [
    "Private vehicle for inter-city transfers",
    "Accommodation as mentioned in the itinerary",
    "Meal plan as mentioned",
    "Sightseeing as per the itinerary",
  ],
  defaultExclusions: [
    "Air and train tickets (to be arranged by guests)",
    "Entry fees and activity charges unless specified",
    "Travel insurance",
    "Personal expenses (laundry, tips, calls, etc.)",
    "Anything not specifically mentioned in inclusions",
  ],
};

function shape(p) {
  return {
    termsConditions: p.termsConditions ?? null,
    mustHaves: p.mustHaves ?? null,
    rolesResponsibilities: p.rolesResponsibilities ?? null,
    cancellationPolicy: p.cancellationPolicy ?? null,
    additionalExpenses: p.additionalExpenses ?? null,
    defaultInclusions: p.defaultInclusions ?? null,
    defaultExclusions: p.defaultExclusions ?? null,
  };
}

// GET /api/policies
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const policy = await prisma.policy.findUnique({ where: { userId: adminId } });
  return NextResponse.json(policy ? shape(policy) : DEFAULTS);
}

// PUT /api/policies — upsert all policy lists.
export async function PUT(request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const b = await request.json();

    const data = {
      termsConditions: b.termsConditions ?? null,
      mustHaves: b.mustHaves ?? null,
      rolesResponsibilities: b.rolesResponsibilities ?? null,
      cancellationPolicy: b.cancellationPolicy ?? null,
      additionalExpenses: b.additionalExpenses ?? null,
      defaultInclusions: b.defaultInclusions ?? null,
      defaultExclusions: b.defaultExclusions ?? null,
    };

    const policy = await prisma.policy.upsert({
      where: { userId: adminId },
      update: data,
      create: { userId: adminId, ...data },
    });
    return NextResponse.json(shape(policy));
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to save policies" }, { status: 500 });
  }
}
