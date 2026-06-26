<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\User;
use App\Jobs\ProcessSuccessfulSubscriptionJob;
use Carbon\Carbon;

/**
 * SubscriptionService — single source of truth for all subscription logic.
 *
 * Architecture: every user (admin OR team member) has exactly ONE row in the
 * subscriptions table keyed by user_id (UNIQUE).
 *
 *  - Admin on trial  → plan_key='trial',  status='trialing'
 *  - Admin paid      → plan_key='monthly'|'six_months'|'yearly', status='active'
 *  - New member      → plan_key=null,      status='pending'   (cannot login)
 *  - Subscribed member → plan_key=...,    status='active'    (can login)
 */
class SubscriptionService
{
    // -------------------------------------------------------------------------
    // Trial initialization (called once at signup)
    // -------------------------------------------------------------------------

    /**
     * Create a fresh trial subscription for a newly-registered admin.
     * Idempotent: returns existing row if one already exists.
     */
    public static function initializeTrial(User $user): Subscription
    {
        if ($user->subscription()->exists()) {
            return $user->subscription()->first();
        }

        $trialPlan = \App\Models\Plan::where('key', 'trial')->first();
        $durationDays = $trialPlan ? $trialPlan->duration_months : 3;

        return $user->subscription()->create([
            'plan_key'      => 'trial',
            'status'        => 'trialing',
            'starts_at'     => now(),
            'trial_ends_at' => now()->addDays($durationDays),
            'trip_limit'    => $trialPlan ? $trialPlan->trip_limit : 3,
            'trips_used'    => 0,
        ]);
    }

    // -------------------------------------------------------------------------
    // Subscription lookup
    // -------------------------------------------------------------------------

    /** Return the user's own subscription row (null if none). */
    public static function getSubscriptionForUser(User $user): ?Subscription
    {
        return $user->subscription()->first();
    }

    // -------------------------------------------------------------------------
    // Upgrade
    // -------------------------------------------------------------------------

    /**
     * Upgrade (or create) a subscription for $user to a paid plan.
     * Writes ONLY to the subscriptions table and sets users.status = active.
     *
     * This is the ONLY method that should be called for upgrades — for both
     * admins and team members. The caller is responsible for passing the
     * correct target User model.
     */
    public static function upgradeUserToPlan(User $user, string $planKey, ?string $paymentId = null): Subscription
    {
        $plan = \App\Models\Plan::where('key', $planKey)->first();
        $price = $plan ? $plan->price : 0;

        $data = [
            'plan_key'            => $planKey,
            'paid_amount'         => $price,
            'razorpay_payment_id' => $paymentId,
            'status'              => 'active',
            'starts_at'           => now(),
            'ends_at'             => $plan ? now()->addMonths($plan->duration_months) : now()->addMonths(1),
            'trial_ends_at'       => null,
            'trip_limit'          => $plan ? $plan->trip_limit : null,
        ];

        $subscription = self::getSubscriptionForUser($user);

        if ($subscription) {
            $subscription->update($data);
        } else {
            $subscription = $user->subscription()->create(
                array_merge($data, ['trips_used' => 0])
            );
        }

        // Allow the user to authenticate
        $user->update(['status' => 'active']);

        // Queue notification emails
        ProcessSuccessfulSubscriptionJob::dispatch($user->id, $subscription->id);

        return $subscription->fresh();
    }

    // -------------------------------------------------------------------------
    // Access checks
    // -------------------------------------------------------------------------

    /**
     * May this user log in?
     *
     * - Admins: always yes (account-level status is checked separately)
     * - Team members: only if they have an active, non-expired subscription
     *
     * Returns ['allowed' => bool, 'reason' => string|null].
     */
    public static function canLogin(User $user): array
    {
        if ($user->role === 'admin') {
            return ['allowed' => true, 'reason' => null];
        }

        // Check is_active on the team record first
        $team = $user->teamRecord;
        if (!$team || !$team->is_active) {
            return [
                'allowed' => false,
                'reason'  => 'your team account has been deactivated. Please contact your admin.',
            ];
        }

        // If the admin has bypass_subscription, team members can log in freely
        $admin = self::resolveAdmin($user);
        if ($admin && $admin->bypass_subscription) {
            return ['allowed' => true, 'reason' => null];
        }

        $subscription = self::getSubscriptionForUser($user);

        if (!$subscription || $subscription->isPending()) {
            return [
                'allowed' => false,
                'reason'  => 'your subscription is missing or pending. Please ask your admin to subscribe for your account.',
            ];
        }

        if ($subscription->isExpired()) {
            return [
                'allowed' => false,
                'reason'  => 'your subscription has expired. Please ask your admin to renew it.',
            ];
        }

        if (!$subscription->isActive()) {
            return [
                'allowed' => false,
                'reason'  => 'your subscription is not active. Please contact your admin.',
            ];
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * May this user (admin or team member) create a new trip?
     *
     * Trip limits are governed by the ADMIN's subscription (trips are per-workspace).
     * Returns ['allowed' => bool, 'reason' => string|null, 'http_status' => int].
     */
    public static function canCreateTrip(User $user): array
    {
        $admin = self::resolveAdmin($user);

        if (!$admin) {
            return ['allowed' => false, 'reason' => 'Cannot resolve admin.', 'http_status' => 403];
        }

        // Super admin bypass: skip all subscription checks
        if ($admin->bypass_subscription) {
            return ['allowed' => true, 'reason' => null, 'http_status' => 200];
        }

        $subscription = self::getSubscriptionForUser($admin);

        if (!$subscription || $subscription->isPending()) {
            return ['allowed' => false, 'reason' => 'Subscription record not found.', 'http_status' => 403];
        }

        if ($subscription->isTrial()) {
            if ($subscription->isExpired()) {
                return ['allowed' => false, 'reason' => 'Trial has expired. Please upgrade.', 'http_status' => 402];
            }

            if ($subscription->trips_used >= ($subscription->trip_limit ?? 3)) {
                return ['allowed' => false, 'reason' => 'Trial limit reached. Upgrade to create more trips.', 'http_status' => 402];
            }
        }

        if (!$subscription->isTrial() && $subscription->isExpired()) {
            return ['allowed' => false, 'reason' => 'Your subscription has expired. Please renew.', 'http_status' => 402];
        }

        return ['allowed' => true, 'reason' => null, 'http_status' => 200];
    }

    /**
     * May this admin add a new team member?
     * Trial admins are blocked — team members require a paid plan.
     *
     * Returns ['allowed' => bool, 'reason' => string|null].
     */
    public static function canAddTeamMember(User $admin): array
    {
        // Super admin bypass: skip all subscription checks
        if ($admin->bypass_subscription) {
            return ['allowed' => true, 'reason' => null];
        }

        $subscription = self::getSubscriptionForUser($admin);

        if (!$subscription || $subscription->isPending() || $subscription->isTrial()) {
            return [
                'allowed' => false,
                'reason'  => 'Team members can only be added on a paid plan. Please upgrade first.',
            ];
        }

        if ($subscription->isExpired()) {
            return [
                'allowed' => false,
                'reason'  => 'Your subscription has expired. Please renew to add team members.',
            ];
        }

        return ['allowed' => true, 'reason' => null];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /** Given any user, return the admin User. */
    public static function resolveAdmin(User $user): ?User
    {
        if ($user->role === 'admin') {
            return $user;
        }

        $adminId = $user->getAdminId();
        return $adminId ? User::find($adminId) : null;
    }

    /**
     * Assign an included seat from an admin's plan to a pending team member.
     *
     * - Validates ownership and available included seats.
     * - Activates the member's subscription to the same plan_key as the admin,
     *   sets paid_amount to 0 (included seat), aligns ends_at with admin's ends_at,
     *   and marks the user's status active so they can log in.
     *
     * Returns the updated Subscription on success.
     */
    public static function assignIncludedSeat(User $admin, User $member): ?Subscription
    {
        // Ownership check: member must belong to admin's team
        $team = $member->teamRecord;
        if (!$team || $team->created_by !== $admin->id) {
            throw new \Exception('Team member not found or access denied.');
        }

        $adminSub = self::getSubscriptionForUser($admin);
        if (!$adminSub || !$adminSub->isActive()) {
            throw new \Exception('Admin subscription not active.');
        }

        $planKey = $adminSub->plan_key;
        $plan = \App\Models\Plan::where('key', $planKey)->first();
        $limit = $plan ? intval($plan->team_member_limit ?? 0) : 0;

        // Count currently active members on the same plan for this admin
        $assignedCount = \App\Models\Team::where('created_by', $admin->id)
            ->with(['user.subscription'])
            ->get()
            ->filter(function ($team) use ($planKey) {
                $sub = $team->user?->subscription;
                return $sub && $sub->status === 'active' && $sub->plan_key === $planKey && !$sub->isExpired();
            })->count();

        if ($limit <= 0) {
            throw new \Exception('This plan does not include additional team members.');
        }

        if ($assignedCount >= $limit) {
            throw new \Exception('No included seats available.');
        }

        // Idempotent: if member already has active same-plan subscription, return it
        $memberSub = self::getSubscriptionForUser($member);
        if ($memberSub && $memberSub->status === 'active' && $memberSub->plan_key === $planKey && !$memberSub->isExpired()) {
            return $memberSub;
        }

        // Create or update member subscription as included seat
        $data = [
            'plan_key'      => $planKey,
            'paid_amount'   => 0,
            'razorpay_payment_id' => null,
            'status'        => 'active',
            'starts_at'     => now(),
            'ends_at'       => $adminSub->ends_at,
            'trial_ends_at' => null,
            'trip_limit'    => $adminSub->trip_limit,
        ];

        // Use transaction for safety
        return \DB::transaction(function () use ($admin, $member, $memberSub, $data) {
            if ($memberSub) {
                $memberSub->update($data);
                $sub = $memberSub->fresh();
            } else {
                $sub = $member->subscription()->create(array_merge($data, ['trips_used' => 0]));
            }

            $member->update(['status' => 'active']);

            // Minimal audit log
            \Log::info('Assigned included seat', ['admin_id' => $admin->id ?? null, 'member_id' => $member->id, 'plan' => $data['plan_key']]);

            return $sub->fresh();
        });
    }
}
