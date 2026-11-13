import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { exportCatalogCsv, CSV_CONTENT_TYPE } from "@/lib/excel";

export const dynamic = "force-dynamic";

// GET /api/bulk-export — the agency's hotels, transport and destinations as one
// CSV in the same layout the import reads (export → edit → import).
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
  const adminId = await adminIdOf(user);

  try {
    const csv = await exportCatalogCsv(adminId);
    return new Response(csv, {
      headers: {
        "Content-Type": CSV_CONTENT_TYPE,
        "Content-Disposition": 'attachment; filename="catalog_export.csv"',
      },
    });
  } catch (err) {
    console.error("bulk export failed", err);
    return NextResponse.json({ message: `Export failed: ${err.message}` }, { status: 500 });
  }
}
