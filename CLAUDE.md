# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System

`web/` (API) + `frontend/` (UI) is the entire product — a Next.js (App Router) + Prisma + Supabase (Postgres) backend serving a Vite/React SPA, deployed as one Vercel app. There used to be a second, original Laravel implementation (`backend/`, plus a root `Dockerfile`/`render.yaml` for a Docker/Render deploy); it was removed since it was unmaintained, had drifted out of sync with `frontend/`, and was never the deployed system. If you see any reference to a Laravel backend, Blade templates, `php artisan`, or Sanctum in old docs/notes/history, it's about that removed system, not this one.

## Commands

### `web/` (Next.js API + Prisma)

```bash
cd web
npm install                 # postinstall runs `prisma generate`
npm run dev                 # Next dev server on :3000
npm run build:next          # prisma generate + next build, no DB/frontend steps — fastest way to check the API compiles
npm run build                # full deploy build: builds ../frontend into public/, prisma generate, prisma db push + seed, next build
npm run lint                 # next lint
npm run db:push              # prisma db push (apply schema.prisma changes — no migrations folder, additive edits only)
npm run seed                  # node prisma/seed.mjs — super admin: viakashmir.in@gmail.com
```

There is no test suite (no jest/vitest configured) — verification is `build:next` (compiles + type-checks every route) plus manual/local exercising.

Schema changes: this project has **no `prisma/migrate` migrations folder**. Add fields directly to `web/prisma/schema.prisma` (nullable/defaulted so existing rows aren't broken) and they apply automatically via `prisma db push` in the Vercel build step. Don't introduce a migrations workflow without checking with the user first.

### `frontend/` (Vite + React SPA)

```bash
cd frontend
npm install
npm run dev                  # Vite dev server; proxies /api to the Next server on :3000
npm run build                 # outputs into ../web/public — this is what Next serves in production
npm run lint                  # eslint . — repo currently has ~120 pre-existing lint errors (mostly unused-var / react-hooks rules); not enforced in CI, don't treat pre-existing ones as regressions from your change
```

No test suite here either.

## Architecture

### One Vercel deploy, two apps glued together

`web/` is the only thing deployed. Its build script (`npm run build`) first builds the Vite SPA into `web/public/` (git-ignored, regenerated every build), then builds the Next app. `next.config.mjs` rewrites every non-`/api` path to `/index.html` so React Router handles client-side routing while `/api/*` hits Next's route handlers. The SPA calls same-origin `/api` (`VITE_API_URL=/api` in `frontend/.env.*`) — no CORS, one origin.

### Request flow: Prisma (camelCase) → serialize.js (snake_case) → frontend

The frontend was originally written against a Laravel API and still expects Laravel-shaped snake_case JSON. Prisma models use camelCase. Every API route converts one to the other via `web/lib/serialize.js` — e.g. `serializeTrip`, `catalogHotel`, `settingsToCamel`. When adding a Prisma field that the frontend needs, it must also be added to the relevant `serialize*`/`catalog*` function or it silently never reaches the client. `web/lib/catalog.js`'s `mapHotel`/`mapVehicle`/etc. do the reverse conversion (request body → Prisma `data`) for writes.

Two shapes of the same model often coexist and must be kept in sync independently: e.g. `serializeHotel` (lite, used by `/api/builder/init` for the Trip Builder's hotel picker) vs. `catalogHotel` (full, used by the Accommodation catalog CRUD pages) in `web/lib/serialize.js`. A field added to one does not automatically appear in the other.

### Multi-tenancy: `adminIdOf`

`web/lib/scope.js`'s `adminIdOf(user)` is the tenant-scoping primitive mirrored from the original Laravel `BelongsToAdmin` trait: an admin/super_admin's tenant is their own `id`; a `team`-role user's tenant is the `id` of the admin who owns their team. Every query that touches tenant-owned data (`Trip`, `Hotel`, `Vehicle`, `Destination`, `AgencySetting`, `Policy`, etc.) must filter `where: { userId: await adminIdOf(user) }` (or scope through a relation that does). Skipping this is a cross-tenant data leak, not just a bug — check it explicitly when reviewing or writing any new route.

Auth itself (`web/lib/auth.js`): JWT in an httpOnly cookie (`vi_token`) or `Authorization: Bearer`, verified by `userFromRequest(request)`. Passwords use bcrypt and `verifyPassword` accepts the `$2y$` hash format Laravel produces, so accounts migrated from the old system log in unchanged.

### Generic catalog CRUD factory

`web/lib/catalog.js`'s `catalogCollection({ model, mapBody, serialize, searchField, limitKind })` generates the paginated list + create handlers shared by `/api/destinations`, `/api/hotels`, `/api/vehicles` — these routes are thin wrappers around it (see `web/app/api/hotels/route.js`), not independent implementations. Follow this pattern for a new catalog-style resource rather than hand-rolling GET/POST.

### Trip Builder nested save

`web/lib/trips.js` builds/syncs a `Trip` and all its nested children (itineraries, accommodations, transportations) in one request via `buildTripScalars`/`syncTripRelations`, and `TRIP_INCLUDE` is the canonical Prisma `include` shape for a fully-loaded trip — reused everywhere a trip is fetched. On the frontend, `frontend/src/components/dashboard/TripBuilder.jsx` + `trip-builder/useTripBuilderData.js` own this same nested state; hotel/vehicle/destination picking pulls from `masterHotels` etc., which come from `/api/builder/init`'s lite `serializeHotel`/`serializeVehicle`/`serializeDestination` shapes — see the "two shapes" note above before assuming a catalog field is available there.

### Images

`web/lib/storage.js`'s `persistImage(value, prefix)` is the standard path for any image field: if given a `data:` URL it uploads to Supabase Storage and returns the public URL; if Storage isn't configured (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset) it falls back to storing the value inline; it never throws. Call this on any new image-bearing field before writing to Prisma.

### Environment / credentials convention

`web/.env` and `frontend/.env.{development,production}` commit real dev/Supabase credentials directly into the repo (not Vercel dashboard secrets) so the Vercel deploy is self-contained from a fresh clone — this is intentional project policy stated in `web/.env`'s own header comment, not an accident to "fix". The same header notes these should be rotated and moved to Vercel env vars before real production use.

Google Maps/Places is opt-in per agency (not a shared platform key): agencies paste their own key under Settings → Integrations (`AgencySetting.googleMapsApiKey`), fetched via `frontend/src/hooks/useAgencyMapsKey.js`. No key configured → Hotel Name autocomplete and the location map simply don't attempt to load; there is no hard dependency on Maps anywhere in the Accommodation form. If Places Autocomplete stops working, check whether it's the modern `AutocompleteSuggestion` API (current) vs. the legacy `google.maps.places.Autocomplete` widget (deprecated by Google for any Cloud project created after March 2025, and the cause of one prior outage in this app).
