# ViaKashmir DMC Partner Bridge

How a DMC partner approved on viakashmir.in gets a working itinerary-builder
account here, with real Via Kashmir inventory and DMC pricing, and without
ever being able to add their own destinations/hotels/vehicles.

## Where the code lives

This bridge is implemented in `web/` (the live Next.js + Prisma app deployed
to Vercel, `crm.viakashmir.in`) — **not** in `backend/`/`frontend/` (the
Laravel + Vite app). That app was superseded by `web/` around 2026-06/07 and
is no longer deployed; if you see DMC-bridge-shaped code there too, it's a
leftover from before that was noticed and should be treated as dead.

- `web/lib/dmcBridge.js` — token verification (HMAC, shared secret),
  `syncDmcInventory()`, `pushDmcItinerary()`.
- `web/app/api/sso/consume/route.js` — the login handoff endpoint.
- `web/lib/catalog.js` — the `isDmcBridge` guard blocking new
  destinations/hotels/vehicles (all three share this one function).
- `web/app/api/trips/route.js` / `web/app/api/trips/[id]/route.js` — push a
  trip's title/client/status back to ViaKashmir on create/update.

The ViaKashmir side lives at `src/lib/dmcBridge.ts`, `src/app/api/dmc-bridge/*`
and `src/app/api/dmc/*` in the ViaKashmir-website-main repo.

## Flow

1. A DMC partner applies via viakashmir.in's `/kashmir-dmc` form (a Lead,
   `source: 'dmc_partner'`).
2. ViaKashmir admin approves it (`/admin/dmc-partners`) → creates a
   `role: 'dmc'` account there. This alone does **not** grant builder access.
3. ViaKashmir admin separately grants "Itinerary Builder Access"
   (`dmcItineraryAccess: true`) — the actual gate.
4. The partner, logged into viakashmir.in, clicks "Launch Itinerary Builder"
   on their `/dmc/dashboard`. This calls `POST /api/dmc/sso-token`, which
   checks both gates above and returns a signed, 2-minute token.
5. The browser is redirected to `{VIA_KASHMIR_...}/api/sso/consume?token=...`
   on **this** app. That endpoint verifies the token, finds or creates the
   agency account here (`isDmcBridge: true`, `bypassSubscription: true`),
   syncs their destinations/hotels/vehicles from ViaKashmir's real inventory
   (DMC prices only), signs a normal session token, and redirects to
   `/sso-login?token=...` — the existing frontend just stores it like any
   other login.
6. Every trip the partner saves gets pushed back to ViaKashmir
   (`POST /api/dmc-bridge/itineraries`) so it shows on their profile in
   `/admin/dmc-partners`, with the client's name.

## Config (both sides need the SAME value)

```
DMC_BRIDGE_SECRET=<shared secret, set in Vercel Dashboard + ViaKashmir's env>
VIA_KASHMIR_API_URL=https://viakashmir.in   # this app calling ViaKashmir's bridge
```

ViaKashmir's side additionally needs `DMC_ITINERARY_BUILDER_URL` pointing
back here (`https://crm.viakashmir.in`).

## Known gap (was; now partially closed)

This app now has its own priced, ticketed Activity catalog
(`web/prisma/schema.prisma`'s `Activity`/`TripActivity` models,
`/api/activities`, an "Activities" section in the Trip Builder's Logistics
tab). `syncDmcInventory()` in `web/lib/dmcBridge.js` now calls
`fetchCatalog("activities")` and upserts into it the same way hotels/cabs
are upserted (by `(userId, name)`, DMC price only).

**Not verified**: this session couldn't reach the ViaKashmir-side repo to
confirm `/api/dmc-bridge/activities`'s actual response field names, so the
sync assumes the same shape as `hotels`/`cabs` (`title`, `dmcPrice`) plus
`destinationName` (matched against the destination rows synced just above
it in the same function), `description`, `durationHours`. If activities
sync as empty on a real SSO login, check these field names first against
whatever `src/app/api/dmc-bridge/activities/route.ts` (or equivalent)
actually returns on the ViaKashmir side.
