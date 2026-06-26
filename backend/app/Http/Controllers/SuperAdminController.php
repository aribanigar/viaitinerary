<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Team;
use App\Models\Trip;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\AgencySetting;
use App\Models\InclusionExclusion;
use App\Models\DemoRequest;
use App\Models\LeadInquiry;
use App\Services\SubscriptionService;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class SuperAdminController extends Controller
{
    public function dashboard()
    {
        $plans = config('plans', []);
        $now   = Carbon::now();

        // ── 1. Basic platform counts ─────────────────────────────────────────
        $totalAdmins = User::where('role', 'admin')->count();
        $totalTeams  = Team::count();
        // Trips uses a global scope (admin_context) that must be disabled for super admin analytics.
        $totalTrips  = Trip::withoutGlobalScope('admin_context')->count();
        $activeTeams = Team::where('is_active', true)->count();

        $newAdminsThisMonth = User::where('role', 'admin')
            ->whereYear('created_at', $now->year)
            ->whereMonth('created_at', $now->month)
            ->count();

        $tripsThisMonth = Trip::withoutGlobalScope('admin_context')
            ->whereYear('created_at', $now->year)
            ->whereMonth('created_at', $now->month)
            ->count();

        // ── 2. Subscription & revenue analytics ──────────────────────────────
        $adminIds      = User::where('role', 'admin')->pluck('id');
        $subscriptions = Subscription::whereIn('user_id', $adminIds)->get();

        $planBreakdown = [
            'trial'      => $subscriptions->where('plan_key', 'trial')->count(),
            'monthly'    => $subscriptions->where('plan_key', 'monthly')->count(),
            'six_months' => $subscriptions->where('plan_key', 'six_months')->count(),
            'yearly'     => $subscriptions->where('plan_key', 'yearly')->count(),
        ];

        // Active paid subscriptions: status = 'active' AND ends_at > now
        $activePaid = $subscriptions->where('status', 'active')->filter(
            fn($s) => $s->ends_at && $s->ends_at->greaterThan($now)
        );

        // MRR = price / duration_months for each active paid plan
        $mrr = 0;
        foreach ($activePaid as $sub) {
            $planConf   = $plans[$sub->plan_key] ?? null;
            $price      = $planConf['price'] ?? 0;
            $durationMo = max((int) ($planConf['duration_months'] ?? 1), 1);
            $mrr += $price / $durationMo;
        }
        $mrr = (int) round($mrr);
        $arr = $mrr * 12;

        // Total revenue = sum of plan prices for all currently active paid plans
        $totalRevenue = 0;
        foreach ($activePaid as $sub) {
            $totalRevenue += $plans[$sub->plan_key]['price'] ?? 0;
        }

        // Trials expiring within 3 days
        $trialsExpiringSoon = Subscription::whereIn('user_id', $adminIds)
            ->where('plan_key', 'trial')
            ->where('status', 'trialing')
            ->whereBetween('trial_ends_at', [$now->copy(), $now->copy()->addDays(3)])
            ->count();

        // Platform Total Revenue (Sum of all paid amounts across all itineraries/trips)
        $platformTotalRevenue = Trip::withoutGlobalScope('admin_context')->sum('paid_amount');

        // ── 3. Inquiry analytics ─────────────────────────────────────────────
        $totalInquiries = LeadInquiry::count();
        $pipelineValue  = (float) LeadInquiry::whereNotNull('approximate_budget')
            ->sum('approximate_budget');

        $rawByStatus = LeadInquiry::selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        $inquiryByStatus = [];
        foreach (['new', 'contacted', 'quoted', 'converted', 'closed'] as $s) {
            $inquiryByStatus[$s] = (int) ($rawByStatus[$s] ?? 0);
        }

        // ── 4. Demo request stats ─────────────────────────────────────────────
        $totalDemos   = DemoRequest::count();
        $pendingDemos = DemoRequest::where('status', 'pending')->count();
        $recentDemos  = DemoRequest::latest()
            ->take(5)
            ->get(['id', 'name', 'company_name', 'agency_type', 'no_of_employees', 'status', 'created_at']);

        // ── 5. 6-Month growth ─────────────────────────────────────────────────
        $growth = [];
        for ($i = 5; $i >= 0; $i--) {
            $month    = $now->copy()->subMonths($i);
            $growth[] = [
                'month'     => $month->format('M Y'),
                'admins'    => User::where('role', 'admin')
                    ->whereYear('created_at', $month->year)
                    ->whereMonth('created_at', $month->month)
                    ->count(),
                'trips'     => Trip::withoutGlobalScope('admin_context')
                    ->whereYear('created_at', $month->year)
                    ->whereMonth('created_at', $month->month)
                    ->count(),
                'inquiries' => LeadInquiry::whereYear('created_at', $month->year)
                    ->whereMonth('created_at', $month->month)
                    ->count(),
            ];
        }

        // ── 6. Recent businesses ──────────────────────────────────────────────
        $recentBusinesses = User::where('role', 'admin')
            ->with('subscription')
            ->latest()
            ->take(5)
            ->get()
            ->map(fn($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'status'     => $u->status,
                'plan'       => $u->subscription?->plan_key ?? 'none',
                'created_at' => $u->created_at,
            ]);

        return response()->json([
            'total_admins'          => $totalAdmins,
            'total_teams'           => $totalTeams,
            'total_trips'           => $totalTrips,
            'active_teams'          => $activeTeams,
            'new_admins_this_month' => $newAdminsThisMonth,
            'trips_this_month'      => $tripsThisMonth,
            'mrr'                   => $mrr,
            'arr'                   => $arr,
            'total_revenue'         => (float)$platformTotalRevenue,
            'trials_expiring_soon'  => $trialsExpiringSoon,
            'plan_breakdown'        => $planBreakdown,
            'inquiries'             => [
                'total'          => $totalInquiries,
                'pipeline_value' => $pipelineValue,
                'by_status'      => $inquiryByStatus,
            ],
            'demos'             => [
                'total'   => $totalDemos,
                'pending' => $pendingDemos,
                'recent'  => $recentDemos,
            ],
            'growth'            => $growth,
            'recent_businesses' => $recentBusinesses,
        ]);
    }

    public function businesses(Request $request)
    {
        $perPage = (int) $request->input('per_page', 25);
        $perPage = max(1, min($perPage, 500));
        $search = trim((string) $request->input('search', ''));
        $returnAll = $request->boolean('all');

        // withCount uses subqueries — zero N+1 regardless of admin count
        $query = User::where('role', 'admin')
            ->with(['subscription', 'agencySetting'])
            ->withSum([
                'trips as total_revenue' => function ($q) {
                    // Sum of paid_amount across all itineraries/trips for this admin.
                    // Trips uses a global scope (admin_context) that must be disabled
                    // for super admin reporting.
                    $q->withoutGlobalScope('admin_context');
                },
            ], 'paid_amount')
            ->withCount([
                'teamsCreated as team_members_count',
                'trips as trips_count' => function ($q) {
                    // Trips uses a global scope (admin_context) that would otherwise
                    // scope results to the currently-authenticated super admin.
                    $q->withoutGlobalScope('admin_context');
                },
            ])
            ->when($search !== '', function ($q) use ($search) {
                $like = '%' . $search . '%';
                $q->where(function ($sub) use ($like) {
                    $sub->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like);
                });
            })
            ->latest();

        $admins = $returnAll ? $query->get() : $query->paginate($perPage);
        $collection = $admins instanceof \Illuminate\Pagination\LengthAwarePaginator
            ? $admins->getCollection()
            : $admins;

        $businesses = $collection->map(function ($admin) {
            $subscription = $admin->subscription;
            $agency = $admin->agencySetting;
            $planInfo     = null;

            if ($subscription) {
                $planInfo = [
                    'plan_name'  => $subscription->plan_key,
                    'is_trial'   => $subscription->isTrial(),
                    'is_expired' => $subscription->isExpired(),
                    'expires_at' => $subscription->isTrial()
                        ? $subscription->trial_ends_at
                        : $subscription->ends_at,
                ];
            }

            return [
                'id'                 => $admin->id,
                'name'               => $admin->name,
                'email'              => $admin->email,
                'phone'              => $agency ? $agency->contact_phone : null,
                'status'             => $admin->status,
                'bypass_subscription' => (bool) $admin->bypass_subscription,
                'team_members_count' => $admin->team_members_count ?? 0,
                'trips_count'        => $admin->trips_count ?? 0,
                // Laravel's withSum may expose either the alias directly (total_revenue)
                // or as "<alias>_sum_<column>" depending on version.
                'total_revenue'      => (float) ($admin->total_revenue ?? $admin->total_revenue_sum_paid_amount ?? 0),
                'plan'               => $planInfo,
                'created_at'         => $admin->created_at,
            ];
        })->values();

        if ($admins instanceof \Illuminate\Pagination\LengthAwarePaginator) {
            $admins->setCollection($businesses);
            $pagination = [
                'current_page' => $admins->currentPage(),
                'last_page'    => $admins->lastPage(),
                'per_page'     => $admins->perPage(),
                'total'        => $admins->total(),
                'from'         => $admins->firstItem() ?? 0,
                'to'           => $admins->lastItem() ?? 0,
            ];
            $businessesPayload = $admins->items();
        } else {
            $total = $businesses->count();
            $pagination = [
                'current_page' => 1,
                'last_page'    => 1,
                'per_page'     => $total,
                'total'        => $total,
                'from'         => $total ? 1 : 0,
                'to'           => $total,
            ];
            $businessesPayload = $businesses;
        }

        return response()->json([
            'businesses' => $businessesPayload,
            'pagination' => $pagination,
        ]);
    }

    public function showBusiness(User $user)
    {
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Not a valid business account'], 404);
        }

        $user->load(['subscription', 'agencySetting']);
        $user->loadCount([
            'teamsCreated as team_members_count',
            'trips as trips_count' => function ($q) {
                $q->withoutGlobalScope('admin_context');
            },
        ]);

        // Calculate Revenue: sum of paid_amount across all itineraries/trips for this business.
        $totalRevenue = Trip::withoutGlobalScope('admin_context')
            ->where('user_id', $user->id)
            ->sum('paid_amount');

        // Fetch last 5 itineraries
        $recentTrips = Trip::withoutGlobalScope('admin_context')
            ->where('user_id', $user->id)
            ->latest()
            ->take(5)
            ->get(['id', 'trip_title', 'destination', 'created_at', 'status', 'paid_amount']);

        // Fetch all team members with subscription state so super admin
        // can assign included seats directly from the business page.
        $teamRows = Team::where('created_by', $user->id)
            ->with(['user:id,name,email,status', 'user.subscription'])
            ->get();

        $teamMembers = $teamRows->map(function ($team) {
            $memberSub = $team->user?->subscription;

            return [
                'id' => $team->id,
                'user_id' => $team->user_id,
                'name' => $team->user?->name,
                'email' => $team->user?->email,
                'status' => $team->user?->status,
                'job_title' => $team->job_title,
                'image_url' => $team->image_url,
                'is_paid' => (bool) $team->is_paid,
                'subscription' => $memberSub ? [
                    'plan_key' => $memberSub->plan_key,
                    'status' => $memberSub->status,
                    'is_trial' => $memberSub->isTrial(),
                    'is_expired' => $memberSub->isExpired(),
                ] : null,
            ];
        });

        $subscription = $user->subscription;
        $teamMemberLimit = 0;
        $assignedSeats = 0;
        $availableSeats = 0;
        $seatAssignmentReason = null;

        if ($subscription && $subscription->isActive()) {
            $plan = Plan::where('key', $subscription->plan_key)->first();
            $teamMemberLimit = (int) ($plan->team_member_limit ?? 0);

            $assignedSeats = $teamRows->filter(function ($team) use ($subscription) {
                $memberSub = $team->user?->subscription;
                return $memberSub
                    && $memberSub->status === 'active'
                    && $memberSub->plan_key === $subscription->plan_key
                    && !$memberSub->isExpired();
            })->count();

            $availableSeats = max(0, $teamMemberLimit - $assignedSeats);

            if ($teamMemberLimit <= 0) {
                $seatAssignmentReason = 'Current plan does not include additional team seats.';
            } elseif ($availableSeats <= 0) {
                $seatAssignmentReason = 'No included seats available on this plan.';
            }
        } else {
            $seatAssignmentReason = 'Business does not have an active subscription plan.';
        }

        $planInfo = null;
        if ($subscription) {
            $planInfo = [
                'plan_name'  => $subscription->plan_key,
                'is_trial'   => $subscription->isTrial(),
                'is_expired' => $subscription->isExpired(),
                'expires_at' => $subscription->isTrial()
                    ? $subscription->trial_ends_at
                    : $subscription->ends_at,
                'team_member_limit' => $teamMemberLimit,
            ];
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'created_at' => $user->created_at,
            'bypass_subscription' => (bool) $user->bypass_subscription,
            'team_members_count' => $user->team_members_count,
            'trips_count' => $user->trips_count,
            'total_revenue' => (float)$totalRevenue,
            'plan' => $planInfo,
            'seat_summary' => [
                'team_member_limit' => $teamMemberLimit,
                'assigned_count' => $assignedSeats,
                'available_count' => $availableSeats,
                'can_assign' => ($subscription && $subscription->isActive() && $teamMemberLimit > 0 && $availableSeats > 0),
                'reason' => $seatAssignmentReason,
            ],
            'recent_trips' => $recentTrips,
            'team_members' => $teamMembers,
        ]);
    }

    public function assignBusinessMemberSeat(Request $request, User $user)
    {
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Not a valid business account'], 404);
        }

        $request->validate([
            'member_user_id' => 'required|integer|exists:users,id',
        ]);

        $member = User::find($request->member_user_id);
        if (!$member) {
            return response()->json(['message' => 'Member not found.'], 404);
        }

        $team = $member->teamRecord;
        if (!$team || (int) $team->created_by !== (int) $user->id) {
            return response()->json(['message' => 'Member does not belong to this business.'], 403);
        }

        try {
            $sub = SubscriptionService::assignIncludedSeat($user, $member);
            return response()->json([
                'message' => 'Seat assigned successfully.',
                'subscription' => $sub,
            ]);
        } catch (\Exception $e) {
            logger()->warning('Super admin assign included seat failed', [
                'error' => $e->getMessage(),
                'business_admin_id' => $user->id,
                'member_id' => $member->id,
            ]);
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function storeBusiness(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => PasswordPolicy::required(),
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'email_verified_at' => Carbon::now(),
            'role' => 'admin',
            'status' => 'active'
        ]);

        // Create default agency settings
        AgencySetting::create([
            'user_id' => $user->id,
            'agency_name' => $user->name . ' Travels',
            'contact_email' => $user->email,
            'contact_phone' => '+91 1234567890',
            'website' => 'www.youragency.com',
            'address' => 'Sample Address',
            'city' => 'Sample City',
            'state' => 'Sample State',
            'country' => 'India',
            'postal_code' => '123456',
        ]);

        // Create default Inclusion/Exclusion
        InclusionExclusion::create([
            'user_id' => $user->id,
            'name' => 'General Domestic Package',
            'inclusions' => ["Accommodation on twin sharing basis", "Daily Breakfast", "Sightseeing by Private AC Vehicle", "All taxes and tolls"],
            'exclusions' => ["Airfare / Train fare", "Personal expenses", "Entrance fees at monuments", "Lunch & Dinner", "Travel Insurance"]
        ]);

        // Automatically start trial
        $subscriptionService = new SubscriptionService();
        $subscriptionService->startTrial($user);

        return response()->json([
            'message' => 'Business created successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'created_at' => $user->created_at,
                'team_members_count' => 0,
                'trips_count' => 0,
                'plan' => [
                    'plan_name' => 'trial',
                    'is_trial' => true,
                    'is_expired' => false,
                    'expires_at' => Carbon::parse($user->subscription->trial_ends_at)->toIso8601String()
                ]
            ]
        ], 201);
    }

    public function updateStatus(Request $request, User $user)
    {
        $request->validate([
            'status' => 'required|in:active,inactive,suspended',
        ]);

        $user->update(['status' => $request->status]);

        return response()->json([
            'message' => 'Status updated successfully',
            'status' => $user->status
        ]);
    }

    public function toggleBypassSubscription(User $user)
    {
        $user->update(['bypass_subscription' => !$user->bypass_subscription]);

        return response()->json([
            'message' => 'Bypass updated successfully',
            'bypass_subscription' => (bool) $user->bypass_subscription,
        ]);
    }

    public function updateBusiness(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'password' => PasswordPolicy::nullable(),
        ]);

        $data = [
            'name' => $request->name,
            'email' => $request->email,
        ];

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return response()->json([
            'message' => 'Business updated successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ]
        ]);
    }

    public function destroyBusiness(User $user)
    {
        // Add logic to prevent deleting self or other super admins if necessary
        if ($user->role === 'super_admin') {
            return response()->json(['message' => 'Cannot delete super admin'], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'Business deleted successfully'
        ]);
    }
}
