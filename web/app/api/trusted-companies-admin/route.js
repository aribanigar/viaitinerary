import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializeCompany, storeLogo } from "@/lib/siteContent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trusted-companies-admin?search=&page=&per_page= — super admin.
export async function GET(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "25", 10) || 25));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const where = search ? { name: { contains: search, mode: "insensitive" } } : {};
  const [total, rows] = await Promise.all([
    prisma.trustedCompany.count({ where }),
    prisma.trustedCompany.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ]);
  const from = total ? (page - 1) * perPage + 1 : 0;
  return NextResponse.json({
    data: rows.map(serializeCompany),
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
    from,
    to: total ? from + rows.length - 1 : 0,
  });
}

// POST /api/trusted-companies-admin (multipart: name, logo, is_active) — super admin.
export async function POST(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  const form = await request.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").trim();
  if (!name || name.length > 255) {
    return NextResponse.json({ message: "The name field is required.", errors: { name: ["The name field is required."] } }, { status: 422 });
  }
  const logo = await storeLogo(form.get("logo"));
  if (logo.error) return NextResponse.json({ message: logo.error, errors: { logo: [logo.error] } }, { status: 422 });
  const active = form.get("is_active");
  const row = await prisma.trustedCompany.create({
    data: { name, logoPath: logo.url, isActive: active == null ? true : active === "1" || active === "true" },
  });
  return NextResponse.json(serializeCompany(row), { status: 201 });
}
