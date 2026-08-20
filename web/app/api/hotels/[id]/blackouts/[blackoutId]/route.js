import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// DELETE /api/hotels/:id/blackouts/:blackoutId
export async function DELETE(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const hotelId = parseInt(params.id, 10);
  const blackoutId = parseInt(params.blackoutId, 10);
  if (Number.isNaN(hotelId) || Number.isNaN(blackoutId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const hotel = await prisma.hotel.findFirst({ where: { id: hotelId, userId: adminId } });
  if (!hotel) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const blackout = await prisma.hotelBlackout.findFirst({ where: { id: blackoutId, hotelId } });
  if (!blackout) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prisma.hotelBlackout.delete({ where: { id: blackoutId } });
  return new NextResponse(null, { status: 204 });
}
