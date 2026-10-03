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

`web/` is the only thing deployed. Its build script (`npm run build`) first builds the Vite SPA into `web/public/` (git-ignored, regenerated every build), then builds the Next app. `next.config.mjs` rewrites every non-`/api`, non-`/assets` path to `/index.html` so React Router handles client-side routing while `/api/*` hits Next's route handlers. The SPA calls same-origin `/api` (`VITE_API_URL=/api` in `frontend/.env.*`) — no CORS, one origin.

**Function region is pinned to `hnd1` (Tokyo) in `web/vercel.json` because the Supabase database is in `ap-northeast-1` (Tokyo).** Every API request makes several sequential DB round trips; Vercel's default region (US East) put ~150 ms of trans-Pacific latency on each one. If the database ever moves, move `regions` with it.

`/assets/*` (Vite's content-hashed output) is served `immutable`, and a missing chunk 404s rather than falling through to `index.html`. Lazy routes use `frontend/src/utils/lazyWithReload.js`, which reloads the page once when a chunk from a previous deploy is gone — keep using it instead of plain `React.lazy` for route-level splits.

### Request flow: Prisma (camelCase) → serialize.js (snake_case) → frontend

The frontend was originally written against a Laravel API and still expects Laravel-shaped snake_case JSON. Prisma models use camelCase. Every API route converts one to the other via `web/lib/serialize.js` — e.g. `serializeTrip`, `catalogHotel`, `settingsToCamel`. When adding a Prisma field that the frontend needs, it must also be added to the relevant `serialize*`/`catalog*` function or it silently never reaches the client. `web/lib/catalog.js`'s `mapHotel`/`mapVehicle`/etc. do the reverse conversion (request body → Prisma `data`) for writes.

Two shapes of the same model often coexist and must be kept in sync independently: e.g. `serializeHotel` (lite, used by `/api/builder/init` for the Trip Builder's hotel picker) vs. `catalogHotel` (full, used by the Accommodation catalog CRUD pages) in `web/lib/serialize.js`. A field added to one does not automatically appear in the other.

### Multi-tenancy: `adminIdOf`

`web/lib/scope.js`'s `adminIdOf(user)` is the tenant-scoping primitive mirrored from the original Laravel `BelongsToAdmin` trait: an admin/super_admin's tenant is their own `id`; a `team`-role user's tenant is the `id` of the admin who owns their team. Every query that touches tenant-owned data (`Trip`, `Hotel`, `Vehicle`, `Destination`, `AgencySetting`, `Policy`, etc.) must filter `where: { userId: await adminIdOf(user) }` (or scope through a relation that does). Skipping this is a cross-tenant data leak, not just a bug — check it explicitly when reviewing or writing any new route.

Auth itself (`web/lib/auth.js`): JWT in an httpOnly cookie (`vi_token`) or `Authorization: Bearer`, verified by `userFromRequest(request)`. Passwords use bcrypt and `verifyPassword` accepts the `$2y$` hash format Laravel produces, so accounts migrated from the old system log in unchanged (and are rehashed down to cost 10 on their next login).

`/api/login` checks the local bcrypt hash first (no network). Only if that fails does it ask Supabase Auth (`web/lib/supabaseAuth.js`), for the account's linked `supabaseId` only — and a Supabase match rewrites the local hash, so that account's next login is local again. That fallback exists because until 2026-09-19 the deploy-time seed reset the super admin's local hash to `password` on every build while Supabase kept the real one. Every path that sets a password must call `hashPassword` **and**, if the user has a `supabaseId`, `supabaseSetPassword` — a path that skips Supabase leaves the old password working through the fallback.

Platform super admins are listed in `web/lib/superAdmins.mjs` and promoted at login (promote-only, never created). The deploy-time seed applies the same list, but it's silently skipped whenever the build's `prisma db push` fails, so don't rely on the seed alone for anything that must happen.

On the frontend, `apiClient` only raises the global "session expired" event for 401s on requests that carried a token, and `AuthContext` ignores 401s/responses for a token that's already been replaced — both were causes of fresh logins getting wiped and bounced to `/`. Signed-out users hitting a protected page go to `/login` (with `state.from`, and back there after signing in), never the marketing homepage.

### Generic catalog CRUD factory

`web/lib/catalog.js`'s `catalogCollection({ model, mapBody, serialize, searchField, limitKind })` generates the paginated list + create handlers shared by `/api/destinations`, `/api/hotels`, `/api/vehicles` — these routes are thin wrappers around it (see `web/app/api/hotels/route.js`), not independent implementations. Follow this pattern for a new catalog-style resource rather than hand-rolling GET/POST.

### Trip Builder nested save

`web/lib/trips.js` builds/syncs a `Trip` and all its nested children (itineraries, accommodations, transportations) in one request via `buildTripScalars`/`syncTripRelations`, and `TRIP_INCLUDE` is the canonical Prisma `include` shape for a fully-loaded trip — reused everywhere a trip is fetched. On the frontend, `frontend/src/components/dashboard/TripBuilder.jsx` + `trip-builder/useTripBuilderData.js` own this same nested state; hotel/vehicle/destination picking pulls from `masterHotels` etc., which come from `/api/builder/init`'s lite `serializeHotel`/`serializeVehicle`/`serializeDestination` shapes — see the "two shapes" note above before assuming a catalog field is available there.

### Trip Builder total price and Activities

`tripInfo.cost` (what the templates print and what gets saved/exported) only follows `calculatedTotalCost` once `pricingTouched` is true, so every price-affecting edit (adding/removing a hotel, cab or activity, GST toggle, other costs) must call `setPricingTouched(true)` — see `touchesPricing` in `TripBuilder.jsx`. Activities are optional: none added means no section, no page and no cost; once added they're included in the total and get their own table page after Transportation (`frontend/src/utils/activityRows.js` paginates 9 rows/page for Modern + Classic templates; `web/lib/pdf.js` mirrors it for the server PDF). `ticketCount` = number of persons, `pricePerTicket` = per-person price; prices are deliberately not printed in the PDF tables (the total already carries the margin).

### Ching (voice trip builder)

No external AI and no API keys: speech-to-text is the browser's Web Speech API (`en-IN`; Firefox has none, so typing is always offered) and understanding is our own rule-based parser.
- `frontend/src/utils/ching/parseCommand.js` — `parseChingCommand(text, catalog)` → a command (client, guests, start date, nights, hotel stays fuzzy-matched to the agency's own catalog, cab, meal plan) and `validateChingCommand(cmd, catalog)`. Pure JS; tests: `node frontend/scripts/ching-parser.test.mjs`.
- `frontend/src/utils/ching/buildTrip.js` — `buildChingTripParts(command, catalog)`: a command → the Trip Builder's own state (hotels back to back from the start date, day-wise plan, cab bookings). Nothing is saved; the builder prices it. Hotel rate lookup is shared with the hotel picker through `frontend/src/utils/hotelRates.js`.
- Real time: `frontend/src/utils/ching/liveFill.js` `planLive(base, textSoFar)` — a blank trip is FILLED from the request (then extras like activities/margin), a trip with content is EDITED. The builder's `editor.live.begin/update/finish/cancel` recompute from the base captured when the agent started speaking, so revised speech never stacks; `finish` pushes one undo entry and returns commands (export/email/save/send) to run. Off the builder, a trip request opens a new `/trip-builder?d=…` draft while the mic keeps listening. Autosave pauses while a live session is running. Tests: `node frontend/scripts/ching-live.test.mjs`.
- `frontend/src/components/ching/` — floating mic + panel (mounted in `App.jsx` on portal routes only), tap-to-talk, Alt+C, and the opt-in "Hello Ching" hands-free mode (`hasWakePhrase` requires the greeting word).
- Voice editing: while a trip is open, `TripBuilder.jsx` registers an editor through `frontend/src/utils/ching/editorBridge.js`. Ching turns speech into actions with `parseEdit.js` (`parseChingEdit`, `isCreateRequest`), applies them with `editTrip.js` (`buildEditContext`, `applyEditActions` — a pure timeline engine: changing a stay's nights inserts/deletes days and shifts later hotels, cabs and activities) and commits through the builder's normal setters (undoable). The action list is in `ching-edit` terms: SET_STAY_NIGHTS, REPLACE_HOTEL, ADD_ACTIVITY, SET_DAY_LEISURE, SET_VEHICLE, SET_MARGIN, SET_START_DATE, … plus EXPORT_PDF / EMAIL_ME / SAVE / UNDO commands. Tests: `node frontend/scripts/ching-edit-parser.test.mjs`, `node frontend/scripts/ching-edit.test.mjs`, `node frontend/scripts/ching-smart-fill.test.mjs`.
- Smart fill (`buildTrip.js`): a stay that names only a city gets a hotel picked there (`pickHotel`: spoken star rating, budget/luxury, else mid-priced); with no stays at all the route is planned (`planRoute`: cities said in order, else the destination's own hotels, else the region's hotel cities by `Destination.state`, nights split by `citiesFor`); no cab named → the smallest available cab that seats the group (`pickVehicle`, needs `seating_capacity` in `serializeVehicle`), unless "no cab". Client names are also caught without a lead-in word (leftover-word fallback in `parseCommand.js`).
- Assistant (`frontend/src/utils/ching/assistant.js` `understandAssistant`): navigation ("open the ledger" → `PAGES` table), builder tabs, "open Rahul's trip", "what's pending", "what's the total", small talk/jokes, voice on/off — checked BEFORE trip parsing in `ChingWidget.finish`, and must return null for anything trip-like (tests: `node frontend/scripts/ching-assistant.test.mjs`). Ching speaks replies through the browser's speech synthesis (`utils/ching/voice.js`, mutable; hands-free listening pauses while it speaks).
- Fill details: catalog city names are matched loosely (`utils/ching/places.js`: "Pahalgam, Kashmir" = "pahalgam", "Srinagar City" = "Srinagar"); every day gets its catalog destination (the Itinerary tab's picker); cabs are ALWAYS one row per day (`utils/ching/cabPlan.js` — a per-trip-rate cab is priced on day 1 only, the other days carry no vehicleId and the note "Included in the full-trip cab rate"); spoken phones are stored as "+91…" (`formatPhone` — the builder's phone field resets a bare number to "+91"); a blank trip's inclusions/exclusions start from the agency's standard lists (Policies) or lines derived from the trip (`utils/ching/inclusions.js`), and "add X to inclusions" / "flights are not included" / "standard exclusions" edit them; "under 6000" caps hotel price.
- Day-by-day routes (`utils/ching/dayPlan.js`): "day 1 arrival in Srinagar, day 2 Srinagar to Gulmarg, … day 6 departure" (also "2nd day", "day trip to Sonamarg", "leisure day") → one entry per day, gaps filled with sightseeing in the last city, then a plan: each day's title, destination (the Itinerary picker), cab route/type, and where they sleep — consecutive nights in one city become one hotel stay. The fill uses it when ≥2 days are spoken (`parseChingCommand` → `command.dayPlan`); on an existing trip one spoken day is a `SET_DAY_ROUTES` edit (keeps untouched days, reuses the trip's hotels where the city still matches, picks hotels for new cities, re-routes the changed days' cabs). Clauses with edit verbs ("make day 3 a leisure day", "add shikara on day 2", "move … to day 4") are left to the other edit handlers. A trip counts as "blank" (filled, not edited) until it has hotels, cabs or activities — client details or hand-made days alone don't block a fill, and the trip's own start date is used as day 1 when none is said. After a fill/edit Ching switches to the tab where the change landed.
- Memory (`web/lib/chingMemory.js`, `GET/POST/DELETE /api/ching/memory`, `ChingMemory` model, client cache `utils/ching/memoryStore.js`): LEARNED habits are computed from the agency's own saved trips on every read (usual hotel per city, cab per group size, meal plan, night split per destination, returning clients' phone/email) — so Ching keeps learning as trips are saved; TOLD things are stored rows ("call me Arif", "when I say Heaven I mean Heevan Resort" aliases applied before parsing, "my usual hotel in Gulmarg is …", notes; "what do you remember", "forget about …"). Told preferences beat learned ones; an explicit spoken choice (stars, budget, hotel name) beats both.
- Whole-site actions (`components/ching/assistActions.js`): documents for any trip by name/id ("email the invoice to Rahul", "download Rahul's vouchers", receipt, confirmation — which also marks the trip confirmed, itinerary PDF, Excel), supplier requests, "the driver for Rahul's trip is …", ops questions ("today's arrivals", "pending confirmations", "who hasn't paid"), trip search ("find unpaid trips to Gulmarg in October" → `/my-trips?q&status&payment&from&to`, filters supported by `GET /api/trips`), "Rahul paid 20000 by UPI" (an accounting receipt on the trip's receivable), "mark Rahul's trip as confirmed", "send a payment reminder to Rahul". Anything that records money or cancels a trip is asked back first ("…? Say yes or no." + buttons) — keep that for any new money-moving or destructive voice action.
- Phase 4 (`utils/ching/optimize.js`): "make it cheaper" / "optimise this trip" → `cheaperPlan` (a cheaper hotel in the same city — same stars first, one star down at most, ≥ ₹300/room/night cheaper — and a cheaper cab that still seats the group), said with the client-side saving (margin + GST) and applied only after "yes", as ordinary REPLACE_HOTEL / SET_VEHICLE actions (so "undo" works); nothing cheaper → an honest answer plus the optional activity / margin levers. "Suggest add-ons" → `addOnSuggestions` (catalog activities for the trip's cities not on the trip); a fill's spoken reply ends with one add-on tip.
- Pending checklist (`frontend/src/utils/tripChecklist.js`): what's still missing (client, dates, day plan, a hotel for every night, room rates, meal plans, cab, price) — live in the Trip Builder header ("N pending"), as tab dots, in Ching's panel, and read out by Ching.
- "Email it to me" exports the live-preview PDF and posts it to `POST /api/trips/:id/email-itinerary`, which emails the signed-in user through the agency's SMTP settings (server-rendered PDF if the upload would exceed Vercel's body limit).

### Client proposal link & approval (`/p/:token`)

A trip's proposal link is public (no login): the client sees the itinerary, approves it or asks for changes. Anyone holding the link can open it, so `web/lib/proposal.js` builds the response from an ALLOWLIST (`publicTrip`, `publicSettings`, `publicPolicies`) — never pass `serializeTrip` output to a public route (it carries room rates, markups, margin, vehicle prices, payments). New fields the templates need must be added to `publicTrip` deliberately.
- Agent side: `GET/POST /api/trips/:id/proposal` (create/regenerate the token, mark sent, `{ send: "email" }` emails the client the link + PDF). Trip Builder "Send" menu (WhatsApp link / email / copy / preview as client) and a status chip; Ching `SEND_PROPOSAL` commands.
- Client side: `GET /api/public/proposals/:token` (counts views unless `?preview=1`; first view notifies the agency) and `POST …/respond` (rate-limited; notifies in-app + emails the agency). Page: `frontend/src/pages/Proposal.jsx`, rendering the same templates via `frontend/src/utils/tripView.js` (`mapSavedTrip` etc. — also what the Trip Builder loads trips through).
- A client approval does NOT change `trip.status`; the agent still confirms the booking.

### Client payments, follow-ups, pipeline (Phase 2)

- Payment schedule: `web/lib/paymentSchedule.js` (`paymentSchedule(trip, settings)` — advance = `trip.advanceAmount` or the agency's `advancePercentage` of cost; balance due `balanceDueDays` before travel). The proposal page, the payment routes and the follow-up cron all use it, so they agree on what's owed — never compute amounts elsewhere or trust a client-sent amount.
- Clients pay on `/p/:token` through the AGENCY's own Razorpay keys (`AgencySetting.razorpayKeyId/razorpayKeySecret`; the secret is write-only — the settings API returns only `hasRazorpaySecret`). Without keys: UPI / bank transfer + an "I've paid" claim (`ClientPayment` status `claimed`) the agency verifies on the trip's Pricing tab. `web/lib/razorpay.js` takes optional `{ keyId, keySecret }`; without them it uses the platform's env keys (subscriptions only).
- Every received payment goes through `recordClientPayment` (`web/lib/clientPayments.js`) → accounting `recordSettlement` on the trip's client receivable (that's what moves `trip.paidAmount`, the Ledger and invoices — never write `paidAmount` directly), then auto-confirms (`autoConfirmOnPayment`) and notifies. It's idempotent; `reconcilePendingOrders` records Razorpay payments whose checkout tab closed before `/pay/verify`.
- Follow-ups: `web/lib/followups.js` (pure decision rules + emails), daily cron `GET /api/cron/sales-followups` (in `web/vercel.json`; CRON_SECRET like the B2B sync; links use `APP_URL` or Vercel's production URL), on-demand `POST /api/trips/:id/remind`, dashboard `GET /api/sales/pipeline` → `SalesPipeline.jsx`. Excel quotation: `GET /api/trips/:id/quotation-xlsx` (`web/lib/quotationExcel.js`, client-facing — no costs).
- `PUT /api/trips/:id` is a PARTIAL update (`buildTripScalars(body, { partial: true })` writes only columns whose keys are in the body), and the Trip Builder doesn't send `status` on updates — status belongs to My Trips and payments. Before this, My Trips' `{ status }` change blanked the trip's other fields.

### Operations (Phase 3): supplier confirmations, drivers, vouchers, daily board

- `web/lib/operations.js`. Each hotel stay and each cab is requested from its supplier (catalog `Hotel.email/phone`, `Vehicle.email/phone`) with a no-login link `/s/:supplierToken` (`frontend/src/pages/SupplierConfirm.jsx`, `GET/POST /api/public/supplier/:token`). Cabs are one row per day, so ONE request covers all of a vehicle's days: the token lives on the earliest row and a response applies to every row with the same vehicle (`cabGroups`/`cabGroupKey`). The public view is an allowlist (`publicBooking`) — no prices, no client phone/email.
- Status per row: `supplierStatus` requested | confirmed | declined | changed. `syncTripRelations` sets "changed" when a requested/confirmed booking's dates/hotel/rooms/meal/route are edited — the agent re-requests it. Driver fields live on Transportation (`driverName/driverPhone/vehicleNumber`).
- Agent APIs: `GET/POST /api/trips/:id/supplier-requests` (email via agency SMTP + WhatsApp links), `PATCH /api/trips/:id/bookings` (mark status/ref, set driver), `GET /api/trips/:id/vouchers-pdf` (hotel + transport vouchers, no prices; also `send-confirmation` recipient "vouchers"), `GET /api/operations?from&days` (daily board). The old "send to hotels / cabs" buttons now go through the same request flow.
- Automation (daily cron `GET /api/cron/operations`, 08:15 IST, rules in `web/lib/tripMessages.js`, toggles under Settings → Trip Automation): unanswered supplier requests re-sent after 24 h (max 2, counted in `supplierReminderCount`), pre-arrival email with the vouchers 2 days before a CONFIRMED trip, tomorrow's driver details to the client, feedback/review request 1–7 days after the trip, and an "Operations:" digest notification. Driver brief on WhatsApp (`driverBrief`): guest, phone, day-wise route with the night's hotel, emergency contact — "Brief driver" in Daily Ops and the Bookings panel. Vouchers PDF also has an activity page.
- UI: `/operations` (Daily Ops in the nav), the trip's Logistics tab "Bookings & vouchers" panel (`trip-builder/TripBookings.jsx`). Tests: `node web/scripts/operations.test.mjs` (fake Prisma via `web/scripts/alias-loader.mjs`).

### Images

`web/lib/storage.js`'s `persistImage(value, prefix)` is the standard path for any image field: if given a `data:` URL it uploads to Supabase Storage and returns the public URL; if Storage isn't configured (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset) it falls back to storing the value inline; it never throws. Call this on any new image-bearing field before writing to Prisma.

### Environment / credentials convention

**Secrets never go in the repo (owner's rule, 2026-10-03).** This repository is public. `web/.env` used to commit real credentials (database URLs, JWT secret, bridge key, service-role key, SMTP login); they were readable by anyone and were rotated. Now `web/.env` holds non-secret defaults only, and every secret is set in Vercel → Project Settings → Environment Variables (Production and Preview). For local development put secrets in `web/.env.local` (gitignored). Never commit a key, password, token or connection string, and never paste one into a commit message or code comment. `frontend/.env.*` only carries `VITE_*` values, which ship in the browser bundle by design (the Google Maps key must stay HTTP-referrer restricted).

**Via Kashmir catalog bridge.** `lib/viaKashmirCatalog.js` syncs viakashmir.in's catalog into connected accounts: DMC partners (`isDmcBridge`) get DMC prices from `/api/dmc-bridge/*` (`DMC_BRIDGE_SECRET`); the one internal account (`isVkInternal`, set by the super-admin toggle or viakashmir.in admin) gets B2B net prices from `/api/vk-bridge/*` (`VK_INTERNAL_BRIDGE_SECRET`, must differ from the DMC key). The feed is chosen from the account's own flags, never from a request. Partner agencies are blocked from the B2B portal import (`/api/hotels/import-b2b`) and its cron.

Google Maps/Places is opt-in per agency (not a shared platform key): agencies paste their own key under Settings → Integrations (`AgencySetting.googleMapsApiKey`), fetched via `frontend/src/hooks/useAgencyMapsKey.js`. No key configured → Hotel Name autocomplete and the location map simply don't attempt to load; there is no hard dependency on Maps anywhere in the Accommodation form. If Places Autocomplete stops working, check whether it's the modern `AutocompleteSuggestion` API (current) vs. the legacy `google.maps.places.Autocomplete` widget (deprecated by Google for any Cloud project created after March 2025, and the cause of one prior outage in this app).
