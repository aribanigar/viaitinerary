import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { currencySymbol } from "@/lib/serialize";
import { mailerForAdminId, sendMail, hotelBookingHtml, cabBookingHtml, confirmationHtml } from "@/lib/mailer";
import { renderReceiptPdf, renderInvoicePdf, renderConfirmationPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // ── Payment voucher / invoice (emailed to the client with the PDF attached) ──
  if (recipient === "payment_voucher" || recipient === "invoice") {
    if (!trip.clientEmail) {
      return NextResponse.json({ message: "Client email is not set for this trip." }, { status: 422 });
    }

    const agencyName = settings?.agencyName || "ViaItinerary";
    const vars = {
      "{agencyName}": agencyName,
      "{clientName}": trip.clientName || "Guest",
      "{tripId}": trip.tripId,
      "{paymentAmount}": Number(trip.paidAmount || 0).toFixed(2),
      "{currencySymbol}": currencySymbol(trip.currency),
    };

    let subjectTpl, messageTpl, pdf, fileName, successMessage;
    if (recipient === "payment_voucher") {
      subjectTpl = "Payment Receipt - Trip #{tripId}";
      messageTpl = settings?.paymentVoucherEmailMessage ||
        "Dear {clientName},\n\nThank you for your payment of {currencySymbol}{paymentAmount}. Please find your payment receipt attached below.\n\nRegards,\n{agencyName}";
      const payments = await prisma.accountingSettlement.findMany({ where: { tripId: trip.id }, orderBy: { settlementDate: "desc" } });
      pdf = await renderReceiptPdf(trip, settings, payments);
      fileName = `${trip.tripId}_Payment_Voucher.pdf`;
      successMessage = "Payment voucher emailed to the client.";
    } else {
      subjectTpl = "Trip Invoice - {tripId}";
      messageTpl = settings?.invoiceEmailMessage ||
        "Dear {clientName},\n\nPlease find your invoice attached for trip {tripId}.\n\nRegards,\n{agencyName}";
      pdf = await renderInvoicePdf(trip, settings);
      fileName = `${trip.tripId}_Invoice.pdf`;
      successMessage = "Invoice emailed to the client.";
    }

    const subject = applyVars(subjectTpl, vars);
    const message = applyVars(messageTpl, vars);
    await sendMail(mailer, {
      to: trip.clientEmail,
      subject,
      html: confirmationHtml(message, agencyName),
      text: message,
      attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
    });
    return NextResponse.json({ message: successMessage });
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

  const confirmationPdf = await renderConfirmationPdf(trip, settings, message);
  await sendMail(mailer, {
    to: settings.contactEmail,
    subject: `Booking Confirmation - Trip #${trip.tripId}`,
    html: confirmationHtml(message, agencyName),
    text: message,
    attachments: [{ filename: `${trip.tripId}_Confirmation.pdf`, content: confirmationPdf, contentType: "application/pdf" }],
  });

  const response = { message: "Confirmation email sent for the client." };
  if (trip.clientPhone) {
    response.whatsapp_url = `https://wa.me/${String(trip.clientPhone).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }
  return NextResponse.json(response);
}
