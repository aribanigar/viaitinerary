import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { mailerForAdminId, sendMail, vehicleAvailabilityRequestHtml } from "@/lib/mailer";
import { catalogVehicle } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// POST /api/vehicles/:id/request — send a "please confirm availability"
// notice to the transport vendor and track that a request went out, so the
// Transportation catalog can surface a real request count/last-sent time.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: numId, userId: adminId } });
  if (!vehicle) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let emailed = false;
  if (vehicle.email) {
    const { settings, mailer } = await mailerForAdminId(adminId);
    if (mailer) {
      const { subject, html } = vehicleAvailabilityRequestHtml(vehicle, settings);
      await sendMail(mailer, { to: vehicle.email, subject, html });
      emailed = true;
    }
  }

  const updated = await prisma.vehicle.update({
    where: { id: numId },
    data: { requestCount: { increment: 1 }, lastRequestedAt: new Date() },
  });
  const owner = await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, email: true } });

  const response = { vehicle: catalogVehicle({ ...updated, user: owner }), emailed };
  if (vehicle.phone) {
    const text = `Hi, checking availability for ${vehicle.name} for an upcoming booking. Could you confirm?`;
    response.whatsapp_url = `https://wa.me/${String(vehicle.phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  }
  return NextResponse.json(response);
}
