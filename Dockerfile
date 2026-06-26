# Single-container build: the Laravel app (backend/) serves both the API and the
# React frontend (frontend/), so the whole system runs as ONE app on ONE host.
#
# Database: Supabase (PostgreSQL), configured via environment variables.

# ---- Stage 1: build the React (Vite) frontend ----
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API: the Laravel app serves the UI and /api together, so the
# frontend talks to a relative path and there is no CORS / second host.
ENV VITE_API_URL=/api
ENV VITE_APP_URL=/
RUN npm run build

# ---- Stage 2: PHP / Laravel ----
FROM php:8.2-cli-bookworm AS app

# System libs + PHP extensions the app needs (Postgres, image/zip/i18n, etc.).
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libpng-dev libonig-dev libicu-dev libxml2-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j"$(nproc)" pdo pdo_pgsql pgsql mbstring zip gd bcmath intl exif \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

# Install PHP deps first (better layer caching).
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# App code.
COPY backend/ ./

# Drop the built SPA into Laravel's public dir (ReactController serves it; the
# Vite assets are served as static files from the same origin).
COPY --from=frontend /app/frontend/dist/ ./public/

RUN composer dump-autoload --optimize \
    && chmod -R 775 storage bootstrap/cache

ENV PORT=8000
EXPOSE 8000

# On boot: run migrations against Supabase, then serve. APP_KEY and DB_* must be
# provided as environment variables by the host (see DEPLOY.md).
CMD ["sh", "-c", "php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8000}"]
