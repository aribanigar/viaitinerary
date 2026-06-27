import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { generateInquiryId } from "@/lib/leads";
import { readFirstSheetRows } from "@/lib/excel";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "quoted", "converted", "closed"];
const str = (v) => (v == null ? "" : String(v).trim());
const int = (v, d = 0) => (v === "" || v == null || Number.isNaN(parseInt(v, 10)) ? d : parseInt(v, 10));

// POST /api/lead-inquiries-bulk-import — import leads from an .xlsx (field "file").
export async function POST(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ message: "Only admin can import leads." }, { status: 403 });
  }
  const adminId = await adminIdOf(user);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ message: "An .xlsx file is required." }, { status: 422 });
  }

  try {
    const rows = readFirstSheetRows(Buffer.from(await file.arrayBuffer()));
    let imported = 0;
    for (const row of rows) {
      const clientName = str(row.client_name || row.name);
      const clientEmail = str(row.client_email || row.email);
      const destination = str(row.destination);
      if (!clientName || !clientEmail || !destination) continue;

      let startDate = null;
      if (str(row.start_date)) {
        const d = new Date(row.start_date);
        if (!Number.isNaN(d.getTime())) startDate = d;
      }
      let status = str(row.status).toLowerCase() || "new";
      if (!STATUSES.includes(status)) status = "new";

      const budget = row.approximate_budget;
      await prisma.leadInquiry.create({
        data: {
          inquiryId: generateInquiryId(),
          userId: adminId,
          clientName,
          clientEmail,
          clientPhone: str(row.client_phone || row.phone) || null,
          destination,
          adults: int(row.adults, 1),
          kidsCnb: int(row.kids_cnb, 0),
          kids5to12: int(row.kids_5_to_12, 0),
          startDate,
          duration: str(row.duration) ? String(int(row.duration)) : null,
          approximateBudget: budget !== "" && budget != null && !Number.isNaN(Number(budget)) ? Number(budget) : null,
          currency: str(row.currency) || "INR (₹)",
          specialRequests: str(row.special_requests) || null,
          status,
          notes: str(row.notes) || null,
          assignedTo: user.id,
          isPublic: false,
          sourceUrl: "Bulk Lead Import",
        },
      });
      imported++;
    }
    return NextResponse.json({ message: "Lead inquiries imported successfully.", imported });
  } catch (err) {
    return NextResponse.json({ message: "Failed to import lead inquiries.", error: err.message }, { status: 500 });
  }
}
