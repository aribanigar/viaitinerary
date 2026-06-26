<?php

namespace Tests\Feature;

use App\Models\AgencySetting;
use App\Models\Team;
use App\Models\Trip;
use App\Models\User;
use App\Notifications\ItineraryFollowUpNotification;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Tests for app:process-trip-follow-ups command and the cleaned-up
 * NotificationController (now a pure read endpoint).
 */
class TripFollowUpCommandTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        SubscriptionService::initializeTrial($admin);
        AgencySetting::create(['user_id' => $admin->id, 'agency_name' => 'Test Agency']);
        return $admin;
    }

    private function makeTrip(User $admin, array $overrides = []): Trip
    {
        return Trip::create(array_merge([
            'trip_id'      => 'TRP' . rand(100000, 999999),
            'trip_title'   => 'Test Trip',
            'client_name'  => 'Test Client',
            'user_id'      => $admin->id,
            'status'       => 'pending',
            'duration'     => 3,
            'cost'         => 5000,
            'follow_up_sent' => false,
        ], $overrides));
    }

    // -----------------------------------------------------------------------
    // 1. Command sends notification to admin for their own trips > 24h old
    // -----------------------------------------------------------------------

    public function test_command_notifies_admin_for_old_unnotified_trip(): void
    {
        Notification::fake();

        $admin = $this->makeAdmin();
        $trip  = $this->makeTrip($admin, ['created_at' => Carbon::now()->subHours(25)]);

        $this->artisan('app:process-trip-follow-ups')->assertExitCode(0);

        Notification::assertSentTo($admin, ItineraryFollowUpNotification::class);
    }

    // -----------------------------------------------------------------------
    // 2. Command marks processed trips as follow_up_sent = true (single bulk UPDATE)
    // -----------------------------------------------------------------------

    public function test_command_marks_trips_as_notified(): void
    {
        Notification::fake();

        $admin = $this->makeAdmin();
        $trip  = $this->makeTrip($admin, ['created_at' => Carbon::now()->subHours(25)]);

        $this->artisan('app:process-trip-follow-ups');

        $this->assertDatabaseHas('trips', [
            'id'              => $trip->id,
            'follow_up_sent'  => true,
        ]);
    }

    // -----------------------------------------------------------------------
    // 3. Command does NOT notify for trips less than 24 hours old
    // -----------------------------------------------------------------------

    public function test_command_skips_trips_younger_than_24_hours(): void
    {
        Notification::fake();

        $admin = $this->makeAdmin();
        $this->makeTrip($admin, ['created_at' => Carbon::now()->subHours(20)]);

        $this->artisan('app:process-trip-follow-ups')->assertExitCode(0);

        Notification::assertNothingSent();
    }

    // -----------------------------------------------------------------------
    // 4. Command does NOT re-notify trips already marked follow_up_sent = true
    // -----------------------------------------------------------------------

    public function test_command_skips_already_notified_trips(): void
    {
        Notification::fake();

        $admin = $this->makeAdmin();
        $this->makeTrip($admin, [
            'created_at'     => Carbon::now()->subHours(30),
            'follow_up_sent' => true,
        ]);

        $this->artisan('app:process-trip-follow-ups')->assertExitCode(0);

        Notification::assertNothingSent();
    }

    // -----------------------------------------------------------------------
    // 5. Team trip: notification goes to the TEAM MEMBER, not the admin
    // -----------------------------------------------------------------------

    public function test_command_notifies_team_member_for_their_trip(): void
    {
        Notification::fake();

        $admin      = $this->makeAdmin();
        $memberUser = User::factory()->create(['role' => 'team', 'status' => 'active']);
        SubscriptionService::upgradeUserToPlan($memberUser, 'monthly');

        $team = Team::create([
            'user_id'    => $memberUser->id,
            'created_by' => $admin->id,
            'is_active'  => true,
        ]);

        // Trip linked to the team (created by member), user_id = admin, team_id = team
        $this->makeTrip($admin, [
            'team_id'    => $team->id,
            'created_at' => Carbon::now()->subHours(26),
        ]);

        $this->artisan('app:process-trip-follow-ups');

        // Team member receives the notification
        Notification::assertSentTo($memberUser, ItineraryFollowUpNotification::class);

        // Admin does NOT receive it (it was a team member's trip)
        Notification::assertNotSentTo($admin, ItineraryFollowUpNotification::class);
    }

    // -----------------------------------------------------------------------
    // 6. NotificationController::index is now a pure read — no DB writes
    // -----------------------------------------------------------------------

    public function test_notifications_endpoint_does_not_send_notifications(): void
    {
        Notification::fake();

        $admin = $this->makeAdmin();
        // Old unnotified trip — should NOT be processed by the endpoint anymore
        $this->makeTrip($admin, ['created_at' => Carbon::now()->subHours(30)]);

        $this->actingAs($admin)->getJson('/api/notifications');

        Notification::assertNothingSent();
    }

    public function test_notifications_endpoint_returns_correct_structure(): void
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin)->getJson('/api/notifications');

        $response->assertStatus(200);
        $response->assertJsonStructure(['notifications', 'unread_count']);
    }
}
