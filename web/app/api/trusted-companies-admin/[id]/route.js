import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { serializeCompany, storeLogo } from "@/lib/siteContent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guard(request, params) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return { res: NextResponse.json({ message: error }, { status }) };
  const id = parseInt(params.id, 10);
  const row = Number.isFinite(id) ? await prisma.trustedCompany.findUnique({ where: { id } }) : null;
  if (!row) return { res: NextResponse.json({ message: "Not found" }, { status: 404 }) };
  return { row };
}

// GET /api/trusted-companies-admin/:id
export async function GET(request, { params }) {
  const { res, row } = await guard(request, params);
  return res || NextResponse.json(serializeCompany(row));
}

// Update (multipart name, logo?, is_active). The admin page sends POST with
// _method=PUT (a form upload), so POST and PUT both land here.
async function update(request, params) {
  const { res, row } = await guard(request, params);
  if (res) return res;
  const form = await request.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").trim();
  if (!name || name.length > 255) {
    return NextResponse.json({ message: "The name field is required.", errors: { name: ["The name field is required."] } }, { status: 422 });
  }
  const data = { name };
  const file = form.get("logo");
  if (file && typeof file === "object" && file.size > 0) {
    const logo = await storeLogo(file);
    if (logo.error) return NextResponse.json({ message: logo.error, errors: { logo: [logo.error] } }, { status: 422 });
    data.logoPath = logo.url;
  }
  const active = form.get("is_active");
  if (active != null) data.isActive = active === "1" || active === "true";
  const updated = await prisma.trustedCompany.update({ where: { id: row.id }, data });
  return NextResponse.json(serializeCompany(updated));
}

export async function POST(request, ctx) {
  return update(request, ctx.params);
}
export async function PUT(request, ctx) {
  return update(request, ctx.params);
}

// DELETE /api/trusted-companies-admin/:id
export async function DELETE(request, { params }) {
  const { res, row } = await guard(request, params);
  if (res) return res;
  await prisma.trustedCompany.delete({ where: { id: row.id } });
  return new NextResponse(null, { status: 204 });
}
