import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { TRIP_INCLUDE } from "@/lib/trips";
import { renderItineraryPdf } from "@/lib/pdf";
import { mailerForAdminId, sendMail } from "@/lib/mailer";
import { ensureProposalToken, proposalStatus } from "@/lib/proposal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PDF_BYTES = 3 * 1024 * 1024; // see email-itinerary: Vercel's 4.5 MB body cap
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function loadTrip(request, params) {
  const user = await userFromRequest(request);
  if (!user) return { error: NextResponse.json({ message: "Unauthenticated." }, { status: 401 }) };
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId } });
  if (!trip) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { user, adminId, trip };
}

// GET /api/trips/:tripId/proposal — link + client response status.
export async function GET(request, { params }) {
  const { error, trip } = await loadTrip(request, params);
  if (error) return error;
  return NextResponse.json(proposalStatus(trip));
}

// POST /api/trips/:tripId/proposal
//   { regenerate?: true }                  — new link (the old one stops working)
//   { send: "whatsapp" }                   — mark as sent (the SPA opens WhatsApp itself)
//   { send: "email", pdf_base64?: string } — email the client the link (+ PDF)
export async function POST(request, { params }) {
  const { error, adminId, trip } = await loadTrip(request, params);
  if (error) return error;
  const body = await request.json().catch(() => ({}));

  const token = await ensureProposalToken(trip, { regenerate: !!body.regenerate });
  const url = `${new URL(request.url).origin}/p/${token}`;

  if (body.send === "email") {
    if (!trip.clientEmail) {
      return NextResponse.json({ message: "Add the client's email to the trip first." }, { status: 422 });
    }
    const { settings, mailer } = await mailerForAdminId(adminId);
    if (!mailer) {
      return NextResponse.json(
        { message: "Email isn't set up yet — add your Gmail/SMTP under Settings." },
        { status: 422 },
      );
    }
    let pdf = null;
    if (typeof body.pdf_base64 === "string" && body.pdf_base64) {
      const buf = Buffer.from(body.pdf_base64.replace(/^data:[^,]*,/, ""), "base64");
      if (buf.length > 0 && buf.length <= MAX_PDF_BYTES && buf.subarray(0, 4).toString() === "%PDF") pdf = buf;
    }
    if (!pdf) {
      const full = await prisma.trip.findUnique({ where: { id: trip.id }, include: TRIP_INCLUDE });
      pdf = await renderItineraryPdf(full, settings);
    }
    const agency = settings?.agencyName || "Your travel agent";
    const brand = settings?.brandColor || "#181c22";
    const title = trip.tripTitle || "your trip";
    try {
      await sendMail(mailer, {
        to: trip.clientEmail,
        subject: `Your ${title} proposal from ${agency}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#181c22;max-width:560px">
          <p>Dear ${esc(trip.clientName || "Guest")},</p>
          <p>Thank you for choosing ${esc(agency)}. Your itinerary for <b>${esc(title)}</b> is ready.
          Open it below to see the day-wise plan, hotels and price, and approve it or tell us what to change.</p>
          <p style="margin:28px 0"><a href="${esc(url)}" style="background:${esc(brand)};color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:bold">View &amp; approve your trip</a></p>
          <p style="font-size:13px;color:#666">The itinerary PDF is attached as well. If the button doesn't work, open this link:<br>${esc(url)}</p>
          <p>Warm regards,<br>${esc(agency)}${settings?.contactPhone ? `<br>${esc(settings.contactPhone)}` : ""}</p>
        </div>`,
        attachments: [{ filename: `${trip.tripId}_Itinerary.pdf`, content: pdf, contentType: "application/pdf" }],
      });
    } catch (err) {
      return NextResponse.json({ message: `Couldn't send the email: ${err.message}` }, { status: 502 });
    }
  }

  const updated = body.send
    ? await prisma.trip.update({ where: { id: trip.id }, data: { proposalSentAt: new Date() } })
    : await prisma.trip.findUnique({ where: { id: trip.id } });
  return NextResponse.json({ ...proposalStatus(updated), url, sent_to: body.send === "email" ? trip.clientEmail : null });
}
