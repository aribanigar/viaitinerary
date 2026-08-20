import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { mailerForAdminId, sendMail, hotelAvailabilityRequestHtml } from "@/lib/mailer";
import { catalogHotel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// POST /api/hotels/:id/request — send a "please confirm room availability"
// notice to the hotel vendor and track that a request went out, so the
// Accommodation catalog can surface a real request count/last-sent time.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);

  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const hotel = await prisma.hotel.findFirst({ where: { id: numId, userId: adminId } });
  if (!hotel) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let emailed = false;
  if (hotel.email) {
    const { settings, mailer } = await mailerForAdminId(adminId);
    if (mailer) {
      const { subject, html } = hotelAvailabilityRequestHtml(hotel, settings);
      await sendMail(mailer, { to: hotel.email, subject, html });
      emailed = true;
    }
  }

  const updated = await prisma.hotel.update({
    where: { id: numId },
    data: { requestCount: { increment: 1 }, lastRequestedAt: new Date() },
  });
  const owner = await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, email: true } });

  const response = { hotel: catalogHotel({ ...updated, user: owner }), emailed };
  if (hotel.phone) {
    const text = `Hi, checking room availability at ${hotel.name} for an upcoming booking. Could you confirm?`;
    response.whatsapp_url = `https://wa.me/${String(hotel.phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  }
  return NextResponse.json(response);
}
