import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userFromRequest } from "@/lib/auth";
import { adminIdOf } from "@/lib/scope";
import { persistImage } from "@/lib/storage";
import { catalogGate } from "@/lib/subscription";

const unauth = () => NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

const OWNER_SELECT = { id: true, name: true, email: true };

// The "owner" shown as Created By is the agency admin (adminId) — almost
// always the same person as the authenticated request user, since only
// team-role users resolve to a different admin. Reuse the already-fetched
// `user` row in that common case instead of a second DB round trip; every
// avoided query matters here since each one crosses the network to Postgres.
function ownerOf(user, adminId) {
  if (user.id === adminId) {
    return Promise.resolve({ id: user.id, name: user.name, email: user.email });
  }
  return prisma.user.findUnique({ where: { id: adminId }, select: OWNER_SELECT });
}

/**
 * Build paginated list + create handlers for a catalog model (destinations,
 * hotels, vehicles). `mapBody(body)` returns { data } or { error }.
 */
export function catalogCollection({ model, mapBody, serialize, searchField = "name", limitKind }) {
  return {
    async GET(request) {
      const user = await userFromRequest(request);
      if (!user) return unauth();
      const adminId = await adminIdOf(user);

      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search") || "";
      const perPage = Math.max(1, parseInt(searchParams.get("per_page") || "25", 10));
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

      const where = { userId: adminId };
      if (search) where[searchField] = { contains: search, mode: "insensitive" };

      const [total, items, owner] = await Promise.all([
        prisma[model].count({ where }),
        prisma[model].findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        ownerOf(user, adminId),
      ]);

      return NextResponse.json({
        data: items.map((i) => serialize({ ...i, user: owner })),
        current_page: page,
        last_page: Math.max(1, Math.ceil(total / perPage)),
        per_page: perPage,
        total,
      });
    },

    async POST(request) {
      const user = await userFromRequest(request);
      if (!user) return unauth();
      const adminId = await adminIdOf(user);
      if (limitKind) {
        const gate = await catalogGate(adminId, limitKind);
        if (!gate.allowed) return NextResponse.json({ message: gate.reason }, { status: gate.status });
      }
      const mapped = await mapBody(await request.json());
      if (mapped.error) return NextResponse.json({ message: mapped.error }, { status: 422 });
      const [created, owner] = await Promise.all([
        prisma[model].create({ data: { ...mapped.data, userId: adminId } }),
        ownerOf(user, adminId),
      ]);
      return NextResponse.json(serialize({ ...created, user: owner }), { status: 201 });
    },
  };
}

/** Build show/update/delete handlers for a catalog model (numeric :id). */
export function catalogItem({ model, mapBody, serialize }) {
  async function scoped(request, id) {
    const user = await userFromRequest(request);
    if (!user) return { error: unauth() };
    const adminId = await adminIdOf(user);
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return { error: NextResponse.json({ message: "Invalid id" }, { status: 400 }) };
    const item = await prisma[model].findFirst({ where: { id: numId, userId: adminId } });
    if (!item) return { error: NextResponse.json({ message: "Not found" }, { status: 404 }) };
    return { item, user, adminId };
  }

  return {
    async GET(request, { params }) {
      const r = await scoped(request, params.id);
      if (r.error) return r.error;
      const owner = await ownerOf(r.user, r.adminId);
      return NextResponse.json(serialize({ ...r.item, user: owner }));
    },
    async PUT(request, { params }) {
      const r = await scoped(request, params.id);
      if (r.error) return r.error;
      const mapped = await mapBody(await request.json(), r.item);
      if (mapped.error) return NextResponse.json({ message: mapped.error }, { status: 422 });
      const [updated, owner] = await Promise.all([
        prisma[model].update({ where: { id: r.item.id }, data: mapped.data }),
        ownerOf(r.user, r.adminId),
      ]);
      return NextResponse.json(serialize({ ...updated, user: owner }));
    },
    async DELETE(request, { params }) {
      const r = await scoped(request, params.id);
      if (r.error) return r.error;
      await prisma[model].delete({ where: { id: r.item.id } });
      return new NextResponse(null, { status: 204 });
    },
  };
}

// --- Per-resource body mappers (mirror the Laravel validation/fields) ---

export async function mapDestination(body) {
  if (!body.name) return { error: "name is required." };
  if (!Array.isArray(body.activities)) return { error: "activities must be an array." };
  const data = { name: body.name, activities: body.activities };
  if (body.photo) data.imagePath = await persistImage(String(body.photo), "destinations");
  return { data };
}

export async function mapHotel(body) {
  if (!body.name) return { error: "name is required." };
  const data = {
    name: body.name,
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    country: body.country ?? null,
    category: body.category ?? null,
    isAvailable: body.is_available !== undefined ? !!body.is_available : true,
    latitude: body.latitude !== undefined && body.latitude !== "" ? Number(body.latitude) : null,
    longitude: body.longitude !== undefined && body.longitude !== "" ? Number(body.longitude) : null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    priceSections: body.price_sections ?? [],
    totalRooms:
      body.total_rooms !== undefined && body.total_rooms !== ""
        ? parseInt(body.total_rooms, 10) || null
        : null,
    marketPrices: body.market_prices ?? undefined,
    paymentTerms: body.payment_terms ?? undefined,
  };
  if (body.photo) data.imagePath = await persistImage(String(body.photo), "hotels");
  return { data };
}

export async function mapVehicle(body) {
  if (!body.name) return { error: "name is required." };
  if (body.price === undefined || body.price === null || body.price === "")
    return { error: "price is required." };
  const num = (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);
  const int = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };
  const data = {
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    price: Number(body.price),
    vehicleType: body.vehicle_type ?? null,
    isAc: body.is_ac !== undefined ? (body.is_ac === "" ? null : !!body.is_ac) : null,
    seatingCapacity: int(body.seating_capacity),
    luggageCapacity: int(body.luggage_capacity),
    fuelType: body.fuel_type ?? null,
    registrationNumber: body.registration_number ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    country: body.country ?? null,
    isAvailable: body.is_available !== undefined ? !!body.is_available : true,
    rateType: body.rate_type ?? null,
    extraKmRate: num(body.extra_km_rate),
    extraHourRate: num(body.extra_hour_rate),
    driverAllowance: num(body.driver_allowance),
    nightHaltCharges: num(body.night_halt_charges),
    minKmPerDay: int(body.min_km_per_day),
    tollParkingIncluded:
      body.toll_parking_included !== undefined ? (body.toll_parking_included === "" ? null : !!body.toll_parking_included) : null,
    features: Array.isArray(body.features) ? body.features : undefined,
    notes: body.notes ?? null,
  };
  if (body.photo) data.imagePath = await persistImage(String(body.photo), "vehicles");
  return { data };
}
