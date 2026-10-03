import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { mailerForAdminId, sendMail } from "@/lib/mailer";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";
import { bookingByToken, publicBooking, SUPPLIER_TOKEN_RE, fmtDay } from "@/lib/operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (v, n) => String(v ?? "").trim().slice(0, n) || null;

async function load(token) {
  if (!SUPPLIER_TOKEN_RE.test(token || "")) return null;
  const found = await bookingByToken(token);
  if (!found || found.trip.isPackage) return null;
  const settings = await prisma.agencySetting.findUnique({ where: { userId: found.trip.userId } });
  return { ...found, settings };
}

// GET /api/public/supplier/:token — the booking a supplier is asked to confirm
// (allowlisted: no prices, no client contact details).
export async function GET(request, { params }) {
  const f = await load(params.token);
  if (!f) return NextResponse.json({ message: "This booking link is no longer valid." }, { status: 404 });
  return NextResponse.json(publicBooking(f));
}

// POST /api/public/supplier/:token { action: "confirm"|"decline", reference?, note?,
//   driver_name?, driver_phone?, vehicle_number? } — the supplier's answer.
export async function POST(request, { params }) {
  const limit = await rateLimit(`supplier-respond:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);
  const f = await load(params.token);
  if (!f) return NextResponse.json({ message: "This booking link is no longer valid." }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const action = b.action;
  if (action !== "confirm" && action !== "decline") return NextResponse.json({ message: "Unknown response." }, { status: 422 });
  const note = clip(b.note, 1000);
  if (action === "decline" && !note) {
    return NextResponse.json({ message: "Please tell the agency why (e.g. sold out, or an alternative)." }, { status: 422 });
  }

  const data = {
    supplierStatus: action === "confirm" ? "confirmed" : "declined",
    supplierRespondedAt: new Date(),
    supplierNote: note,
    supplierRef: action === "confirm" ? clip(b.reference, 120) : null,
  };
  const ids = f.siblings.map((s) => s.id);
  if (f.kind === "hotel") {
    await prisma.accommodation.updateMany({ where: { id: { in: ids } }, data });
  } else {
    if (action === "confirm") {
      if (b.driver_name !== undefined) data.driverName = clip(b.driver_name, 120);
      if (b.driver_phone !== undefined) data.driverPhone = clip(b.driver_phone, 40);
      if (b.vehicle_number !== undefined) data.vehicleNumber = clip(b.vehicle_number, 40)?.toUpperCase() ?? null;
    }
    await prisma.transportation.updateMany({ where: { id: { in: ids } }, data });
  }

  const fresh = await load(params.token);
  const booking = publicBooking(fresh);
  const what = f.kind === "hotel" ? `${booking.hotel} (${fmtDay(booking.check_in)})` : `${booking.vehicle} (${booking.days.length} day${booking.days.length === 1 ? "" : "s"})`;
  const headline =
    action === "confirm"
      ? `${what} confirmed for ${f.trip.clientName || "your guest"} — ${f.trip.tripId}${data.supplierRef ? ` · ref ${data.supplierRef}` : ""}`
      : `${what} DECLINED for ${f.trip.clientName || "your guest"} — ${f.trip.tripId}`;
  await notify(f.trip.userId, action === "confirm" ? "supplier_confirmed" : "supplier_declined", {
    type: action === "confirm" ? "supplier_confirmed" : "supplier_declined",
    message: note ? `${headline}: “${note.slice(0, 200)}”` : headline,
    trip_id: f.trip.tripId,
    client_name: f.trip.clientName,
    client_phone: f.trip.clientPhone,
  });
  try {
    const { settings, mailer } = await mailerForAdminId(f.trip.userId);
    const to = settings?.smtpEmail || settings?.contactEmail;
    if (mailer && to) {
      const driver = f.kind === "cab" && booking.driver_name ? `<p>Driver: ${esc(booking.driver_name)} ${esc(booking.driver_phone || "")} · ${esc(booking.vehicle_number || "")}</p>` : "";
      await sendMail(mailer, {
        to,
        subject: headline,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#181c22"><p><b>${esc(headline)}</b></p>${note ? `<p>Supplier's note: ${esc(note)}</p>` : ""}${driver}</div>`,
      });
    }
  } catch (err) {
    console.error("supplier response email failed:", err.message);
  }
  return NextResponse.json(booking);
}
