<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Trip;
use App\Models\Hotel;
use App\Models\Destination;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    /**
     * Test that an admin can only see their own trips.
     */
    public function test_admin_isolation_trips()
    {
        $admin1 = User::factory()->create(['role' => 'admin']);
        $admin2 = User::factory()->create(['role' => 'admin']);

        // Create trip for admin 1
        $trip1 = Trip::create([
            'trip_id' => 'TRP-ADM1',
            'trip_title' => 'Admin 1 Trip',
            'user_id' => $admin1->id,
            'client_name' => 'Client 1'
        ]);

        // Create trip for admin 2
        $trip2 = Trip::create([
            'trip_id' => 'TRP-ADM2',
            'trip_title' => 'Admin 2 Trip',
            'user_id' => $admin2->id,
            'client_name' => 'Client 2'
        ]);

        // Acting as admin 1
        $this->actingAs($admin1);
        $this->assertEquals(1, Trip::count());
        $this->assertEquals('TRP-ADM1', Trip::first()->trip_id);

        // Acting as admin 2
        $this->actingAs($admin2);
        $this->assertEquals(1, Trip::count());
        $this->assertEquals('TRP-ADM2', Trip::first()->trip_id);
    }

    /**
     * Test that global scope applies to other models as well.
     */
    public function test_admin_isolation_hotels_and_destinations()
    {
        $admin1 = User::factory()->create(['role' => 'admin']);
        $admin2 = User::factory()->create(['role' => 'admin']);

        Hotel::create(['name' => 'Hotel 1', 'user_id' => $admin1->id, 'city' => 'City 1', 'rating' => 5]);
        Hotel::create(['name' => 'Hotel 2', 'user_id' => $admin2->id, 'city' => 'City 2', 'rating' => 4]);

        Destination::create(['name' => 'Dest 1', 'user_id' => $admin1->id, 'description' => 'Desc 1']);
        Destination::create(['name' => 'Dest 2', 'user_id' => $admin2->id, 'description' => 'Desc 2']);

        $this->actingAs($admin1);
        $this->assertEquals(1, Hotel::count());
        $this->assertEquals(1, Destination::count());

        $this->actingAs($admin2);
        $this->assertEquals(1, Hotel::count());
        $this->assertEquals(1, Destination::count());
    }

    /**
     * Test that 'creating' hook automatically sets user_id.
     */
    public function test_automatic_user_id_assignment()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin);

        $trip = Trip::create([
            'trip_id' => 'TRP-AUTO',
            'trip_title' => 'Auto ID Trip',
            'client_name' => 'Auto Client'
        ]);

        $this->assertEquals($admin->id, $trip->user_id);
    }

    /**
     * Test Rate Limiting for OTP.
     */
    public function test_otp_rate_limiting()
    {
        $admin = User::factory()->create(['role' => 'admin', 'email' => 'test@example.com']);

        // First 3 should pass (assuming 3 per minute as configured)
        for ($i = 0; $i < 3; $i++) {
            $response = $this->postJson('/api/otp/send', ['email' => 'test@example.com']);
            // We don't care about the actual result of sending (which might fail due to lack of mailer), 
            // but it shouldn't be 429
            $this->assertNotEquals(429, $response->status());
        }

        // 4th should be throttled
        $response = $this->postJson('/api/otp/send', ['email' => 'test@example.com']);
        $response->assertStatus(429);
    }
}
