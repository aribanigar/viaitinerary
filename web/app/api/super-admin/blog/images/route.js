import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, matching the Laravel rule.

// POST /api/super-admin/blog/images — editor image upload. Like the rest of the
// app, images are stored inline (as data URLs) rather than on an external disk,
// so this returns a data URL the editor embeds directly.
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

  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  return NextResponse.json({ url: dataUrl, path: null }, { status: 201 });
}

// DELETE /api/super-admin/blog/images — no-op (images are inline, not files).
export async function DELETE(request) {
  const { error, status } = await requireSuperAdmin(request);
  if (error) return NextResponse.json({ message: error }, { status });
  return NextResponse.json({ message: "Image removed." });
}
