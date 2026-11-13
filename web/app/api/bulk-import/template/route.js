import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { templateCsv, CSV_CONTENT_TYPE } from "@/lib/excel";

export const dynamic = "force-dynamic";

// GET /api/bulk-import/template — the sample CSV: example Hotel, Transport and
// Destination rows in the layout /api/bulk-import reads.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

  return new Response(templateCsv(), {
    headers: {
      "Content-Type": CSV_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="catalog_import_sample.csv"',
    },
  });
}
