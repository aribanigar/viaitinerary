import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializePlan } from "@/lib/subscription";
import { planDataFromForm, planDataFromJson } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function found(id) {
  return prisma.plan.findUnique({ where: { id: parseInt(id, 10) } });
}

// POST /api/plans/:id (with _method=PUT) — multipart update.
export async function POST(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const plan = await found(params.id);
  if (!plan) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: "Invalid form data." }, { status: 422 });

  const data = await planDataFromForm(form);
  const updated = await prisma.plan.update({ where: { id: plan.id }, data });
  return NextResponse.json(serializePlan(updated));
}

// PUT /api/plans/:id — JSON update (used by the active/status toggle).
export async function PUT(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const plan = await found(params.id);
  if (!plan) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updated = await prisma.plan.update({ where: { id: plan.id }, data: planDataFromJson(body) });
  return NextResponse.json(serializePlan(updated));
}

// DELETE /api/plans/:id
export async function DELETE(request, { params }) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const plan = await found(params.id);
  if (!plan) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await prisma.plan.delete({ where: { id: plan.id } });
  return NextResponse.json({ message: "Plan deleted successfully." });
}
