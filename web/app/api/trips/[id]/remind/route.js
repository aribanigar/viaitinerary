import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { mailerForAdminId } from "@/lib/mailer";
import { sendProposalFollowUp, sendPaymentReminder, paymentDue, appOrigin } from "@/lib/followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/trips/:tripId/remind { kind: "proposal" | "payment" } — email the
// client now (agency SMTP), ignoring the daily timing rules; counts toward
// the same limits so the cron doesn't nudge again straight away.
export async function POST(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const trip = await prisma.trip.findFirst({ where: { tripId: params.id, userId: adminId, isPackage: false } });
  if (!trip) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "payment" ? "payment" : "proposal";
  if (!String(trip.clientEmail || "").trim()) {
    return NextResponse.json({ message: "Add the client's email to the trip first." }, { status: 422 });
  }
  const { settings, mailer } = await mailerForAdminId(adminId);
  if (!mailer) {
    return NextResponse.json({ message: "Email isn't set up yet — add your Gmail/SMTP under Settings." }, { status: 422 });
  }

  // Links in the email point at the app this request came through.
  const origin = new URL(request.url).origin || appOrigin(request);
  try {
    if (kind === "payment") {
      const due = paymentDue({ ...trip, status: trip.status, proposalResponse: trip.proposalResponse || "approved" }, settings);
      if (!due) return NextResponse.json({ message: "Nothing is due on this trip." }, { status: 422 });
      const res = await sendPaymentReminder(trip, settings, mailer, origin, due);
      return NextResponse.json({ ...res, kind });
    }
    const res = await sendProposalFollowUp(trip, settings, mailer, origin);
    if (!trip.proposalSentAt) await prisma.trip.update({ where: { id: trip.id }, data: { proposalSentAt: new Date() } });
    return NextResponse.json({ ...res, kind });
  } catch (err) {
    return NextResponse.json({ message: `Couldn't send the email: ${err.message}` }, { status: 502 });
  }
}
