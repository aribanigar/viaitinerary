<?php

namespace Tests\Feature;

use App\Models\Subscription;
use App\Models\Team;
use App\Models\Trip;
use App\Models\User;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Comprehensive subscription-flow tests.
 *
 * Regression suite for the bugs fixed in the subscription refactor:
 *
 *  BUG-1  EnsureSubscriptionAllowsTripCreation returned 403 for ALL team users.
 *  BUG-2  CheckAccountStatus locked out team members when admin was on trial.
 *  BUG-3  Trial was never initialized on signup; started on first API hit.
 *  BUG-4  Admin upgrade silently failed to write users table (fillable guard).
 *  BUG-5  Middleware used live trip count; controller used trips_used.
 *  BUG-6  ROOT BUG: upgrade endpoint used admin user_id instead of member user_id.
 *
 * Schema note: subscriptions.plan_key (was plan_name), trips_used (was total_trips_created),
 * ends_at (was subscription_ends_at), starts_at (was trial_started_at).
 * All users have their own subscription row (user_id UNIQUE).
 */
class SubscriptionFlowTest extends TestCase
{
    use RefreshDatabase;

    // =========================================================================
    // Helpers
    // =========================================================================

    /** Create an admin user with an eagerly-initialized trial subscription. */
    private function makeAdmin(array $attrs = []): User
    {
        $admin = User::factory()->create(array_merge(['role' => 'admin', 'status' => 'active'], $attrs));
        SubscriptionService::initializeTrial($admin);
        return $admin;
    }

    /**
     * Create a team member belonging to $admin.
     *
     * Creates a pending subscription row for the member.
     * If $isPaid = true, upgrades the member to $planKey via the new service method.
     *
     * @return array{0: User, 1: Team}
     */
    private function makeMember(User $admin, bool $isPaid = false, ?string $planKey = null): array
    {
        $memberUser = User::factory()->create(['role' => 'team', 'status' => 'active']);
        $team = Team::create([
            'user_id'    => $memberUser->id,
            'created_by' => $admin->id,
            'is_active'  => true,
        ]);

        // Every member gets a subscription row (pending by default)
        $memberUser->subscription()->create([
            'plan_key'   => null,
            'status'     => 'pending',
            'trips_used' => 0,
        ]);

        if ($isPaid && $planKey) {
            // THE FIX: upgradeUserToPlan targets the member user, NOT the admin
            SubscriptionService::upgradeUserToPlan($memberUser, $planKey);
            $memberUser->refresh();
            $team->refresh();
        }

        return [$memberUser, $team];
    }

    // =========================================================================
    // Trial enforcement — admin
    // =========================================================================

    /** Trial subscription is created eagerly at signup time (BUG-3 regression). */
    public function test_trial_subscription_is_initialized_on_signup(): void
    {
        $admin = $this->makeAdmin();

        $sub = Subscription::where('user_id', $admin->id)->first();

        $this->assertNotNull($sub, 'Subscription row should exist immediately after signup.');
        $this->assertEquals('trial', $sub->plan_key);
        $this->assertEquals('trialing', $sub->status);
        $this->assertNotNull($sub->starts_at);
        $this->assertNotNull($sub->trial_ends_at);
        $this->assertEquals(0, $sub->trips_used);
    }

    /** Admin can create up to 3 trips while on trial. */
    public function test_trial_admin_can_create_up_to_three_trips(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        for ($i = 1; $i <= 3; $i++) {
            $this->postJson('/api/trips', ['tripId' => "TRP-{$i}", 'tripTitle' => "Trip {$i}"])
                ->assertStatus(201);
        }

        $this->assertEquals(3, $admin->subscription->fresh()->trips_used);
    }

    /** 4th trip creation during trial must be blocked with HTTP 402. */
    public function test_trial_admin_cannot_create_fourth_trip(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        // Seed trips_used directly — no need to make actual API calls
        $admin->subscription->update(['trips_used' => 3]);

        $this->postJson('/api/trips', ['tripId' => 'TRP-OVER', 'tripTitle' => 'Over Limit'])
            ->assertStatus(402)
            ->assertJson(['message' => 'Trial limit reached. Upgrade to create more trips.']);
    }

    /** Expired trial blocks trip creation with HTTP 402 (middleware, not controller). */
    public function test_expired_trial_blocks_trip_creation(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        $admin->subscription->update(['trial_ends_at' => Carbon::now()->subMinute()]);

        $this->postJson('/api/trips', ['tripId' => 'TRP-EXP', 'tripTitle' => 'Expired'])
            ->assertStatus(402)
            ->assertJson(['message' => 'Trial has expired. Please upgrade.']);
    }

    // =========================================================================
    // BUG-1 regression — team member trip creation
    // =========================================================================

    /**
     * BUG-1: EnsureSubscriptionAllowsTripCreation used to call
     * $user->getAdminSubscription() which returned null for team users,
     * causing a 403 for every trip creation attempt by team members.
     */
    public function test_subscribed_team_member_can_create_trips(): void
    {
        $admin = $this->makeAdmin();
        SubscriptionService::upgradeUserToPlan($admin, 'monthly');

        [$memberUser] = $this->makeMember($admin, true, 'monthly');
        $this->actingAs($memberUser);

        $this->postJson('/api/trips', ['tripId' => 'TRP-MEMBER', 'tripTitle' => 'Member Trip'])
            ->assertStatus(201);
    }

    /**
     * Team member trip creation uses the ADMIN's trial counter.
     * If admin has hit trial limit, team members should also be blocked.
     */
    public function test_team_member_cannot_create_trips_if_admin_trial_exhausted(): void
    {
        $admin = $this->makeAdmin();
        $admin->subscription->update(['trips_used' => 3]);

        [$memberUser] = $this->makeMember($admin, true, 'monthly');
        $this->actingAs($memberUser);

        $this->postJson('/api/trips', ['tripId' => 'TRP-BLKD', 'tripTitle' => 'Blocked'])
            ->assertStatus(402);
    }

    // =========================================================================
    // BUG-2 regression — team member API access when admin on trial
    // =========================================================================

    /**
     * BUG-2: CheckAccountStatus used to check admin's subscription seats.
     * If admin was still on trial, ALL team members were locked out even
     * if teams.is_paid = true.
     */
    public function test_paid_team_member_can_access_api_while_admin_is_on_trial(): void
    {
        // Admin is on trial (not upgraded)
        $admin = $this->makeAdmin();
        $this->assertEquals('trial', $admin->subscription->plan_key);

        // Team member is subscribed individually
        [$memberUser] = $this->makeMember($admin, true, 'monthly');
        $this->actingAs($memberUser);

        // Should NOT be locked out — admin trial status is irrelevant for members
        $this->getJson('/api/user')->assertOk();
    }

    /** Unpaid team member is blocked by CheckAccountStatus on every request. */
    public function test_unpaid_team_member_cannot_access_protected_routes(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, false);
        $this->actingAs($memberUser);

        $this->getJson('/api/user')->assertStatus(403);
    }

    // =========================================================================
    // Team member login gating
    // =========================================================================

    /** Unpaid team member cannot log in. */
    public function test_unpaid_team_member_cannot_login(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, false);

        $this->postJson('/api/login', [
            'email'    => $memberUser->email,
            'password' => 'password',
        ])->assertStatus(403);
    }

    /** Paid team member with valid subscription can log in. */
    public function test_paid_team_member_can_login(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, true, 'monthly');

        $this->postJson('/api/login', [
            'email'    => $memberUser->email,
            'password' => 'password',
        ])->assertOk()->assertJsonStructure(['access_token']);
    }

    /** Team member with expired subscription cannot log in. */
    public function test_expired_team_member_cannot_login(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser, $team] = $this->makeMember($admin, true, 'monthly');

        // Force-expire the subscription
        $memberUser->subscription->update(['ends_at' => Carbon::now()->subDay()]);

        $this->postJson('/api/login', [
            'email'    => $memberUser->email,
            'password' => 'password',
        ])->assertStatus(403);
    }

    // =========================================================================
    // Member plan assignment flow
    // =========================================================================

    /**
     * THE ROOT BUG FIX: The upgrade endpoint must write to the MEMBER's
     * subscription row (user_id = memberUser.id), NOT to the admin's row.
     */
    public function test_admin_upgrade_targets_member_subscription_row_not_admin(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser, $team] = $this->makeMember($admin, false);

        $this->actingAs($admin);

        $this->postJson('/api/subscription/upgrade', [
            'plan'           => 'monthly',
            'member_user_id' => $memberUser->id,
        ])->assertOk()->assertJson(['plan_name' => 'monthly']);

        // Member's subscription row must be updated
        $this->assertDatabaseHas('subscriptions', [
            'user_id'  => $memberUser->id,
            'plan_key' => 'monthly',
            'status'   => 'active',
        ]);

        // Admin's subscription row must NOT be changed to monthly
        $this->assertDatabaseHas('subscriptions', [
            'user_id'  => $admin->id,
            'plan_key' => 'trial',
            'status'   => 'trialing',
        ]);
    }

    /**
     * Admin subscribes a team member via POST /api/subscription/upgrade.
     * After upgrade, the member's subscription row is active.
     */
    public function test_admin_can_subscribe_team_member_to_a_plan(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser, $team] = $this->makeMember($admin, false);

        $this->actingAs($admin);

        $this->postJson('/api/subscription/upgrade', [
            'plan'           => 'monthly',
            'member_user_id' => $memberUser->id,
        ])->assertOk()->assertJson(['plan_name' => 'monthly']);

        $sub = $memberUser->subscription()->first();

        $this->assertEquals('active', $sub->status);
        $this->assertEquals('monthly', $sub->plan_key);
        $this->assertNotNull($sub->ends_at);
    }

    /**
     * After member plan assignment, the member can log in and access the API.
     * This is the full happy-path for the team member upgrade flow.
     */
    public function test_team_member_can_login_after_admin_assigns_plan(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser, $team] = $this->makeMember($admin, false);

        // Admin upgrades the member
        $this->actingAs($admin);
        $this->postJson('/api/subscription/upgrade', [
            'plan'           => 'yearly',
            'member_user_id' => $memberUser->id,
        ])->assertOk();

        // Member should now be able to log in
        $this->postJson('/api/login', [
            'email'    => $memberUser->email,
            'password' => 'password',
        ])->assertOk()->assertJsonStructure(['access_token']);
    }

    // =========================================================================
    // Admin plan upgrade
    // =========================================================================

    /** Admin can upgrade their own plan. Subscription table is updated. */
    public function test_admin_can_upgrade_own_plan(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        $this->postJson('/api/subscription/upgrade', ['plan' => 'yearly'])
            ->assertOk()
            ->assertJson(['plan_name' => 'yearly']);

        $sub = $admin->subscription->fresh();
        $this->assertEquals('yearly', $sub->plan_key);
        $this->assertEquals('active', $sub->status);
        $this->assertNotNull($sub->ends_at);
    }

    /**
     * BUG-4 regression: Admin upgrade must NOT fail silently.
     * Confirm users table is NOT relied on — subscription table is the source.
     */
    public function test_admin_upgrade_writes_to_subscriptions_not_users_table(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        $this->postJson('/api/subscription/upgrade', ['plan' => 'monthly'])->assertOk();

        $this->assertDatabaseHas('subscriptions', [
            'user_id'  => $admin->id,
            'plan_key' => 'monthly',
        ]);

        $this->assertDatabaseMissing('subscriptions', [
            'user_id'  => $admin->id,
            'plan_key' => 'trial',
        ]);
    }

    // =========================================================================
    // Subscription status endpoint
    // =========================================================================

    /** Status endpoint returns correct structure for admin. */
    public function test_subscription_status_endpoint_structure(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        $this->getJson('/api/subscription/status')
            ->assertOk()
            ->assertJsonStructure([
                'plan_name',
                'trial_ends_at',
                'is_trial_expired',
                'trips_used',
                'trips_limit',
                'can_create_trip',
                'available_plans',
            ]);
    }

    /** Status endpoint returns team member data when member_user_id is provided. */
    public function test_subscription_status_returns_team_member_data(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, true, 'monthly');
        $this->actingAs($admin);

        $this->getJson("/api/subscription/status?member_user_id={$memberUser->id}")
            ->assertOk()
            ->assertJsonFragment(['is_paid' => true])
            ->assertJsonStructure(['target_member' => ['id', 'user_id', 'name', 'email']]);
    }

    // =========================================================================
    // Paid plan — no trip limit
    // =========================================================================

    /** Paid admin is not restricted to 3 trips. */
    public function test_paid_admin_can_create_more_than_three_trips(): void
    {
        $admin = $this->makeAdmin();
        SubscriptionService::upgradeUserToPlan($admin, 'monthly');
        $this->actingAs($admin);

        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/trips', ['tripId' => "PAID-{$i}", 'tripTitle' => "Paid Trip {$i}"])
                ->assertStatus(201);
        }
    }

    // =========================================================================
    // SubscriptionService unit tests
    // =========================================================================

    /** canLogin returns false for inactive team member. */
    public function test_service_blocks_inactive_team_member(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser, $team] = $this->makeMember($admin, true, 'monthly');
        $team->update(['is_active' => false]);

        $result = SubscriptionService::canLogin($memberUser);

        $this->assertFalse($result['allowed']);
    }

    /** canLogin returns false for member with expired subscription. */
    public function test_service_blocks_expired_team_subscription(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, true, 'monthly');
        $memberUser->subscription->update(['ends_at' => Carbon::now()->subDay()]);

        $result = SubscriptionService::canLogin($memberUser);

        $this->assertFalse($result['allowed']);
    }

    /** canLogin returns true for member with valid active subscription. */
    public function test_service_allows_valid_paid_team_member(): void
    {
        $admin = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin, true, 'monthly');

        $result = SubscriptionService::canLogin($memberUser);

        $this->assertTrue($result['allowed']);
    }

    /** canLogin always returns true for admins regardless of subscription state. */
    public function test_service_always_allows_admin_login(): void
    {
        $admin = $this->makeAdmin();

        $result = SubscriptionService::canLogin($admin);

        $this->assertTrue($result['allowed']);
    }

    /** Trial admin is blocked from adding team members. */
    public function test_trial_admin_cannot_add_team_members(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);

        $this->postJson('/api/teams', [
            'name'     => 'New Member',
            'email'    => 'member@example.com',
            'password' => 'password123',
        ])->assertStatus(403);
    }

    /** Paid admin can add team members. */
    public function test_paid_admin_can_add_team_members(): void
    {
        $admin = $this->makeAdmin();
        SubscriptionService::upgradeUserToPlan($admin, 'monthly');
        $this->actingAs($admin);

        $this->postJson('/api/teams', [
            'name'     => 'New Member',
            'email'    => 'member@example.com',
            'password' => 'password123',
        ])->assertStatus(201);
    }

    /** Admin cannot assign a plan to a member from a different team. */
    public function test_admin_cannot_upgrade_another_admins_member(): void
    {
        $admin1 = $this->makeAdmin();
        $admin2 = $this->makeAdmin();
        [$memberUser] = $this->makeMember($admin2, false);

        $this->actingAs($admin1);

        $this->postJson('/api/subscription/upgrade', [
            'plan'           => 'monthly',
            'member_user_id' => $memberUser->id,
        ])->assertStatus(404);
    }
}
