<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Traits\HandlesBase64Images;

class TeamController extends Controller
{
    use HandlesBase64Images;

    private function ensureTeamManager(Request $request): void
    {
        if (!in_array($request->user()->role, ['admin', 'super_admin'], true)) {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * Ensure the target team member belongs to the authenticated admin context.
     */
    private function ensureOwnsTeam(Request $request, Team $team): void
    {
        $this->ensureTeamManager($request);

        if ((int) $team->created_by !== (int) $request->user()->getAdminId()) {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->ensureTeamManager($request);

        $userId = $request->user()->id;
        // Eager-load user.subscription so Team::getIsPaidAttribute() has no N+1 queries
        return response()->json(
            Team::with(['user', 'user.subscription'])
                ->where('created_by', $userId)
                ->latest()
                ->get()
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $this->ensureTeamManager($request);

        // Enforce: trial admins cannot add team members
        $canAdd = \App\Services\SubscriptionService::canAddTeamMember($request->user());
        if (!$canAdd['allowed']) {
            return response()->json(['message' => $canAdd['reason']], 403);
        }

        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'email'           => 'required|email|unique:users,email',
            'password'        => PasswordPolicy::required(),
            'job_title'       => 'nullable|string|max:255',
            'phone'           => 'required|phone:AUTO',
            'photo'           => 'nullable|string',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        // Create the user account
        $user = new User();
        $user->name     = $validated['name'];
        $user->email    = $validated['email'];
        $user->password = Hash::make($validated['password']);
        $user->role     = 'team';
        $user->status   = 'active'; // user account is active; subscription gates login
        $user->save();

        // Create team record
        $team = new Team();
        $team->user_id         = $user->id;
        $team->created_by      = $request->user()->id;
        $team->job_title       = $validated['job_title'] ?? null;
        $team->phone           = $validated['phone'] ?? null;
        $team->commission_rate = $validated['commission_rate'] ?? 0;
        $team->is_active       = true;

        if ($request->filled('photo')) {
            $team->image_path = $this->saveBase64Image($request->photo, 'teams');
        }

        $team->save();

        // Create a PENDING subscription so the member row exists but login is blocked
        // until an admin selects a plan on the Pricing page.
        $user->subscription()->create([
            'plan_key'   => null,
            'status'     => 'pending',
            'trip_limit' => null,
            'trips_used' => 0,
        ]);

        $team->load(['user', 'user.subscription']);

        return response()->json($team, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Team $team)
    {
        $this->ensureOwnsTeam($request, $team);
        $team->load(['user', 'user.subscription']);
        return response()->json($team);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Team $team)
    {
        $this->ensureOwnsTeam($request, $team);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $team->user_id,
            'password' => PasswordPolicy::nullable(),
            'job_title' => 'nullable|string|max:255',
            'phone' => 'required|phone:AUTO',
            'photo' => 'nullable|string', // Base64
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'is_active' => 'boolean',
        ]);

        // Update the user account
        $user = $team->user;
        $user->name = $validated['name'];
        $user->email = $validated['email'];
        if ($request->filled('password')) {
            $user->password = Hash::make($validated['password']);
        }
        $user->save();

        // Update the team record
        // Name is stored in users table
        $team->job_title = $validated['job_title'] ?? null;
        $team->phone = $validated['phone'];
        $team->commission_rate = $validated['commission_rate'] ?? $team->commission_rate;

        if (array_key_exists('is_active', $validated)) {
            $team->is_active = $validated['is_active'];
        }

        if ($request->filled('photo')) {
            $team->image_path = $this->saveBase64Image($request->photo, 'teams');
        }

        $team->save();

        $team->load(['user', 'user.subscription']);

        return response()->json($team);
    }

    /**
     * Toggle the status of the specified team member.
     */
    public function toggleStatus(Request $request, Team $team)
    {
        $this->ensureOwnsTeam($request, $team);

        $team->is_active = !$team->is_active;
        $team->save();

        $team->load(['user', 'user.subscription']);

        return response()->json($team);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Team $team)
    {
        $this->ensureOwnsTeam($request, $team);

        // Delete the user account as well
        $team->user->delete();
        $team->delete();
        return response()->json(['message' => 'Team member deleted successfully']);
    }
}
