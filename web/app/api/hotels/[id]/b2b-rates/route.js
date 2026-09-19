import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";

export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

// The agency's own hotel-vendor rate portal — a first-party system (unlike
// MakeMyTrip/Goibibo, which have no public API and block scraping), so a
// live server-to-server fetch of its already-public listing is legitimate.
const B2B_PORTAL_HOTELS_URL = "https://b2b.viakashmiritinerary.in/api/hotels";

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Fuzzy name match: every significant word in our catalog hotel's name must
// appear in the B2B listing's name (order-independent), so "The Lalit Grand
// Palace" matches a B2B listing named "Lalit Grand Palace Srinagar" but an
// unrelated hotel doesn't.
function namesMatch(catalogName, b2bName) {
  const catalogWords = normalize(catalogName)
    .split(" ")
    .filter((w) => w.length > 2);
  if (!catalogWords.length) return false;
  const b2bNormalized = normalize(b2bName);
  return catalogWords.every((w) => b2bNormalized.includes(w));
}

// GET /api/hotels/:id/b2b-rates — find this hotel on the B2B portal by name
// and return its current room rates, for the Market Reference Price panel.
export async function GET(request, { params }) {
  const user = await userFromRequest(request);
  if (!user) return unauth();
  const adminId = await adminIdOf(user);
  const numId = parseInt(params.id, 10);
  if (Number.isNaN(numId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  const hotel = await prisma.hotel.findFirst({ where: { id: numId, userId: adminId } });
  if (!hotel) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let portalHotels;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(B2B_PORTAL_HOTELS_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`B2B portal returned ${res.status}`);
    const body = await res.json();
    portalHotels = body.hotels || [];
  } catch (err) {
    return NextResponse.json(
      { message: "Couldn't reach the B2B portal right now.", detail: err.message },
      { status: 502 },
    );
  }

  const matches = portalHotels.filter((h) => namesMatch(hotel.name, h.name));

  return NextResponse.json({
    matches: matches.map((h) => ({
      id: h.id,
      name: h.name,
      location_label: h.locationLabel,
      updated_at: h.updatedAt,
      rooms: (h.rooms || []).map((r) => ({
        id: r.id,
        type: r.type,
        category: r.category,
        meal: r.meal,
        ep: r.ep,
        cp: r.cp,
        map: r.map,
        ap: r.ap,
        mmt_price: r.mmtPrice || 0,
        goibibo_price: r.goibiboPrice || 0,
        status: r.status,
      })),
    })),
  });
}
