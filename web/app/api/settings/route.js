import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { settingsToCamel, SETTINGS_DEFAULTS } from "@/lib/serialize";
import { persistImage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  currency: "currency",
  greetingMessage: "greetingMessage",
  confirmationMessage: "confirmationMessage",
  confirmationPdfMessage: "confirmationPdfMessage",
  paymentVoucherEmailMessage: "paymentVoucherEmailMessage",
  invoiceEmailMessage: "invoiceEmailMessage",
  gstPercentage: "gstPercentage",
  profitMarginPercentage: "profitMarginPercentage",
  costActivities: "costActivities",
  smtpEmail: "smtpEmail",
  smtpHost: "smtpHost",
  smtpPort: "smtpPort",
  smtpEncryption: "smtpEncryption",
  smtpAppPassword: "smtpAppPassword",
  googleMapsApiKey: "googleMapsApiKey",
  razorpayKeyId: "razorpayKeyId",
  razorpayKeySecret: "razorpayKeySecret",
  upiId: "upiId",
  advancePercentage: "advancePercentage",
  balanceDueDays: "balanceDueDays",
  autoConfirmOnPayment: "autoConfirmOnPayment",
  followUpsEnabled: "followUpsEnabled",
  followUpAfterHours: "followUpAfterHours",
  maxFollowUps: "maxFollowUps",
  paymentRemindersEnabled: "paymentRemindersEnabled",
  paymentReminderAfterDays: "paymentReminderAfterDays",
  supplierRemindersEnabled: "supplierRemindersEnabled",
  preArrivalEnabled: "preArrivalEnabled",
  driverDetailsEnabled: "driverDetailsEnabled",
  feedbackRequestsEnabled: "feedbackRequestsEnabled",
  reviewUrl: "reviewUrl",
};

const INT_FIELDS = ["smtpPort", "balanceDueDays", "followUpAfterHours", "maxFollowUps", "paymentReminderAfterDays"];

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
    for (const col of INT_FIELDS) {
      if (data[col] === "") data[col] = null;
      else if (data[col] !== undefined && data[col] !== null) data[col] = parseInt(data[col], 10);
    }
    // Non-nullable counters: an empty value means "back to the default".
    for (const col of ["balanceDueDays", "followUpAfterHours", "maxFollowUps", "paymentReminderAfterDays"]) {
      if (data[col] === null || Number.isNaN(data[col])) delete data[col];
    }
    if (data.advancePercentage === "") data.advancePercentage = null;
    if (body.clearSmtpPassword) data.smtpAppPassword = null;
    // Write-only secret: an empty value keeps the saved one; clear explicitly.
    if (data.razorpayKeySecret === "") delete data.razorpayKeySecret;
    if (body.clearRazorpay) {
      data.razorpayKeyId = null;
      data.razorpayKeySecret = null;
    }

    // Offload any newly-uploaded images (data URLs) to Supabase Storage.
    for (const col of ["logoPath", "confirmationHeroImage", "defaultTripImagePath"]) {
      if (data[col]) data[col] = await persistImage(String(data[col]), "agency");
    }

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
