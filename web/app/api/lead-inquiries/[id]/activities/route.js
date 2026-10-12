import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import {
  serializeLead,
  serializeActivity,
  logLeadActivity,
  toDateTime,
  CONTACT_TYPES,
} from "@/lib/leads";

export const dynamic = "force-dynamic";

// Types an agent logs by hand (the rest are written by the server).
const LOGGABLE = ["note", ...CONTACT_TYPES];

async function scopedLead(request, params) {
  const user = await userFromRequest(request);
  if (!user) return { error: NextResponse.json({ message: "Unauthenticated." }, { status: 401 }) };
  const adminId = await adminIdOf(user);
  const lead = await prisma.leadInquiry.findFirst({ where: { id: parseInt(params.id, 10), userId: adminId } });
  if (!lead) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { user, adminId, lead };
}

// GET /api/lead-inquiries/:id/activities — the lead's timeline, newest first.
export async function GET(request, { params }) {
  const { error, adminId, lead } = await scopedLead(request, params);
  if (error) return error;
  const activities = await prisma.leadActivity.findMany({
    where: { leadId: lead.id, userId: adminId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ids = [...new Set(activities.map((a) => a.authorId).filter(Boolean))];
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  return NextResponse.json({ activities: activities.map((a) => serializeActivity(a, byId.get(a.authorId) || null)) });
}

/**
 * POST /api/lead-inquiries/:id/activities — log a note, call, WhatsApp
 * message, email or meeting. Reaching the client stamps `lastContactedAt` and
 * moves a New lead to Contacted; `next_follow_up_at` books the next chase
 * (null / "" closes the current one — "done").
 */
export async function POST(request, { params }) {
  const { error, user, lead } = await scopedLead(request, params);
  if (error) return error;
  const b = await request.json();

  const type = String(b.type || "note");
  if (!LOGGABLE.includes(type)) return NextResponse.json({ message: "Invalid activity type." }, { status: 422 });
  const body = String(b.body ?? "").trim().slice(0, 4000) || null;
  if (type === "note" && !body) return NextResponse.json({ message: "Write the note first." }, { status: 422 });
  const outcome = b.outcome ? String(b.outcome).slice(0, 60) : null;

  const data = {};
  const extra = [];
  if (CONTACT_TYPES.includes(type)) {
    data.lastContactedAt = new Date();
    if (lead.status === "new") {
      data.status = "contacted";
      extra.push(["status", "New → Contacted", { from: "new", to: "contacted" }]);
    }
  }
  if (b.next_follow_up_at !== undefined) {
    const when = toDateTime(b.next_follow_up_at);
    if (when === undefined) return NextResponse.json({ message: "Invalid follow-up date." }, { status: 422 });
    data.nextFollowUpAt = when;
    data.followUpRemindedAt = null;
  }

  const activity = await logLeadActivity(lead, user.id, type, body, {
    ...(outcome ? { outcome } : {}),
    ...(b.template ? { template: String(b.template).slice(0, 40) } : {}),
    ...(data.nextFollowUpAt ? { next_follow_up_at: data.nextFollowUpAt } : {}),
  });
  if (!activity) return NextResponse.json({ message: "Could not save the activity." }, { status: 500 });

  const updated = Object.keys(data).length ? await prisma.leadInquiry.update({ where: { id: lead.id }, data }) : lead;
  for (const [t, text, meta] of extra) await logLeadActivity(updated, user.id, t, text, meta);

  return NextResponse.json(
    {
      activity: serializeActivity(activity, { id: user.id, name: user.name }),
      inquiry: serializeLead(updated),
    },
    { status: 201 }
  );
}
