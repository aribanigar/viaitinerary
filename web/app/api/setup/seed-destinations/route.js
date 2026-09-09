import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ONE-TIME, token-gated: seeds a curated list of major Indian tourist
// destinations into every agency's own Destination catalog (each admin gets
// their own copy, since Destination is userId-scoped like Hotel/Vehicle).
// Skips names that already exist for that user, so it's safe to re-run.
// Delete this route once seeding is confirmed done.
const INDIA_DESTINATIONS = [
  { name: "Srinagar", state: "Jammu and Kashmir" },
  { name: "Gulmarg", state: "Jammu and Kashmir" },
  { name: "Pahalgam", state: "Jammu and Kashmir" },
  { name: "Sonmarg", state: "Jammu and Kashmir" },
  { name: "Leh", state: "Ladakh" },
  { name: "Nubra Valley", state: "Ladakh" },
  { name: "Pangong Lake", state: "Ladakh" },
  { name: "Kargil", state: "Ladakh" },
  { name: "Manali", state: "Himachal Pradesh" },
  { name: "Shimla", state: "Himachal Pradesh" },
  { name: "Dharamshala", state: "Himachal Pradesh" },
  { name: "Kasol", state: "Himachal Pradesh" },
  { name: "Spiti Valley", state: "Himachal Pradesh" },
  { name: "Dalhousie", state: "Himachal Pradesh" },
  { name: "Rishikesh", state: "Uttarakhand" },
  { name: "Haridwar", state: "Uttarakhand" },
  { name: "Nainital", state: "Uttarakhand" },
  { name: "Mussoorie", state: "Uttarakhand" },
  { name: "Jim Corbett", state: "Uttarakhand" },
  { name: "Auli", state: "Uttarakhand" },
  { name: "Delhi", state: "Delhi" },
  { name: "Agra", state: "Uttar Pradesh" },
  { name: "Varanasi", state: "Uttar Pradesh" },
  { name: "Lucknow", state: "Uttar Pradesh" },
  { name: "Jaipur", state: "Rajasthan" },
  { name: "Udaipur", state: "Rajasthan" },
  { name: "Jodhpur", state: "Rajasthan" },
  { name: "Jaisalmer", state: "Rajasthan" },
  { name: "Pushkar", state: "Rajasthan" },
  { name: "Mount Abu", state: "Rajasthan" },
  { name: "Mumbai", state: "Maharashtra" },
  { name: "Pune", state: "Maharashtra" },
  { name: "Lonavala", state: "Maharashtra" },
  { name: "Mahabaleshwar", state: "Maharashtra" },
  { name: "Nashik", state: "Maharashtra" },
  { name: "Aurangabad", state: "Maharashtra" },
  { name: "Goa", state: "Goa" },
  { name: "Kochi", state: "Kerala" },
  { name: "Munnar", state: "Kerala" },
  { name: "Alleppey", state: "Kerala" },
  { name: "Wayanad", state: "Kerala" },
  { name: "Thekkady", state: "Kerala" },
  { name: "Kovalam", state: "Kerala" },
  { name: "Bangalore", state: "Karnataka" },
  { name: "Mysore", state: "Karnataka" },
  { name: "Coorg", state: "Karnataka" },
  { name: "Hampi", state: "Karnataka" },
  { name: "Chikmagalur", state: "Karnataka" },
  { name: "Chennai", state: "Tamil Nadu" },
  { name: "Ooty", state: "Tamil Nadu" },
  { name: "Kodaikanal", state: "Tamil Nadu" },
  { name: "Rameswaram", state: "Tamil Nadu" },
  { name: "Madurai", state: "Tamil Nadu" },
  { name: "Hyderabad", state: "Telangana" },
  { name: "Visakhapatnam", state: "Andhra Pradesh" },
  { name: "Tirupati", state: "Andhra Pradesh" },
  { name: "Kolkata", state: "West Bengal" },
  { name: "Darjeeling", state: "West Bengal" },
  { name: "Kalimpong", state: "West Bengal" },
  { name: "Sundarbans", state: "West Bengal" },
  { name: "Gangtok", state: "Sikkim" },
  { name: "Pelling", state: "Sikkim" },
  { name: "Lachung", state: "Sikkim" },
  { name: "Guwahati", state: "Assam" },
  { name: "Kaziranga", state: "Assam" },
  { name: "Shillong", state: "Meghalaya" },
  { name: "Cherrapunji", state: "Meghalaya" },
  { name: "Tawang", state: "Arunachal Pradesh" },
  { name: "Port Blair", state: "Andaman and Nicobar Islands" },
  { name: "Havelock Island", state: "Andaman and Nicobar Islands" },
  { name: "Rann of Kutch", state: "Gujarat" },
  { name: "Ahmedabad", state: "Gujarat" },
  { name: "Dwarka", state: "Gujarat" },
  { name: "Diu", state: "Gujarat" },
  { name: "Khajuraho", state: "Madhya Pradesh" },
  { name: "Pachmarhi", state: "Madhya Pradesh" },
  { name: "Bhopal", state: "Madhya Pradesh" },
  { name: "Puri", state: "Odisha" },
  { name: "Bhubaneswar", state: "Odisha" },
  { name: "Chandigarh", state: "Chandigarh" },
  { name: "Amritsar", state: "Punjab" },
].map((d) => ({ ...d, country: "India" }));

async function handle(request) {
  const requiredToken = process.env.SETUP_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ message: "Setup is disabled (SETUP_TOKEN not configured)." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const suppliedToken = searchParams.get("token") || request.headers.get("x-setup-token");
  if (suppliedToken !== requiredToken) {
    return NextResponse.json({ message: "Invalid or missing setup token." }, { status: 401 });
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] } },
    select: { id: true, email: true },
  });

  const results = [];
  for (const admin of admins) {
    const existing = await prisma.destination.findMany({
      where: { userId: admin.id },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((d) => d.name.trim().toLowerCase()));
    const toCreate = INDIA_DESTINATIONS.filter(
      (d) => !existingNames.has(d.name.toLowerCase())
    ).map((d) => ({ ...d, userId: admin.id, activities: [] }));

    if (toCreate.length > 0) {
      await prisma.destination.createMany({ data: toCreate });
    }
    results.push({ email: admin.email, added: toCreate.length, skipped: INDIA_DESTINATIONS.length - toCreate.length });
  }

  return NextResponse.json({ message: "Destination seeding complete.", results });
}

export const GET = handle;
export const POST = handle;
