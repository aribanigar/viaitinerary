import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { mailerForAdminId, sendMail } from "@/lib/mailer";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// POST /api/public/proposals/:token/respond { action: "approve" | "request_changes", name?, message? }
// The client's answer to a proposal. Notifies the agency in-app and, when the
// agency has email set up, by email to its own address.
export async function POST(request, { params }) {
  const limit = await rateLimit(`proposal-respond:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);
  if (!TOKEN_RE.test(params.token || "")) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (action !== "approve" && action !== "request_changes") {
    return NextResponse.json({ message: "Unknown response." }, { status: 422 });
  }
  const message = String(body.message ?? "").trim().slice(0, 2000) || null;
  const name = String(body.name ?? "").trim().slice(0, 120) || null;
  if (action === "request_changes" && !message) {
    return NextResponse.json({ message: "Please tell us what you'd like to change." }, { status: 422 });
  }

  const trip = await prisma.trip.findUnique({ where: { proposalToken: params.token } });
  if (!trip || trip.isPackage) return NextResponse.json({ message: "This proposal link is no longer valid." }, { status: 404 });

  const response = action === "approve" ? "approved" : "changes_requested";
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: { proposalResponse: response, proposalRespondedAt: new Date(), proposalMessage: message, proposalResponder: name },
  });

  const who = name || trip.clientName || "Your client";
  const headline =
    response === "approved"
      ? `${who} approved the trip ${trip.tripTitle} (${trip.tripId})`
      : `${who} asked for changes to ${trip.tripTitle} (${trip.tripId})`;
  await notify(trip.userId, response === "approved" ? "proposal_approved" : "proposal_changes", {
    type: response === "approved" ? "proposal_approved" : "proposal_changes",
    message: message ? `${headline}: “${message.slice(0, 200)}”` : headline,
    trip_id: trip.tripId,
    client_name: trip.clientName,
    client_phone: trip.clientPhone,
  });

  // Best effort: email the agency itself (its own SMTP address).
  try {
    const { settings, mailer } = await mailerForAdminId(trip.userId);
    const to = settings?.smtpEmail || settings?.contactEmail;
    if (mailer && to) {
      await sendMail(mailer, {
        to,
        subject: headline,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#181c22">
          <p><b>${esc(headline)}</b></p>
          ${message ? `<p>Message from the client:</p><blockquote style="border-left:3px solid #ddd;margin:0;padding:6px 12px">${esc(message)}</blockquote>` : ""}
          <p>Client: ${esc(trip.clientName || "—")} · ${esc(trip.clientPhone || "")} · ${esc(trip.clientEmail || "")}</p>
        </div>`,
      });
    }
  } catch (err) {
    console.error("proposal response email failed:", err.message);
  }

  return NextResponse.json({
    response: updated.proposalResponse,
    responded_at: updated.proposalRespondedAt.toISOString(),
    responder: updated.proposalResponder,
  });
}
