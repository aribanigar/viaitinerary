<?php

namespace App\Http\Controllers;

use App\Models\AgencySetting;
use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Subscription endpoints.
 *
 * ROOT BUG FIX: The previous upgrade() code resolved the subscription target
 * via teams.id (team_id param) and then called SubscriptionService::upgradeMember()
 * which wrote to the teams table. Now the target is always a User model identified
 * by user_id, and upgrades write exclusively to the subscriptions table.
 *
 * POST /subscription/upgrade
 *   { plan: 'monthly' }                    → upgrade the calling admin
 *   { plan: 'monthly', member_user_id: N } → upgrade team member user N
 *
 * GET /subscription/status
 *   ?                       → calling user's subscription (admin context)
 *   ?member_user_id=N       → specific member's subscription (admin only)
 */
class SubscriptionController extends Controller
{
    private function normalizeCountry(?string $country): ?string
    {
        if (!$country) {
            return null;
        }

        $normalized = strtoupper(trim($country));
        return $normalized === '' ? null : $normalized;
    }

    private function resolveCountry(Request $request, ?User $user): ?string
    {
        $explicitCountry = $this->normalizeCountry(
            $request->query('country') ?? $request->header('X-Country-Code')
        );

        if ($explicitCountry) {
            return $explicitCountry;
        }

        if (!$user || !Schema::hasColumn('agency_settings', 'country')) {
            return null;
        }

        $adminId = $user->getAdminId();
        $savedCountry = AgencySetting::where('user_id', $adminId)->value('country');
        return $this->normalizeCountry($savedCountry);
    }

    private function getActivePlans(?string $country = null)
    {
        $query = Plan::where('is_active', true)
            ->where('key', '!=', 'trial')
            ->orderBy('price');

        if ($country) {
            $query->where(function ($inner) use ($country) {
                $inner->where('country', $country)
                    ->orWhereNull('country');
            });
        }

        $plans = $query->get();

        if (!$country) {
            return $plans->keyBy('key');
        }

        // Prefer country-specific plans over global plans when the same key exists.
        return $plans
            ->sortBy(function ($plan) use ($country) {
                return $plan->country === $country ? 0 : 1;
            })
            ->unique('key')
            ->keyBy('key');
    }

    private function getActiveOffer(?string $country = null): ?Plan
    {
        $query = Plan::where('is_active', true)
            ->where('is_offer', true)
            ->where(function ($query) {
                $query->whereNull('offer_starts_at')
                    ->orWhere('offer_starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('offer_expires_at')
                    ->orWhere('offer_expires_at', '>', now());
            });

        if ($country) {
            $query->where(function ($inner) use ($country) {
                $inner->where('country', $country)
                    ->orWhereNull('country');
            })->orderByRaw('CASE WHEN country = ? THEN 0 ELSE 1 END', [$country]);
        }

        return $query->first();
    }

    public function status(Request $request)
    {
        // Try to get user from Sanctum if token is present, even if route is public
        $user = $request->user('sanctum');
        $resolvedCountry = $this->resolveCountry($request, $user);

        // Check for active offer plans to display as popup
        $offer = $this->getActiveOffer($resolvedCountry);

        // -------------------------------------------------------------------
        // Guest context (no user) - return offer and plans
        // -------------------------------------------------------------------
        if (!$user) {
            return response()->json([
                'plan_name'       => 'guest',
                'active_offer'    => $offer,
                'available_plans' => $this->getActivePlans($resolvedCountry),
                'country'         => $resolvedCountry,
            ]);
        }

        // -------------------------------------------------------------------
        // Member subscription status (admin checking a specific member)
        // -------------------------------------------------------------------
        if ($request->filled('member_user_id')) {
            $member = User::find($request->member_user_id);

            if (!$member) {
                return response()->json(['message' => 'Member not found.'], 404);
            }

            $team = $member->teamRecord;
            if (!$team || $team->created_by !== $user->id) {
                return response()->json(['message' => 'Access denied.'], 403);
            }

            $sub = \App\Services\SubscriptionService::getSubscriptionForUser($member);

            $planInfo = null;
            if ($sub) {
                $planInfo = [
                    'plan_name'  => $sub->plan_key,
                    'is_trial'   => $sub->isTrial(),
                    'is_expired' => $sub->isExpired(),
                    'expires_at' => $sub->isTrial()
                        ? $sub->trial_ends_at
                        : $sub->ends_at,
                ];
            }

            return response()->json([
                'plan'                 => $planInfo,
                'plan_name'            => $sub?->plan_key,
                'status'               => $sub?->status ?? 'pending',
                'is_paid'              => $sub && $sub->status === 'active' && !$sub->isExpired(),
                'subscription_ends_at' => $sub?->ends_at,
                'is_expired'           => $sub ? $sub->isExpired() : false,
                'available_plans'      => $this->getActivePlans($resolvedCountry),
                'target_member'        => [
                    'id'      => $team->id,
                    'user_id' => $member->id,
                    'name'    => $member->name,
                    'email'   => $member->email,
                ],
                'country'              => $resolvedCountry,
            ]);
        }

        // -------------------------------------------------------------------
        // Calling user's subscription (admin context)
        // -------------------------------------------------------------------
        $adminId = $user->getAdminId();
        $admin   = User::find($adminId) ?? $user;

        $sub = SubscriptionService::getSubscriptionForUser($admin);

        Log::info('Subscription status check', [
            'user' => $user->email,
            'admin_id' => $adminId,
            'subscription' => $sub ? $sub->toArray() : null
        ]);

        if (!$sub && ($admin->role === 'admin' || $admin->role === 'superadmin')) {
            $sub = SubscriptionService::initializeTrial($admin);
        }


        if (!$sub) {
            // Return a mock object for SuperAdmin with bypass_subscription so they can see plans
            return response()->json([
                'plan_name'        => $admin->bypass_subscription ? 'enterprise' : 'none',
                'status'           => $admin->bypass_subscription ? 'active' : 'inactive',
                'is_paid'          => (bool) $admin->bypass_subscription,
                'can_create_trip'  => (bool) $admin->bypass_subscription,
                'is_trial_expired' => false,
                'seats_needed'     => 1 + \App\Models\Team::where('created_by', $admin->id)->count(),
                'available_plans'  => $this->getActivePlans($resolvedCountry),
                'bypass_subscription' => (bool) $admin->bypass_subscription,
                'active_offer'     => $offer,
                'country'          => $resolvedCountry,
            ]);
        }

        $isTrialExpired = $sub->isTrial() && $sub->isExpired();
        $canCreateTrip  = true;

        // Super admin bypass: skip all restriction logic
        if ($admin->bypass_subscription) {
            $isTrialExpired = false;
            $canCreateTrip  = true;
        } else {
            if ($sub->isTrial()) {
                if ($isTrialExpired || ($sub->trip_limit !== null && $sub->trips_used >= $sub->trip_limit)) {
                    $canCreateTrip = false;
                }
            } elseif ($sub->isExpired()) {
                $canCreateTrip = false;
            }
        }

        $seatsNeeded = 1 + \App\Models\Team::where('created_by', $admin->id)->count();

        $planInfo = null;
        if ($sub) {
            $planInfo = [
                'plan_name'  => $sub->plan_key,
                'is_trial'   => $sub->isTrial(),
                'is_expired' => $sub->isExpired(),
                'expires_at' => $sub->isTrial()
                    ? $sub->trial_ends_at
                    : $sub->ends_at,
            ];
        }

        return response()->json([
            'plan'             => $planInfo,
            // Keep legacy fields for backward compatibility if any
            'plan_name'        => $sub->plan_key,
            'plan_key'         => $sub->plan_key,
            'trial_ends_at'    => $sub->trial_ends_at,
            'is_trial_expired' => $isTrialExpired,
            'is_trial'         => $sub->isTrial(),
            'is_expired'       => $sub->isExpired(),
            'trips_used'       => $sub->trips_used,
            'trips_limit'      => $sub->trip_limit,
            'can_create_trip'  => $canCreateTrip,
            'status'           => $sub->status,
            'ends_at'          => $sub->ends_at,
            'seats_needed'     => $seatsNeeded,
            'available_plans'  => $this->getActivePlans($resolvedCountry),
            'bypass_subscription' => (bool) $admin->bypass_subscription,
            'active_offer'     => $offer,
            'country'          => $resolvedCountry,
        ]);
    }

    public function upgrade(Request $request)
    {
        $request->validate([
            'plan'           => 'required|string|exists:plans,key',
            'member_user_id' => 'nullable|integer|exists:users,id',
        ]);

        $caller  = $request->user();
        $planKey = $request->plan;

        // -------------------------------------------------------------------
        // Team member upgrade
        // -------------------------------------------------------------------
        if ($request->filled('member_user_id')) {
            $member = User::find($request->member_user_id);

            // Validate that this member's team record belongs to the calling admin
            $team = $member?->teamRecord;
            if (!$member || !$team || $team->created_by !== $caller->id) {
                return response()->json(['message' => 'Team member not found or access denied.'], 404);
            }

            // THE FIX: upgradeUserToPlan uses $member->id as user_id — NOT the admin's id.
            SubscriptionService::upgradeUserToPlan($member, $planKey);

            return response()->json([
                'message'       => 'Team member subscribed successfully.',
                'plan_name'     => $planKey,
                'target_member' => $member->name,
            ]);
        }

        // -------------------------------------------------------------------
        // Admin self-upgrade
        // -------------------------------------------------------------------
        if ($caller->role !== 'admin') {
            return response()->json(['message' => 'Only admins can upgrade their own plan.'], 403);
        }

        $plan = \App\Models\Plan::where('key', $planKey)->first();

        \App\Services\SubscriptionService::upgradeUserToPlan($caller, $planKey);

        return response()->json([
            'message'    => 'Plan upgraded successfully.',
            'plan_name'  => $planKey,
            'total_cost' => $plan ? $plan->price : 0,
        ]);
    }

    /**
     * Assign an included seat from the caller's plan to an existing team member.
     * POST /subscription/assign-member
     * body: { member_user_id }
     */
    public function assignMember(Request $request)
    {
        $request->validate([
            'member_user_id' => 'required|integer|exists:users,id',
        ]);

        $caller = $request->user();
        if ($caller->role !== 'admin' && $caller->role !== 'superadmin') {
            return response()->json(['message' => 'Only admins can assign included seats.'], 403);
        }

        $member = User::find($request->member_user_id);
        if (!$member) {
            return response()->json(['message' => 'Member not found.'], 404);
        }

        $team = $member->teamRecord;
        if (!$team || $team->created_by !== $caller->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        try {
            $sub = \App\Services\SubscriptionService::assignIncludedSeat($caller, $member);
            return response()->json(['message' => 'Seat assigned successfully.', 'subscription' => $sub]);
        } catch (\Exception $e) {
            Log::warning('Assign included seat failed', ['error' => $e->getMessage(), 'admin' => $caller->id, 'member' => $member->id]);
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
