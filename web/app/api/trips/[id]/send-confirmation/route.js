import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { currencySymbol } from "@/lib/serialize";
import { recordTripRevision } from "@/lib/revisions";
import { mailerForAdminId, sendMail, confirmationHtml } from "@/lib/mailer";
import { renderReceiptPdf, renderInvoicePdf, renderConfirmationPdf, renderVouchersPdf } from "@/lib/pdf";
import { requestSupplierConfirmations } from "@/lib/operations";
import { appOrigin } from "@/lib/followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RECIPIENTS = ["client", "hotel", "cab", "payment_voucher", "invoice", "vouchers"];
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

  // ── Hotel / cab supplier requests (each with a one-tap confirm link, /s/:token) ──
  if (recipient === "hotel" || recipient === "cab") {
    const rows = await requestSupplierConfirmations(trip, {
      kinds: [recipient],
      email: true,
      origin: appOrigin(request),
      mailer,
      settings,
    });
    const emailed = rows.filter((r) => r.emailed).length;
    const noEmail = rows.filter((r) => !r.email && !r.skipped).length;
    const label = recipient === "hotel" ? "hotel" : "cab";
    return NextResponse.json({
      message: emailed
        ? `Booking request${emailed === 1 ? "" : "s"} sent to ${emailed} ${label}${emailed === 1 ? "" : "s"}${noEmail ? ` (${noEmail} without an email — use WhatsApp from Operations)` : ""}.`
        : rows.length
          ? `No ${label} email addresses found for this trip — send the requests on WhatsApp from Operations.`
          : `This trip has no ${label} bookings.`,
      requests: rows,
    });
  }

  // ── Payment voucher / invoice (emailed to the client with the PDF attached) ──
  if (recipient === "payment_voucher" || recipient === "invoice" || recipient === "vouchers") {
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
    } else if (recipient === "vouchers") {
      subjectTpl = "Your travel vouchers - {tripId}";
      messageTpl =
        "Dear {clientName},\n\nPlease find your hotel and transport vouchers attached. Show the hotel voucher at check-in; your driver's details are on the transport voucher.\n\nHave a wonderful trip!\n{agencyName}";
      pdf = await renderVouchersPdf(trip, settings);
      fileName = `${trip.tripId}_Vouchers.pdf`;
      successMessage = "Vouchers emailed to the client.";
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

  // Trips created via duplicate/package-use/lead-conversion start at
  // "draft" rather than "pending" — without including it here, sending a
  // confirmation on one of those never actually marks the trip confirmed,
  // silently excluding it from "confirmed" revenue/reporting filters forever.
  if (trip.status === "pending" || trip.status === "draft") {
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

  await recordTripRevision(trip.id, "confirmation_email");

  const response = { message: "Confirmation email sent for the client." };
  if (trip.clientPhone) {
    response.whatsapp_url = `https://wa.me/${String(trip.clientPhone).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  }
  return NextResponse.json(response);
}
