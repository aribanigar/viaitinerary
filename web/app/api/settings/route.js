import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { settingsToCamel, SETTINGS_DEFAULTS } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// camelCase request key -> Prisma column
const FIELD_MAP = {
  agencyName: "agencyName",
  phone: "contactPhone",
  website: "website",
  companyAddress: "companyAddress",
  email: "contactEmail",
  whatsapp: "whatsapp",
  brandColor: "brandColor",
  secondaryColor: "secondaryColor",
  fontFamily: "fontFamily",
  logo: "logoPath",
  confirmationHeroImage: "confirmationHeroImage",
  defaultTripImage: "defaultTripImagePath",
  beneficiaryName: "beneficiaryName",
  bankName: "bankName",
  accountNumber: "accountNumber",
  ifscCode: "ifscCode",
  greetingMessage: "greetingMessage",
  confirmationMessage: "confirmationMessage",
  confirmationPdfMessage: "confirmationPdfMessage",
  paymentVoucherEmailMessage: "paymentVoucherEmailMessage",
  invoiceEmailMessage: "invoiceEmailMessage",
  gstPercentage: "gstPercentage",
  profitMarginPercentage: "profitMarginPercentage",
  smtpEmail: "smtpEmail",
  smtpHost: "smtpHost",
  smtpPort: "smtpPort",
  smtpEncryption: "smtpEncryption",
  smtpAppPassword: "smtpAppPassword",
};

// GET /api/settings
export async function GET(request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  const adminId = await adminIdOf(user);
  const settings = await prisma.agencySetting.findUnique({ where: { userId: adminId } });
  return NextResponse.json(settings ? settingsToCamel(settings) : SETTINGS_DEFAULTS);
}

// PUT /api/settings — upsert (partial; only provided keys are written).
export async function PUT(request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
    const adminId = await adminIdOf(user);
    const body = await request.json();

    const data = {};
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (body[key] !== undefined) data[col] = body[key];
    }
    if (data.smtpPort !== undefined && data.smtpPort !== null && data.smtpPort !== "") {
      data.smtpPort = parseInt(data.smtpPort, 10);
    }
    if (body.clearSmtpPassword) data.smtpAppPassword = null;

    const settings = await prisma.agencySetting.upsert({
      where: { userId: adminId },
      update: data,
      create: { userId: adminId, ...data },
    });
    return NextResponse.json(settingsToCamel(settings));
  } catch (err) {
    return NextResponse.json({ message: err.message || "Failed to save settings" }, { status: 500 });
  }
}
