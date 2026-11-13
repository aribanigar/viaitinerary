import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { importCatalogWorkbook, importSummaryText, ImportError } from "@/lib/excel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/bulk-import — import hotels, transport and destinations from a
// .csv or .xlsx (multipart field "file"). Layout: see lib/excel.js. Returns
// what was added / updated and every skipped row with its reason.
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ message: "Choose a .csv or .xlsx file to import." }, { status: 422 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importCatalogWorkbook(buffer, adminId, {
      fileName: file.name || "",
      isDmcBridge: !!user.isDmcBridge,
    });
    return NextResponse.json({ message: importSummaryText(result), ...result });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ message: err.message }, { status: 422 });
    console.error("bulk import failed", err);
    return NextResponse.json({ message: `Import failed: ${err.message}` }, { status: 500 });
  }
}
