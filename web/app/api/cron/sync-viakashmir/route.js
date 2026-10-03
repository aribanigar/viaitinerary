import { NextResponse } from "next/server";
import { connectedAccountIds, syncViaKashmirCatalog } from "@/lib/viaKashmirCatalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-viakashmir - nightly refresh of the Via Kashmir catalog
 * for every connected account (DMC partners get DMC prices, the internal
 * account gets B2B net - decided per account by lib/viaKashmirCatalog.js).
 * Same CRON_SECRET bearer check as /api/cron/sync-b2b-hotels.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && (request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const results = [];
  for (const id of await connectedAccountIds()) {
    try {
      results.push({ account_id: id, ...(await syncViaKashmirCatalog(id)) });
    } catch (e) {
      results.push({ account_id: id, error: e.message });
    }
  }
  return NextResponse.json({ accounts: results.length, results });
}
