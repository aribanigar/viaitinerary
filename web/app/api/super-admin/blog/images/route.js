import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST/DELETE /api/super-admin/blog/images — editor image upload/remove.
// File storage (uploads to disk/S3) is implemented in the storage phase of the
// port; these endpoints exist so the blog editor wires up and report status.
async function guard(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json(
    { message: "Image uploads are being migrated and will be enabled in the storage phase." },
    { status: 501 }
  );
}

export const POST = guard;
export const DELETE = guard;
