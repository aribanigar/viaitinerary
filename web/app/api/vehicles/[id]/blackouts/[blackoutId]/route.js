import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// DELETE /api/vehicles/:id/blackouts/:blackoutId
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const vehicleId = parseInt(params.id, 10);
  const blackoutId = parseInt(params.blackoutId, 10);
  if (Number.isNaN(vehicleId) || Number.isNaN(blackoutId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId: adminId } });
  if (!vehicle) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const blackout = await prisma.vehicleBlackout.findFirst({ where: { id: blackoutId, vehicleId } });
  if (!blackout) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prisma.vehicleBlackout.delete({ where: { id: blackoutId } });
  return new NextResponse(null, { status: 204 });
}
