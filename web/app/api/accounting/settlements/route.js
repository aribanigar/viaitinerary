import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { recordSettlement, serializeSettlement, serializeObligation } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const SETTLEMENT_TYPES = ["receipt", "payment", "refund", "adjustment"];

// POST /api/accounting/settlements — record a settlement against an obligation.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const b = await request.json();

  if (b.obligation_id == null) return NextResponse.json({ message: "obligation_id is required." }, { status: 422 });
  const amount = Number(b.amount);
  if (!(amount >= 0.01)) return NextResponse.json({ message: "amount must be at least 0.01." }, { status: 422 });
  if (b.settlement_type != null && !SETTLEMENT_TYPES.includes(b.settlement_type)) {
    return NextResponse.json({ message: "Invalid settlement_type." }, { status: 422 });
  }

  const obligation = await prisma.accountingObligation.findFirst({
    where: { id: Number(b.obligation_id), userId: adminId },
  });
  if (!obligation) return NextResponse.json({ message: "Obligation not found." }, { status: 404 });

  const settlement = await recordSettlement(obligation, { ...b, amount }, user.id);
  const fresh = await prisma.accountingObligation.findUnique({
    where: { id: obligation.id },
    include: { settlements: { orderBy: [{ settlementDate: "desc" }, { id: "desc" }] } },
  });

  return NextResponse.json({
    message: "Settlement recorded successfully.",
    settlement: serializeSettlement(settlement),
    obligation: serializeObligation(fresh),
  });
}
