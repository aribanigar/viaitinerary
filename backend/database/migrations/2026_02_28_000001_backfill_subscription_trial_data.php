<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Backfill migration — fixes historic subscription data inconsistencies.
 *
 * Before this fix:
 *   - AuthController::signup did NOT create a subscriptions row.
 *   - Subscriptions were lazily auto-created using stale users.* fields.
 *   - users.plan_name, users.trial_started_at etc. were never reliably populated.
 *
 * This migration:
 *   1. Creates trial subscription rows for every admin user that doesn't have one.
 *      Uses the user's created_at as the trial start (most accurate anchor available).
 *   2. Updates stale subscriptions whose trial_started_at is NULL.
 *   3. Does NOT touch team-member subscription data (teams table is authoritative
 *      for members and does not need backfilling here).
 *
 * This migration is idempotent and safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        // No-op: backfill no longer needed — migrate:fresh + signup now creates
        // subscriptions correctly via SubscriptionService::initializeTrial().
        return;
        $trialDays = config('plans.trial.duration_days', 3);

        // 1. Create missing subscription rows for admin users
        $adminUsers = DB::table('users')
            ->where('role', 'admin')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('subscriptions')
                    ->whereColumn('subscriptions.user_id', 'users.id');
            })
            ->get(['id', 'created_at']);

        foreach ($adminUsers as $user) {
            $trialStart = $user->created_at
                ? Carbon::parse($user->created_at)
                : Carbon::now();

            DB::table('subscriptions')->insert([
                'user_id'                => $user->id,
                'plan_name'              => 'trial',
                'trial_started_at'       => $trialStart,
                'trial_ends_at'          => $trialStart->copy()->addDays($trialDays),
                'subscription_started_at' => null,
                'subscription_ends_at'   => null,
                'seats'                  => 1,
                'status'                 => 'active',
                'total_trips_created'    => DB::table('trips')
                    ->where('user_id', $user->id)
                    ->count(),
                'created_at'             => Carbon::now(),
                'updated_at'             => Carbon::now(),
            ]);
        }

        // 2. Fix any existing subscription rows where trial_started_at is NULL
        //    (created by the old lazy-init path that sometimes failed to set it)
        $staleSubs = DB::table('subscriptions')
            ->where('plan_name', 'trial')
            ->whereNull('trial_started_at')
            ->get(['id', 'user_id', 'created_at']);

        foreach ($staleSubs as $sub) {
            // Best anchor: the subscription row's own created_at
            $anchor = $sub->created_at
                ? Carbon::parse($sub->created_at)
                : Carbon::now();

            DB::table('subscriptions')->where('id', $sub->id)->update([
                'trial_started_at' => $anchor,
                'trial_ends_at'    => $anchor->copy()->addDays($trialDays),
                'updated_at'       => Carbon::now(),
            ]);
        }
    }

    public function down(): void
    {
        // The down() deliberately does nothing because we cannot safely
        // determine which rows were inserted/updated by this migration
        // without a separate tracking table. Data rollback would be destructive.
    }
};
