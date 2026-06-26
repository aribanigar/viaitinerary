# MongoDB Atlas migration

This backend was originally Laravel + MySQL. It is being migrated to **MongoDB
Atlas** using the official [`mongodb/laravel-mongodb`](https://www.mongodb.com/docs/drivers/php/laravel-mongodb/)
package. This document tracks what is done and what still needs attention.

## ✅ Done (data layer)

- **Dependency**: added `mongodb/laravel-mongodb` (`^5.4`) and `ext-mongodb` to
  `composer.json`.
- **Connection**: `config/database.php` has a `mongodb` connection (DSN from
  `MONGODB_URI`, db from `MONGODB_DATABASE`); default connection is now `mongodb`.
- **Env** (`.env.example`): `DB_CONNECTION=mongodb`, `MONGODB_URI`,
  `MONGODB_DATABASE`; session/cache set to `file`, queue to `sync` (MongoDB has no
  relational session/cache/queue tables).
- **Models**: all 29 models now extend `MongoDB\Laravel\Eloquent\Model` (and
  `User` extends `MongoDB\Laravel\Auth\User`; soft-deletes use the package trait).
- **Sanctum**: tokens are stored in MongoDB via `App\Models\PersonalAccessToken`
  (registered in `AppServiceProvider`).
- **Indexes**: the 125 relational migrations are archived under
  `database/migrations_sql_archive/`; a single `…_create_mongodb_indexes.php`
  migration creates the unique/lookup indexes that actually matter on MongoDB.

## ▶️ How to run it (needs an environment with the Mongo extension)

This could not be executed in the build sandbox (no `ext-mongodb`, and outbound
MongoDB port 27017 is firewalled). On your machine / server:

```bash
cd backend
# 1. Install the MongoDB PHP extension (once):
#    pecl install mongodb   # then enable extension=mongodb in php.ini
php -m | grep mongodb        # verify it's loaded

# 2. Install PHP deps (composer plugins enabled):
composer update mongodb/laravel-mongodb

# 3. Configure env:
cp .env.example .env
#    set MONGODB_URI to your Atlas string, MONGODB_DATABASE, then:
php artisan key:generate

# 4. Create indexes:
php artisan migrate          # runs the MongoDB index migration

# 5. Seed (optional) and serve:
php artisan db:seed
php artisan serve
```

Allowlist your server IP (or `0.0.0.0/0`) in Atlas → Network Access.

## ✅ Raw-SQL rewrites (done)

MongoDB has no SQL, so every raw-SQL / join construct was rewritten to the
Eloquent/PHP equivalent. Relationships, `where`, `orderBy`, `whereHas`/
`withCount` and `DB::transaction` (Atlas is a replica set) all carry over.

- `AccountingLedgerService::isReady()` — drop the relational table check
  (collections are implicit on MongoDB).
- `MetaSheetLeadImporter::hasPaxColumn()` — schemaless, returns false (legacy
  column was dropped).
- `Admin/PlanController::index()` — `orderByRaw(CASE…)` → PHP sort.
- `SubscriptionController` — `Schema::hasColumn` removed; country-preference
  `orderByRaw` → PHP sort.
- `RazorpayController` — country-preference `orderByRaw` → PHP sort.
- `SuperAdminController` — `selectRaw('count(*)')->groupBy` → collection group.
- `AccountingLedgerController` — `SUM(CASE…)` group + `FIELD()` ordering →
  PHP aggregation / sort.
- `TripController::index()` — three `leftJoin`s + `selectRaw(CASE…)` → plain
  query + `created_by` resolved in PHP (search `like` → regex via the package).
- `CheckAccountStatus` (middleware) — `DB::table()->join()` → Eloquent lookup.
- `ProcessTripFollowUps` (command) — `DB::table()->leftJoin()` + `COALESCE`
  `DB::raw` → Eloquent + PHP resolution.

`php -l` passes on all of the above; a repo-wide grep finds no remaining
`DB::raw`/`whereRaw`/`orderByRaw`/`selectRaw`/join/`Schema::has*` in `app/`.

Other notes:
- Primary keys are now Mongo `_id` (string ObjectId). The package exposes
  `$model->id` for convenience and foreign keys (`user_id`, `trip_id`, …) store
  the referenced `_id` — relationships keep working for new data.
- There is **no automatic data import** from the old MySQL DB; this migrates the
  schema/app layer. If you have existing MySQL data, it must be exported and
  transformed into MongoDB collections separately.
- `maatwebsite/excel` import/export and DomPDF are unaffected (no DB coupling).

## Verification done here

- `php -l` passes on every changed model, the provider, the config and the index
  migration.
- `composer.json` is valid JSON.
- Runtime (migrate / boot / requests) must be verified in an environment with the
  Mongo extension + Atlas access.
