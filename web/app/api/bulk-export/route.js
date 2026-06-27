import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { exportCatalogWorkbook, XLSX_CONTENT_TYPE } from "@/lib/excel";

export const dynamic = "force-dynamic";

// GET /api/bulk-export — download the agency's catalogs as an .xlsx workbook.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const adminId = await adminIdOf(user);

  try {
    const buffer = await exportCatalogWorkbook(adminId);
    return new Response(buffer, {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": 'attachment; filename="agency_data_export.xlsx"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: `An error occurred during bulk export: ${err.message}` }, { status: 500 });
  }
}
