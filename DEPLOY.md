# Deploying ViaItinerary (one app, Supabase database)

This is **one application**: a Laravel app (`backend/`) that serves both the API
and the React frontend (`frontend/`). It runs as a **single container** and uses
**Supabase (PostgreSQL)** as the database.

> Vercel can't host this (it's PHP, not Next.js). Deploy the Docker image to any
> container host — Render, Railway, Fly.io, a VPS, etc.

## 1. Create the database (Supabase)

1. Create a project at <https://supabase.com>.
2. **Project Settings → Database** → copy the connection info (host, port,
   database `postgres`, user `postgres`, your password).

## 2. Generate an app key (once)

```bash
cd backend && php artisan key:generate --show
# copy the "base64:..." value for APP_KEY below
```

## 3. Deploy the container

Point your host at this repo (it builds from the root `Dockerfile`) and set these
environment variables:

| Key | Value |
| --- | --- |
| `APP_KEY` | the `base64:…` value from step 2 |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | your public URL (e.g. `https://app.example.com`) |
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | `db.<project-ref>.supabase.co` |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | `postgres` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | your Supabase database password |
| `DB_SSLMODE` | `require` |
| `RAZORPAY_KEY` / `RAZORPAY_SECRET` | optional, for payments |

The container runs `php artisan migrate --force` on boot, so the Supabase tables
are created automatically on first deploy.

### Run locally with Docker

```bash
docker build -t viaitinerary .
docker run -p 8000:8000 --env-file backend/.env viaitinerary
# open http://localhost:8000
```

## 4. Seed defaults + superadmin (once)

After the first successful deploy, run the seeders once (from your machine with
the same env, or a one-off task on the host):

```bash
cd backend
php artisan db:seed --force
```

This creates the default plans and the superadmin account
(`viakashmir.in@gmail.com`). Change the password after first login.

## Notes

- **One origin, no CORS**: the frontend is built with `VITE_API_URL=/api`, so it
  calls the same host that serves it.
- The original MySQL-only `FIELD()` ordering was replaced with portable `CASE`
  so everything runs on PostgreSQL; all other models/migrations are unchanged
  from the original system.
- Queue/session/cache use the `database` driver (Postgres) by default — no extra
  services needed.
