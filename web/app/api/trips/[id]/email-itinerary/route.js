import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { currencySymbol } from "@/lib/serialize";
import { renderItineraryPdf } from "@/lib/pdf";
import { mailerForAdminId, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel caps request bodies at 4.5 MB; base64 adds a third, so larger
// exports fall back to the server-rendered PDF instead of being uploaded.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// POST /api/trips/:tripId/email-itinerary { pdf_base64?, filename? }
// Emails the itinerary PDF to the signed-in user (used by Ching after a voice
// build). The client sends the exact PDF it exported from the live preview;
// without one (or if it's too big) the server renders its own.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId }, include: TRIP_INCLUDE });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!user.email) return NextResponse.json({ message: "Your account has no email address." }, { status: 422 });

  const { settings, mailer } = await mailerForAdminId(adminId);
  if (!mailer) {
    return NextResponse.json(
      { message: "Email isn't set up yet — add your Gmail/SMTP under Settings to receive itineraries by email." },
      { status: 422 },
    );
  }

  const body = await request.json().catch(() => ({}));
  let pdf = null;
  if (typeof body.pdf_base64 === "string" && body.pdf_base64) {
    const buf = Buffer.from(body.pdf_base64.replace(/^data:[^,]*,/, ""), "base64");
    if (buf.length > 0 && buf.length <= MAX_PDF_BYTES && buf.subarray(0, 4).toString() === "%PDF") pdf = buf;
  }
  if (!pdf) pdf = await renderItineraryPdf(trip, settings);

  const filename = `${trip.tripId}_Itinerary.pdf`;
  const title = trip.tripTitle || `Trip ${trip.tripId}`;
  const cost = trip.cost != null ? `${currencySymbol(trip.currency)}${Number(trip.cost).toLocaleString("en-IN")}` : "—";
  const agency = settings?.agencyName || "Your agency";

  try {
    await sendMail(mailer, {
      to: user.email,
      subject: `Itinerary ready: ${title}${trip.clientName ? ` — ${trip.clientName}` : ""}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#181c22">
        <p>Hi ${esc(user.name || "there")},</p>
        <p>Ching built this itinerary for you. The PDF is attached.</p>
        <table cellpadding="6" style="border-collapse:collapse">
          <tr><td><b>Trip</b></td><td>${esc(title)} (${esc(trip.tripId)})</td></tr>
          <tr><td><b>Client</b></td><td>${esc(trip.clientName || "—")}</td></tr>
          <tr><td><b>Guests</b></td><td>${esc(trip.adults ?? 0)} adults${trip.kids5to12 ? `, ${esc(trip.kids5to12)} children` : ""}</td></tr>
          <tr><td><b>Duration</b></td><td>${esc(trip.duration)}N / ${esc(Number(trip.duration || 0) + 1)}D</td></tr>
          <tr><td><b>Total</b></td><td>${esc(cost)}</td></tr>
        </table>
        <p style="color:#888">— ${esc(agency)}</p>
      </div>`,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
  } catch (err) {
    return NextResponse.json({ message: `Couldn't send the email: ${err.message}` }, { status: 502 });
  }

  return NextResponse.json({ message: "sent", to: user.email });
}
