import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { mailerForAdminId, sendMail, hotelBookingHtml, cabBookingHtml, confirmationHtml } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const RECIPIENTS = ["client", "hotel", "cab", "payment_voucher", "invoice"];
const applyVars = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(k).join(v), tpl);

// POST /api/trips/:tripId/send-confirmation { recipient }
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const recipient = b.recipient ?? "client";
  if (!RECIPIENTS.includes(recipient)) {
    return NextResponse.json({ message: "Invalid recipient." }, { status: 422 });
  }

  const { settings, mailer } = await mailerForAdminId(adminId);
  if (!mailer) {
    return NextResponse.json({ message: "SMTP credentials are not configured." }, { status: 422 });
  }

  // ── Hotel vendor notifications ──
  if (recipient === "hotel") {
    let queued = 0;
    for (const acc of trip.accommodations) {
      const email = acc.hotel?.email;
      if (!email) continue;
      const { subject, html } = hotelBookingHtml(trip, acc, settings);
      await sendMail(mailer, { to: email, subject, html });
      queued++;
    }
    return NextResponse.json({
      message: queued > 0 ? "Hotel booking email notifications sent successfully." : "No hotel email addresses found for this trip.",
    });
  }

  // ── Cab vendor notifications ──
  if (recipient === "cab") {
    let queued = 0;
    for (const trans of trip.transportations) {
      const email = trans.vehicle?.email;
      if (!email) continue;
      const { subject, html } = cabBookingHtml(trip, trans, settings);
      await sendMail(mailer, { to: email, subject, html });
      queued++;
    }
    return NextResponse.json({
      message: queued > 0 ? "Cab booking email notifications sent successfully." : "No cab vendor email addresses found for this trip.",
    });
  }

  // ── Payment voucher / invoice (require the generated PDF document) ──
  if (recipient === "payment_voucher" || recipient === "invoice") {
    if (!trip.clientEmail) {
      return NextResponse.json({ message: "Client email is not set for this trip." }, { status: 422 });
    }
    return NextResponse.json(
      { message: "Voucher/invoice PDFs are generated in the document (PDF) phase; this will be enabled there." },
      { status: 501 }
    );
  }

  // ── Client booking confirmation ──
  if (!settings || !settings.contactEmail) {
    return NextResponse.json({ message: "Agency contact email is not set." }, { status: 422 });
  }

  if (trip.status === "pending") {
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "confirmed", confirmationSent: true } });
  } else {
    await prisma.trip.update({ where: { id: trip.id }, data: { confirmationSent: true } });
  }

  const agencyName = settings.agencyName || "ViaItinerary";
  const defaultMsg = `Warm greetings from ${agencyName},\n\nThank you for choosing ${agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.`;
  const message = applyVars(settings.confirmationMessage || defaultMsg, {
    "{agencyName}": agencyName,
    "{clientName}": trip.clientName || "Guest",
  }).trim();

  await sendMail(mailer, {
    to: settings.contactEmail,
    subject: `Booking Confirmation - Trip #${trip.tripId}`,
    html: confirmationHtml(message, agencyName),
    text: message,
  });

  const response = { message: "Confirmation email sent for the client." };
  if (trip.clientPhone) {
    response.whatsapp_url = `https://wa.me/${String(trip.clientPhone).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }
  return NextResponse.json(response);
}
