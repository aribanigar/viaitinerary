import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { importCatalogWorkbook } from "@/lib/excel";

export const dynamic = "force-dynamic";

// POST /api/bulk-import — import the Transportation/Accommodation/Destinations
// workbook (multipart field "file") into the agency's catalogs.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ message: "An .xlsx file is required." }, { status: 422 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await importCatalogWorkbook(buffer, adminId);
    return NextResponse.json({ message: "Bulk data imported successfully" });
  } catch (err) {
    return NextResponse.json({ error: `An error occurred during bulk import: ${err.message}` }, { status: 500 });
  }
}
