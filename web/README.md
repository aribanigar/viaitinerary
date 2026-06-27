# ViaItinerary — Next.js port (`web/`)

A from-Laravel rewrite of the backend into **Next.js (App Router)** on
**Supabase (PostgreSQL)** via **Prisma**, so the whole system (UI + API) runs as
**one app on Vercel**. The existing React frontend is migrated in during a later
phase; the API is built first to match the current REST contract.

## Status (phased port)

- [x] **Phase 1 — scaffold + DB + auth**: Prisma schema (User, Team), Prisma
      client, JWT/bcrypt auth (verifies existing `$2y$` Laravel hashes),
      endpoints `POST /api/login`, `GET /api/user`, `POST /api/logout`,
      `POST /api/signup`, and a seed for the super admin.
- [x] **Phase 2 — trips + builder API**: Prisma models (Trip, Itinerary,
      Accommodation, Transportation, Destination, Hotel, Vehicle, AgencySetting,
      Policy); `GET /api/builder/init`, full `GET/POST /api/trips`,
      `GET/PUT/DELETE /api/trips/:tripId`, `POST /api/trips/:tripId/duplicate` —
      with nested itineraries/logistics and the same snake_case response shape
      the frontend expects.
- [x] **Phase 3 — catalogs + settings + policies**: full CRUD for
      `/api/destinations`, `/api/hotels`, `/api/vehicles` (paginated, scoped);
      `/api/settings` (GET/PUT, all fields) + `/api/settings/verify-ifsc`
      (live IFSC lookup); `/api/policies` (GET/PUT with defaults);
      `/api/inclusion-exclusions` CRUD (grouped by type). SMTP-test and bulk
      Excel import/export are stubbed pending the email/Excel phase.
- [x] **Phase 4 — subscriptions + Razorpay**: Plan + Subscription models;
      subscription engine (trial init, upgrade, expiry, trip-limit gating,
      included seats); `GET /api/subscription/status`, `POST
      /api/subscription/upgrade`, `POST /api/subscription/assign-member`;
      `POST /api/razorpay/create-order`, `POST /api/razorpay/verify-payment`
      (HMAC verify → upgrade). Trip creation now enforces the plan; signup
      starts a trial; seed adds the default plans.
- [~] Phase 5 — leads, blog, accounting, super-admin
  - [x] **5a — leads / inquiries**: LeadInquiry model (→ `trip_inquiries`);
        `GET/POST /api/lead-inquiries`, public submit / `PATCH` / `DELETE`
        `/api/lead-inquiries/:id`, `/assignable-members`, `/convert-to-trip`,
        `POST /api/public-inquiries`.
  - [x] **5b — accounting ledger**: AccountingObligation + AccountingSettlement
        models; ledger service (derive receivable from trip cost + payables from
        accommodations/transportations, settlements feed back into trip
        paid/refunded totals); `GET /api/accounting/ledger`,
        `GET /api/accounting/ledger/:tripId`, `POST /api/accounting/settlements`,
        `PUT`/`DELETE /api/accounting/settlements/:id`.
  - [ ] 5c — super-admin, blog
- [ ] Phase 6 — migrate the React frontend in (one app)
- [ ] Phase 7 — PDF / Excel / email

## Run locally

```bash
cp .env.example .env.local      # set DATABASE_URL/DIRECT_URL (Supabase) + JWT_SECRET
npm install
npx prisma db push              # create tables in Supabase
npm run seed                    # super admin: viakashmir.in@gmail.com / password
npm run dev                     # http://localhost:3000
```

## Deploy on Vercel (one app)

Import the repo in Vercel and set **Root Directory = `web`**. Add env vars
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. Vercel runs `prisma generate &&
next build`. Run `npx prisma db push` (or `prisma migrate deploy`) once against
Supabase to create the tables.

> Note: Prisma's engine binary can't be downloaded inside the restricted build
> sandbox used to author this, so `next build` is verified on Vercel / your
> machine (full network), not here.
