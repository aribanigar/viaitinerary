import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { storageEnabled, uploadBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, matching the Laravel rule.

// POST /api/super-admin/blog/images — editor image upload. Uploads to Supabase
// Storage and returns the public URL; falls back to an inline data URL if
// storage isn't configured.
export async function POST(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ message: "An image file is required." }, { status: 422 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ message: "Image must be a jpeg, png or webp." }, { status: 422 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ message: "Image must be 5 MB or smaller." }, { status: 422 });
  }

  if (storageEnabled()) {
    try {
      const url = await uploadBuffer(buffer, file.type, "blog");
      return NextResponse.json({ url, path: url }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ message: `Image upload failed: ${e.message}` }, { status: 502 });
    }
  }

  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  return NextResponse.json({ url: dataUrl, path: null }, { status: 201 });
}

// DELETE /api/super-admin/blog/images — no-op (images are inline, not files).
export async function DELETE(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json({ message: "Image removed." });
}
