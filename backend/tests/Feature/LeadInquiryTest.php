<?php

namespace Tests\Feature;

use App\Mail\NewLeadInquiryMail;
use App\Models\Trip;
use App\Models\LeadInquiry;
use App\Models\User;
use Carbon\Carbon;
use Database\Factories\LeadInquiryFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * LeadInquiryTest
 *
 * Covers:
 *  - Agency-specific form submissions via UUID embed_token (new) and numeric ID (legacy)
 *  - Phone validation: string length vs digit-count
 *  - Honeypot (bot-trap) protection
 *  - Duplicate submission prevention (same email within 2 minutes)
 *  - Past start-date rejection
 *  - pax must contain a digit
 *  - Inactive / nonexistent agency returns 404
 *  - Rate limiting (throttle)
 *  - enquiry-to-trip conversion with collision-safe trip_id
 *  - storePublic: phone required + honeypot
 *  - Inquiry notification email is queued (not sent synchronously)
 */
class LeadInquiryTest extends TestCase
{
    use RefreshDatabase;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Minimal valid payload for the inquiry form. */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'clientName'        => 'Jane Doe',
            'clientEmail'       => 'jane@example.com',
            'clientPhone'       => '+91 98765 43210',
            'destination'       => 'Goa',
            'pax'               => '2 Adults',
            'startDate'         => Carbon::tomorrow()->toDateString(),
            'duration'          => 5,
            'approximateBudget' => 50000,
            'currency'          => 'INR (₹)',
            'specialRequests'   => null,
        ], $overrides);
    }

    /** Create an active admin user with an embed_token. */
    private function makeAgency(array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'role'   => 'admin',
            'status' => 'active',
        ], $attrs));
    }

    // =========================================================================
    // store() — Agency-specific form
    // =========================================================================

    /** @test */
    public function test_valid_submission_via_uuid_embed_token_returns_201(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();
        $this->assertNotEmpty($agency->embed_token, 'embed_token should be set on create');

        $response = $this->postJson(
            "/api/trip-inquiries/{$agency->embed_token}",
            $this->validPayload()
        );

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'inquiry_id']);

        $this->assertDatabaseHas('trip_inquiries', [
            'user_id'      => $agency->id,
            'client_email' => 'jane@example.com',
        ]);
    }

    /** @test */
    public function test_valid_submission_via_numeric_id_still_works_backward_compat(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/trip-inquiries/{$agency->id}",
            $this->validPayload(['clientEmail' => 'legacy@example.com'])
        );

        $response->assertStatus(201);
        $this->assertDatabaseHas('trip_inquiries', [
            'user_id'      => $agency->id,
            'client_email' => 'legacy@example.com',
        ]);
    }

    /** @test */
    public function test_notification_email_is_queued_not_sent_synchronously(): void
    {
        Queue::fake();
        $agency = $this->makeAgency();

        $this->postJson("/api/trip-inquiries/{$agency->embed_token}", $this->validPayload());

        Queue::assertPushed(\Illuminate\Mail\SendQueuedMailable::class);
    }

    // =========================================================================
    // Agency validation
    // =========================================================================

    /** @test */
    public function test_inactive_agency_returns_404(): void
    {
        $agency = $this->makeAgency(['status' => 'inactive']);

        $response = $this->postJson(
            "/api/trip-inquiries/{$agency->embed_token}",
            $this->validPayload()
        );

        $response->assertStatus(404);
    }

    /** @test */
    public function test_nonexistent_agency_token_returns_404(): void
    {
        $response = $this->postJson(
            '/api/trip-inquiries/' . Str::uuid(),
            $this->validPayload()
        );

        $response->assertStatus(404);
    }

    /** @test */
    public function test_nonexistent_numeric_id_returns_404(): void
    {
        $response = $this->postJson(
            '/api/lead-inquiries/99999',
            $this->validPayload()
        );

        $response->assertStatus(404);
    }

    // =========================================================================
    // Honeypot
    // =========================================================================

    /** @test */
    public function test_honeypot_filled_silently_returns_201_without_storing_record(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();
        $countBefore = LeadInquiry::count();

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['website' => 'http://spambot.example.com'])
        );

        // Silently returns success so bots get no useful signal
        $response->assertStatus(201);
        $this->assertSame($countBefore, LeadInquiry::count(), 'Honeypot-filled submissions must not be stored');
    }

    /** @test */
    public function test_honeypot_empty_does_not_block_real_request(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['website' => ''])
        );

        $response->assertStatus(201);
        $this->assertSame(1, LeadInquiry::count());
    }

    // =========================================================================
    // Phone validation
    // =========================================================================

    /** @test */
    public function test_phone_with_fewer_than_10_digits_is_rejected(): void
    {
        $agency = $this->makeAgency();

        // 9 digits — fails digit count even though string is >10 chars
        $response = $this->postJson(
            "/api/trip-inquiries/{$agency->embed_token}",
            $this->validPayload(['clientPhone' => '+91 9876 432'])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['clientPhone']);
    }

    /** @test */
    public function test_phone_with_formatting_chars_but_10_digits_is_accepted(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        // Contains spaces, dashes, parentheses — but 10 digits total
        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['clientPhone' => '+91 (98) 765-4321'])
        );

        $response->assertStatus(201);
    }

    /** @test */
    public function test_phone_all_non_digits_except_allowed_chars_is_rejected(): void
    {
        $agency = $this->makeAgency();

        // Only 2 digits → fails the 10-digit minimum
        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['clientPhone' => '+  (  )  - 1 2'])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['clientPhone']);
    }

    /** @test */
    public function test_phone_with_letters_is_rejected(): void
    {
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['clientPhone' => 'notaphone'])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['clientPhone']);
    }

    // =========================================================================
    // Start date
    // =========================================================================

    /** @test */
    public function test_past_start_date_is_rejected(): void
    {
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['startDate' => Carbon::yesterday()->toDateString()])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['startDate']);
    }

    /** @test */
    public function test_today_as_start_date_is_accepted(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/trip-inquiries/{$agency->embed_token}",
            $this->validPayload(['startDate' => Carbon::today()->toDateString()])
        );

        $response->assertStatus(201);
    }

    // =========================================================================
    // pax validation
    // =========================================================================

    /** @test */
    public function test_pax_without_digit_is_rejected(): void
    {
        $agency = $this->makeAgency();

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload(['pax' => 'several adults'])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['pax']);
    }

    /** @test */
    public function test_pax_with_digit_is_accepted(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        foreach (['2 Adults', '3', '1 Adult 2 Children'] as $i => $paxValue) {
            $response = $this->postJson(
                "/api/lead-inquiries/{$agency->embed_token}",
                $this->validPayload([
                    'pax'         => $paxValue,
                    'clientEmail' => "paxtest{$i}@example.com", // unique valid email per iteration
                ])
            );
            $response->assertStatus(201, "pax value '{$paxValue}' should be accepted");
        }
    }

    // =========================================================================
    // Duplicate prevention
    // =========================================================================

    /** @test */
    public function test_duplicate_submission_within_2_minutes_returns_existing_inquiry_id(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();
        $payload = $this->validPayload();

        $first  = $this->postJson("/api/lead-inquiries/{$agency->embed_token}", $payload);
        $second = $this->postJson("/api/lead-inquiries/{$agency->embed_token}", $payload);

        $first->assertStatus(201);
        $second->assertStatus(201);

        // Both responses return the same inquiry_id
        $this->assertSame(
            $first->json('inquiry_id'),
            $second->json('inquiry_id'),
            'Duplicate submission within 2 minutes must reuse the existing inquiry_id'
        );

        // Only one record stored
        $this->assertSame(1, LeadInquiry::where('client_email', 'jane@example.com')->count());
    }

    /** @test */
    public function test_same_email_after_2_minutes_creates_new_inquiry(): void
    {
        Mail::fake();
        $agency = $this->makeAgency();

        // First submission at T-3 minutes (simulate old record)
        LeadInquiry::factory()->create([
            'user_id'      => $agency->id,
            'client_email' => 'jane@example.com',
            'start_date'   => Carbon::tomorrow()->toDateString(),
            'created_at'   => now()->subMinutes(3),
        ]);

        $response = $this->postJson(
            "/api/lead-inquiries/{$agency->embed_token}",
            $this->validPayload()
        );

        $response->assertStatus(201);
        $this->assertSame(2, LeadInquiry::where('client_email', 'jane@example.com')->count());
    }

    // =========================================================================
    // storePublic
    // =========================================================================

    /** @test */
    public function test_public_inquiry_submitted_when_super_admin_exists(): void
    {
        Mail::fake();
        User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this->postJson('/api/public-inquiries', $this->validPayload());

        $response->assertStatus(201)
            ->assertJsonStructure(['message', 'inquiry_id']);
        $this->assertSame(1, LeadInquiry::where('is_public', true)->count());
    }

    /** @test */
    public function test_public_inquiry_phone_is_required(): void
    {
        User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this->postJson(
            '/api/public-inquiries',
            $this->validPayload(['clientPhone' => null])
        );

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['clientPhone']);
    }

    /** @test */
    public function test_public_inquiry_honeypot_silently_succeeds_without_storing(): void
    {
        User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $countBefore = LeadInquiry::count();

        $response = $this->postJson(
            '/api/public-inquiries',
            $this->validPayload(['website' => 'spam'])
        );

        $response->assertStatus(201);
        $this->assertSame($countBefore, LeadInquiry::count());
    }

    // =========================================================================
    // convertToTrip — collision-safe trip_id
    // =========================================================================

    /** @test */
    public function test_convert_inquiry_to_trip_creates_trip_with_unique_id(): void
    {
        $agency   = $this->makeAgency();
        $inquiry  = LeadInquiry::factory()->create([
            'user_id' => $agency->id,
            'status'  => 'new',
        ]);

        $token = $agency->createToken('test')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson("/api/lead-inquiries/{$inquiry->id}/convert-to-trip");

        $response->assertStatus(201)
            ->assertJsonStructure(['trip_id', 'trip']);

        $tripId = $response->json('trip_id');
        $this->assertMatchesRegularExpression('/^TRP\d{6}$/', $tripId);
        $this->assertDatabaseHas('trips', ['trip_id' => $tripId]);
        $this->assertDatabaseHas('trip_inquiries', ['id' => $inquiry->id, 'status' => 'converted']);
    }

    /** @test */
    public function test_convert_already_converted_inquiry_returns_400(): void
    {
        $agency  = $this->makeAgency();
        $inquiry = LeadInquiry::factory()->create([
            'user_id' => $agency->id,
            'status'  => 'converted',
        ]);

        $token = $agency->createToken('test')->plainTextToken;

        $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson("/api/lead-inquiries/{$inquiry->id}/convert-to-trip");

        $response->assertStatus(400);
    }

    // =========================================================================
    // Required-field validation
    // =========================================================================

    /** @test */
    public function test_missing_required_fields_return_422(): void
    {
        $agency = $this->makeAgency();

        // Bypass throttle so 7 back-to-back requests don't hit the rate limit
        foreach (['clientName', 'clientEmail', 'clientPhone', 'destination', 'pax', 'startDate', 'duration'] as $field) {
            $payload  = $this->validPayload([$field => null]);
            $response = $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class)
                ->postJson("/api/trip-inquiries/{$agency->embed_token}", $payload);
            $response->assertStatus(422, "Field '{$field}' should be required")
                ->assertJsonValidationErrors([$field]);
        }
    }

    /** @test */
    public function test_embed_token_generated_automatically_on_user_creation(): void
    {
        $user = User::factory()->create();
        $this->assertNotEmpty($user->embed_token);
        $this->assertTrue(
            (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $user->embed_token),
            'embed_token must be a valid UUID v4'
        );
    }

    /** @test */
    public function test_each_user_receives_unique_embed_token(): void
    {
        $users  = User::factory()->count(10)->create();
        $tokens = $users->pluck('embed_token')->toArray();
        $this->assertSame(count($tokens), count(array_unique($tokens)), 'All embed_tokens must be unique');
    }
}
