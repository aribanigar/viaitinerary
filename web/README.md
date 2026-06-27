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
- [ ] Phase 4 — subscriptions + Razorpay
- [ ] Phase 5 — leads, blog, accounting, super-admin
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
