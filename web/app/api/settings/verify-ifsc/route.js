import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/settings/verify-ifsc?ifsc=XXXX — look up bank/branch from the IFSC.
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const ifsc = (new URL(request.url).searchParams.get("ifsc") || "").trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return NextResponse.json({ valid: false, message: "Invalid IFSC format." }, { status: 422 });
  }

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
    if (!res.ok) {
      return NextResponse.json({ valid: false, message: "IFSC not found." }, { status: 404 });
    }
    const d = await res.json();
    return NextResponse.json({
      valid: true,
      bank: d.BANK,
      branch: d.BRANCH,
      ifsc: d.IFSC,
      address: d.ADDRESS,
      city: d.CITY,
      state: d.STATE,
    });
  } catch (err) {
    return NextResponse.json({ valid: false, message: "IFSC lookup failed." }, { status: 502 });
  }
}
