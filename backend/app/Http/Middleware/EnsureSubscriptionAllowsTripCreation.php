<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards trip-creation (POST /api/trips) for both admin and team users.
 *
 * Previously called getAdminSubscription() directly on $user, which returned
 * null for team members → 403 for all team trip creation (BUG-1).
 * Previously used a live Trip count instead of total_trips_created (BUG-5).
 *
 * Now delegates entirely to SubscriptionService::canCreateTrip(), which:
 *  - Resolves the admin regardless of who is making the request
 *  - Uses subscriptions.total_trips_created as the single counter
 */
class EnsureSubscriptionAllowsTripCreation
{
    public function handle(Request $request, Closure $next): Response
    {
        $result = SubscriptionService::canCreateTrip($request->user());

        if (!$result['allowed']) {
            return response()->json(['message' => $result['reason']], $result['http_status']);
        }

        return $next($request);
    }
}
