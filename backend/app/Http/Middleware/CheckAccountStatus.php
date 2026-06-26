<?php

namespace App\Http\Middleware;

use App\Models\Team;
use App\Models\User;
use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards all authenticated routes.
 *
 * Previous implementation checked admin subscription seats for team members
 * (BUG-2): if admin was on trial, ALL team members were locked out even if
 * they had teams.is_paid = true.
 *
 * New implementation uses SubscriptionService::canLogin() which reads from the
 * single subscriptions table.  Admin seat counting is removed — each member
 * has their own subscription row.
 */
class CheckAccountStatus
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        // 1. Check the user's own account status
        if (in_array($user->status, ['inactive', 'suspended'])) {
            return $this->lockOut($user, 'your account is ' . $user->status);
        }

        // 2. Extra checks for team members
        if ($user->role === 'team') {
            // 2a. Parent admin must be active — single JOIN query instead of
            //     loading teamRecord + User::find() separately (saves 1 query
            //     per request for every team-role API call).
            // MongoDB has no joins: resolve the member's team, then its admin.
            $team = Team::where('user_id', $user->id)->first();
            $adminStatus = $team
                ? optional(User::find($team->created_by))->status
                : null;

            if ($adminStatus && in_array($adminStatus, ['inactive', 'suspended'])) {
                return $this->lockOut($user, "your admin's account is " . $adminStatus);
            }

            // 2b. Per-member subscription gate (is the member's plan active?)
            $result = SubscriptionService::canLogin($user);
            if (!$result['allowed']) {
                return $this->lockOut($user, $result['reason']);
            }
        }

        return $next($request);
    }

    private function lockOut($user, string $reason): Response
    {
        // Guard against TransientToken used in tests (no delete() method).
        $token = $user->currentAccessToken();
        if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

        return response()->json([
            'message'        => 'Your account has been locked. Reason: ' . $reason . '. Please contact support.',
            'account_status' => $user->status,
        ], 403);
    }
}
