import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { rateLimit, rateLimitedResponse, clientIp } from "@/lib/rateLimit";
import { parseDemoRequest, serializeDemoRequest, emailDemoRequest } from "@/lib/demoRequests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/demo-requests — super admin list, newest first (paginated).
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const { searchParams } = new URL(request.url);
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "25", 10) || 25));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const [total, rows] = await Promise.all([
    prisma.demoRequest.count(),
    prisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ]);
  const from = total ? (page - 1) * perPage + 1 : 0;
  return NextResponse.json({
    data: rows.map(serializeDemoRequest),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
    from,
    to: total ? from + rows.length - 1 : 0,
  });
}

// POST /api/demo-requests — PUBLIC "Schedule a demo" form.
export async function POST(request) {
  const limit = await rateLimit(`demo-requests:${clientIp(request)}`);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds);

  const body = await request.json().catch(() => ({}));
  // Honeypot: bots fill the hidden "website" field.
  if (body.website) return NextResponse.json({ status: "success", message: "Demo request submitted successfully." }, { status: 201 });

  const { data, errors } = parseDemoRequest(body);
  if (errors) return NextResponse.json({ status: "error", message: "Validation error", errors }, { status: 422 });

  try {
    const created = await prisma.demoRequest.create({ data });
    await emailDemoRequest(created);
    return NextResponse.json(
      { status: "success", message: "Demo request submitted successfully.", data: serializeDemoRequest(created) },
      { status: 201 },
    );
  } catch (e) {
    console.error("demo request save failed:", e);
    return NextResponse.json({ status: "error", message: "Failed to submit demo request." }, { status: 500 });
  }
}
