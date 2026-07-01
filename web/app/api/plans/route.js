import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializePlan } from "@/lib/subscription";
import { planDataFromForm, uniquePlanKey } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/plans — all plans (super-admin), global first then by country/price.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const plans = await prisma.plan.findMany({ orderBy: [{ country: "asc" }, { price: "asc" }] });
  // Global (country null) first.
  plans.sort((a, b) => (a.country ? 1 : 0) - (b.country ? 1 : 0));
  return NextResponse.json(plans.map(serializePlan));
}

// POST /api/plans — create a plan (multipart form).
export async function POST(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: "Invalid form data." }, { status: 422 });

  const data = await planDataFromForm(form);
  if (!data.name) return NextResponse.json({ message: "Plan name is required." }, { status: 422 });
  if (data.originalPrice == null && data.price == null) {
    return NextResponse.json({ message: "Price is required." }, { status: 422 });
  }
  if (data.price == null) data.price = data.originalPrice;
  if (!data.durationMonths) data.durationMonths = 1;

  const key = await uniquePlanKey(form.get("key") || data.name);
  const plan = await prisma.plan.create({ data: { ...data, key } });
  return NextResponse.json(serializePlan(plan), { status: 201 });
}
