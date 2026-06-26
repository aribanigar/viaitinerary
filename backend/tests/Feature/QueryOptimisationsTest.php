<?php

namespace Tests\Feature;

use App\Models\AgencySetting;
use App\Models\Plan;
use App\Models\Team;
use App\Models\Trip;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Tests for query-count optimisations:
 *  - active_plans cache in SubscriptionController
 *  - blog_team_ids cache in BlogController
 *  - SuperAdminController::businesses() uses withCount (no N+1)
 */
class QueryOptimisationsTest extends TestCase
{
    use RefreshDatabase;

    private function makeSuperAdmin(): User
    {
        return User::factory()->create(['role' => 'super_admin', 'status' => 'active', 'bypass_subscription' => true]);
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        SubscriptionService::initializeTrial($admin);
        AgencySetting::create(['user_id' => $admin->id, 'agency_name' => 'Test Agency', 'contact_email' => 'a@b.com']);
        return $admin;
    }

    // -----------------------------------------------------------------------
    // 1. active_plans is cached after first subscription status call
    // -----------------------------------------------------------------------

    public function test_active_plans_are_cached_after_first_status_call(): void
    {
        Cache::flush();

        $admin = $this->makeAdmin();

        // Cache starts empty
        $this->assertNull(Cache::get('active_plans'));

        $this->actingAs($admin)->getJson('/api/subscription/status')->assertStatus(200);

        // Cache should now be populated
        $this->assertNotNull(Cache::get('active_plans'));
    }

    public function test_second_subscription_status_call_uses_cache_not_db(): void
    {
        Cache::flush();

        $admin = $this->makeAdmin();

        // Warm the cache
        $this->actingAs($admin)->getJson('/api/subscription/status');

        // Count queries on second call — Plan::get() should NOT fire
        DB::enableQueryLog();
        $this->actingAs($admin)->getJson('/api/subscription/status')->assertStatus(200);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $planQueries = array_filter($queries, fn($q) => str_contains($q['query'], 'plans'));
        $this->assertEmpty($planQueries, 'Plans table should not be queried when cache is warm');
    }

    // -----------------------------------------------------------------------
    // 2. blog_team_ids is cached after first BlogController call
    // -----------------------------------------------------------------------

    public function test_blog_team_ids_are_cached_after_first_blog_call(): void
    {
        Cache::flush();

        // Create a super_admin + agency team so the blog endpoint has something to look up
        $superAdmin = $this->makeSuperAdmin();
        Team::create(['user_id' => $superAdmin->id, 'created_by' => $superAdmin->id, 'slug' => 'agency', 'is_active' => true]);

        $this->assertNull(Cache::get('blog_team_ids'));

        $this->getJson('/api/blog/posts')->assertStatus(200);

        $this->assertNotNull(Cache::get('blog_team_ids'));
    }

    public function test_second_blog_call_does_not_query_super_admin_or_teams_table(): void
    {
        Cache::flush();

        $superAdmin = $this->makeSuperAdmin();
        Team::create(['user_id' => $superAdmin->id, 'created_by' => $superAdmin->id, 'slug' => 'agency', 'is_active' => true]);

        // Warm the cache
        $this->getJson('/api/blog/posts');

        // Second call — measure queries
        DB::enableQueryLog();
        $this->getJson('/api/blog/posts')->assertStatus(200);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Super_admin lookup and team slug lookup must not appear
        foreach ($queries as $q) {
            $this->assertStringNotContainsString("role = 'super_admin'", $q['query'], 'super_admin lookup should be cached');
            $this->assertStringNotContainsString("slug = 'agency'", $q['query'], 'team slug lookup should be cached');
        }
    }

    // -----------------------------------------------------------------------
    // 3. SuperAdminController::businesses() has no N+1 (withCount)
    // -----------------------------------------------------------------------

    public function test_businesses_endpoint_fires_constant_queries_regardless_of_admin_count(): void
    {
        $superAdmin = $this->makeSuperAdmin();

        // Create 5 admins with trips and team members
        for ($i = 0; $i < 5; $i++) {
            $admin = $this->makeAdmin();
            Trip::create([
                'trip_id'   => 'TRP' . rand(100000, 999999),
                'trip_title' => 'Trip ' . $i,
                'user_id'   => $admin->id,
                'status'    => 'pending',
                'duration'  => 1,
                'cost'      => 1000,
            ]);
        }

        DB::enableQueryLog();
        $this->actingAs($superAdmin)->getJson('/api/super-admin/businesses')->assertStatus(200);
        $queryCount5 = count(DB::getQueryLog());
        DB::disableQueryLog();

        // Add 5 more admins
        for ($i = 5; $i < 10; $i++) {
            $this->makeAdmin();
        }

        DB::enableQueryLog();
        $this->actingAs($superAdmin)->getJson('/api/super-admin/businesses')->assertStatus(200);
        $queryCount10 = count(DB::getQueryLog());
        DB::disableQueryLog();

        // Query count must be the same (or within 2) regardless of admin count
        $this->assertLessThanOrEqual(
            2,
            abs($queryCount10 - $queryCount5),
            "Expected constant query count, got {$queryCount5} queries for 5 admins and {$queryCount10} for 10 admins"
        );
    }

    public function test_businesses_endpoint_returns_correct_counts(): void
    {
        $superAdmin = $this->makeSuperAdmin();
        $admin      = $this->makeAdmin();

        // 2 trips for this admin
        for ($i = 0; $i < 2; $i++) {
            Trip::create([
                'trip_id'   => 'TRP' . rand(100000, 999999),
                'trip_title' => 'T' . $i,
                'user_id'   => $admin->id,
                'status'    => 'pending',
                'duration'  => 1,
                'cost'      => 100,
            ]);
        }

        // 1 team member for this admin
        $member = User::factory()->create(['role' => 'team', 'status' => 'active']);
        Team::create(['user_id' => $member->id, 'created_by' => $admin->id, 'is_active' => true]);

        $response = $this->actingAs($superAdmin)
            ->getJson('/api/super-admin/businesses')
            ->assertStatus(200);

        $business = collect($response->json())->firstWhere('id', $admin->id);

        $this->assertNotNull($business);
        $this->assertEquals(2, $business['trips_count']);
        $this->assertEquals(1, $business['team_members_count']);
    }
}
