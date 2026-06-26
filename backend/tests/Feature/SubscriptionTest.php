<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Trip;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use App\Notifications\TrialExpiredUpgradeNotification;
use Tests\TestCase;
use Carbon\Carbon;

class SubscriptionTest extends TestCase
{
    use RefreshDatabase;

    /** Helper: create admin with fully initialized trial subscription. */
    private function makeTrialAdmin(): User
    {
        $user = User::factory()->create(['role' => 'admin']);
        SubscriptionService::initializeTrial($user);
        return $user;
    }

    public function test_trial_user_can_create_maximum_three_trips()
    {
        $user = $this->makeTrialAdmin();
        $this->actingAs($user);

        // First trip
        $response = $this->postJson('/api/trips', [
            'tripId' => 'TRP101',
            'tripTitle' => 'Test Trip 1',
        ]);
        $response->assertStatus(201);

        // Second
        $response = $this->postJson('/api/trips', [
            'tripId' => 'TRP102',
            'tripTitle' => 'Test Trip 2',
        ]);
        $response->assertStatus(201);

        // Third
        $response = $this->postJson('/api/trips', [
            'tripId' => 'TRP103',
            'tripTitle' => 'Test Trip 3',
        ]);
        $response->assertStatus(201);

        // Fourth - Should fail
        $response = $this->postJson('/api/trips', [
            'tripId' => 'TRP104',
            'tripTitle' => 'Test Trip 4',
        ]);
        $response->assertStatus(402);
        $response->assertJson(['message' => 'Trial limit reached. Upgrade to create more trips.']);
    }

    public function test_expired_trial_blocks_trip_creation()
    {
        $user = $this->makeTrialAdmin();
        $this->actingAs($user);

        // Expire the subscription
        $subscription = SubscriptionService::getSubscriptionForUser($user);
        $subscription->update([
            'trial_ends_at' => Carbon::now()->subMinute(),
        ]);

        $response = $this->postJson('/api/trips', [
            'tripId' => 'TRP201',
            'tripTitle' => 'Expired Trip',
        ]);
        $response->assertStatus(402);
        $response->assertJson(['message' => 'Trial has expired. Please upgrade.']);
    }

    public function test_subscription_status_endpoint()
    {
        $user = $this->makeTrialAdmin();
        $this->actingAs($user);

        $response = $this->getJson('/api/subscription/status');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'plan_name',
            'trial_ends_at',
            'is_trial_expired',
            'trips_used',
            'trips_limit',
            'can_create_trip',
            'available_plans',
        ]);
    }

    public function test_scheduler_notifies_expired_trials()
    {
        Notification::fake();

        $user = $this->makeTrialAdmin();
        $subscription = SubscriptionService::getSubscriptionForUser($user);
        $subscription->update([
            'trial_ends_at' => Carbon::now()->subMinute(),
        ]);

        $this->artisan('app:check-trial-expiries')
            ->expectsOutput('Checked and notified 1 tenants.')
            ->assertExitCode(0);

        Notification::assertSentTo($user, TrialExpiredUpgradeNotification::class);

        // Running again shouldn't notify
        $this->artisan('app:check-trial-expiries')
            ->expectsOutput('Checked and notified 0 tenants.')
            ->assertExitCode(0);
    }
}
