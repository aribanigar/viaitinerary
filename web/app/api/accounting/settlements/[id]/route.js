import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { updateSettlement, deleteSettlement, serializeSettlement, serializeObligation } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const SETTLEMENT_TYPES = ["receipt", "payment", "refund", "adjustment"];

async function loadOwned(id, adminId) {
  const settlement = await prisma.accountingSettlement.findUnique({
    where: { id: parseInt(id, 10) },
    include: { obligation: true },
  });
  if (!settlement) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  if (Number(settlement.obligation.userId) !== Number(adminId)) {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  return { settlement };
}

// PUT /api/accounting/settlements/:id
export async function PUT(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { settlement, error } = await loadOwned(params.id, adminId);
  if (error) return error;

  const b = await request.json();
  const amount = Number(b.amount);
  if (!(amount >= 0.01)) return NextResponse.json({ message: "amount must be at least 0.01." }, { status: 422 });
  if (!SETTLEMENT_TYPES.includes(b.settlement_type)) {
    return NextResponse.json({ message: "Invalid settlement_type." }, { status: 422 });
  }
  if (!b.settlement_date) return NextResponse.json({ message: "settlement_date is required." }, { status: 422 });

  const updated = await updateSettlement(settlement, { ...b, amount });
  const fresh = await prisma.accountingObligation.findUnique({
    where: { id: updated.obligationId },
    include: { settlements: { orderBy: [{ settlementDate: "desc" }, { id: "desc" }] } },
  });

  return NextResponse.json({
    message: "Settlement updated successfully.",
    settlement: serializeSettlement(updated),
    obligation: serializeObligation(fresh),
  });
}

// DELETE /api/accounting/settlements/:id
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const { settlement, error } = await loadOwned(params.id, adminId);
  if (error) return error;

  await deleteSettlement(settlement);
  return NextResponse.json({ message: "Settlement deleted successfully." });
}
