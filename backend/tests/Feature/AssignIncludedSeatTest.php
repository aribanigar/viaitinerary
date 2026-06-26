<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Team;
use App\Models\Plan;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AssignIncludedSeatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed plans or create a test plan
        Plan::create([
            'key' => 'monthly_test',
            'name' => 'Monthly Test',
            'price' => 100,
            'duration_months' => 1,
            'trip_limit' => 100,
            'is_active' => true,
            'team_member_limit' => 2, // includes 2 seats for testing
        ]);
    }

    public function test_admin_can_assign_included_seat_to_pending_member()
    {
        $admin = User::factory()->create(['role' => 'admin']);

        // Give admin a paid subscription to the test plan
        SubscriptionService::upgradeUserToPlan($admin, 'monthly_test');

        // Create a pending team member
        $memberUser = User::factory()->create(['role' => 'team']);
        $team = Team::create(['user_id' => $memberUser->id, 'created_by' => $admin->id, 'slug' => 't1-' . $memberUser->id, 'is_active' => true]);
        $memberUser->subscription()->create(['plan_key' => null, 'status' => 'pending', 'trips_used' => 0]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/subscription/assign-member', ['member_user_id' => $memberUser->id])
            ->assertStatus(200)
            ->assertJson(['message' => 'Seat assigned successfully.']);

        $memberUser->refresh();
        $this->assertEquals('active', $memberUser->subscription->status);
        $this->assertEquals('monthly_test', $memberUser->subscription->plan_key);
    }

    public function test_cannot_assign_if_no_seats_available()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        SubscriptionService::upgradeUserToPlan($admin, 'monthly_test');

        // Create two paid members to exhaust seats (limit = 2)
        for ($i = 0; $i < 2; $i++) {
            $u = User::factory()->create(['role' => 'team']);
            Team::create(['user_id' => $u->id, 'created_by' => $admin->id, 'slug' => 't_bulk_' . $u->id, 'is_active' => true]);
            SubscriptionService::upgradeUserToPlan($u, 'monthly_test');
        }

        // Now create a pending member
        $pending = User::factory()->create(['role' => 'team']);
        Team::create(['user_id' => $pending->id, 'created_by' => $admin->id, 'slug' => 't_pending_' . $pending->id, 'is_active' => true]);
        $pending->subscription()->create(['plan_key' => null, 'status' => 'pending', 'trips_used' => 0]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/subscription/assign-member', ['member_user_id' => $pending->id])
            ->assertStatus(400)
            ->assertJson(['message' => 'No included seats available.']);
    }

    public function test_non_admin_cannot_assign()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        SubscriptionService::upgradeUserToPlan($admin, 'monthly_test');

        $member = User::factory()->create(['role' => 'team']);
        Team::create(['user_id' => $member->id, 'created_by' => $admin->id, 'slug' => 't_member_' . $member->id, 'is_active' => true]);
        $member->subscription()->create(['plan_key' => null, 'status' => 'pending', 'trips_used' => 0]);

        $other = User::factory()->create(['role' => 'team']);

        $this->actingAs($other, 'sanctum')
            ->postJson('/api/subscription/assign-member', ['member_user_id' => $member->id])
            ->assertStatus(403);
    }

    public function test_idempotent_assignment_returns_ok_for_already_assigned()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        SubscriptionService::upgradeUserToPlan($admin, 'monthly_test');

        $member = User::factory()->create(['role' => 'team']);
        Team::create(['user_id' => $member->id, 'created_by' => $admin->id, 'slug' => 't_member_' . $member->id, 'is_active' => true]);
        SubscriptionService::assignIncludedSeat($admin, $member);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/subscription/assign-member', ['member_user_id' => $member->id])
            ->assertStatus(200)
            ->assertJson(['message' => 'Seat assigned successfully.']);
    }
}
