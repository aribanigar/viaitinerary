import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { templateWorkbook, XLSX_CONTENT_TYPE } from "@/lib/excel";

export const dynamic = "force-dynamic";

// GET /api/bulk-import/template — download a blank import workbook (headers only).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const buffer = templateWorkbook();
  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="bulk_import_template.xlsx"',
    },
  });
}
