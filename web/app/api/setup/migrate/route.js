import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// This route runs ~35 sequential statements against the DB — well past the
// Hobby plan's default 10s function timeout. 60s is the Hobby plan max.
export const maxDuration = 60;

// ONE-TIME, token-gated schema-sync fallback for when `prisma db push` can't
// run at build time (e.g. the Postgres pooler's DDL port is unreachable from
// Vercel's build network for this project). Every statement is written to be
// safe to re-run — IF NOT EXISTS everywhere, and constraint/index statements
// that don't support that syntax are simply caught and skipped if they
// already exist. Delete this route once the schema is confirmed in sync.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "complementary_services" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "selling_price" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "complementary_services_user_id_idx" ON "complementary_services"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "rate_limit_attempts" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "rate_limit_attempts_key_created_at_idx" ON "rate_limit_attempts"("key","created_at")`,

  `CREATE TABLE IF NOT EXISTS "hotel_blackouts" (
    "id" SERIAL PRIMARY KEY,
    "hotel_id" INTEGER NOT NULL,
    "room_type" TEXT,
    "type" TEXT NOT NULL DEFAULT 'blackout',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "hotel_blackouts_hotel_id_idx" ON "hotel_blackouts"("hotel_id")`,
  `ALTER TABLE "hotel_blackouts" ADD CONSTRAINT "hotel_blackouts_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE`,

  `CREATE TABLE IF NOT EXISTS "vehicle_blackouts" (
    "id" SERIAL PRIMARY KEY,
    "vehicle_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'blackout',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "vehicle_blackouts_vehicle_id_idx" ON "vehicle_blackouts"("vehicle_id")`,
  `ALTER TABLE "vehicle_blackouts" ADD CONSTRAINT "vehicle_blackouts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE`,

  `ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'India'`,
  `ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "state" TEXT`,
  `ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "city" TEXT`,

  `ALTER TABLE "agency_settings" ADD COLUMN IF NOT EXISTS "cost_activities" BOOLEAN NOT NULL DEFAULT false`,

  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_id" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_supabase_id_key" ON "users"("supabase_id")`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT`,

  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id")`,

  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "total_rooms" INTEGER`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "request_count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "last_requested_at" TIMESTAMP(3)`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "market_prices" JSONB`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "payment_terms" JSONB`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "external_source" TEXT`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "external_id" TEXT`,
  `ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "hotels_user_id_external_source_external_id_key" ON "hotels"("user_id","external_source","external_id")`,

  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "vehicle_type" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "is_ac" BOOLEAN`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "seating_capacity" INTEGER`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "luggage_capacity" INTEGER`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "fuel_type" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "registration_number" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "city" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "state" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "is_available" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "image_path" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "rate_type" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "extra_km_rate" DECIMAL(12,2)`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "extra_hour_rate" DECIMAL(12,2)`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "driver_allowance" DECIMAL(12,2)`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "night_halt_charges" DECIMAL(12,2)`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "min_km_per_day" INTEGER`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "toll_parking_included" BOOLEAN`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "features" JSONB`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "request_count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "last_requested_at" TIMESTAMP(3)`,
];

async function handle(request) {
  // No rateLimit() gate here on purpose: this route's whole job is to run
  // before rate_limit_attempts necessarily exists, so calling it would throw
  // before we ever reach the statements below. The SETUP_TOKEN check is the
  // only gate, same as it was before rate limiting existed.
  const requiredToken = process.env.SETUP_TOKEN;
  if (!requiredToken) {
    return NextResponse.json({ message: "Setup is disabled (SETUP_TOKEN not configured)." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const suppliedToken = searchParams.get("token") || request.headers.get("x-setup-token");
  if (suppliedToken !== requiredToken) {
    return NextResponse.json({ message: "Invalid or missing setup token." }, { status: 401 });
  }

  const results = [];
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ sql: sql.split("\n")[0].trim(), status: "ok" });
    } catch (err) {
      results.push({ sql: sql.split("\n")[0].trim(), status: "skipped", error: err.message });
    }
  }

  return NextResponse.json({ message: "Schema sync complete.", results });
}

export const GET = handle;
export const POST = handle;
