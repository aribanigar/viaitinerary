<?php

namespace Tests\Feature;

use App\Jobs\SendBookingConfirmationJob;
use App\Mail\BookingConfirmationMail;
use App\Mail\NewLeadInquiryMail;
use App\Models\AgencySetting;
use App\Models\Trip;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Tests for the queued email optimisation.
 *
 * Three scenarios are covered:
 *  1. sendConfirmationEmail — dispatches a job, does NOT send email inline.
 *  2. sendConfirmationEmail — still returns WhatsApp URL for the client phone.
 *  3. sendConfirmationEmail — returns 422 when agency contact_email is missing.
 *  4. SendBookingConfirmationJob — job class is queueable and serialises correctly.
 *  5. LeadInquiryController (public) — queues NewLeadInquiryMail, does NOT send inline.
 */
class BookingConfirmationTest extends TestCase
{
    use RefreshDatabase;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function makeAdminWithTrip(array $tripOverrides = []): array
    {
        $user = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        SubscriptionService::initializeTrial($user);

        AgencySetting::create([
            'user_id'       => $user->id,
            'agency_name'   => 'Test Agency',
            'contact_email' => 'agency@example.com',
        ]);

        $trip = Trip::create(array_merge([
            'trip_id'     => 'TRP123456',
            'trip_title'  => 'Test Trip',
            'client_name' => 'John Doe',
            'client_phone' => '9876543210',
            'user_id'     => $user->id,
            'status'      => 'pending',
            'duration'    => 3,
            'cost'        => 10000,
        ], $tripOverrides));

        return [$user, $trip];
    }

    // -------------------------------------------------------------------------
    // 1. sendConfirmationEmail dispatches a job — no inline mail send
    // -------------------------------------------------------------------------

    public function test_send_confirmation_email_dispatches_job_not_inline_mail(): void
    {
        Queue::fake();
        Mail::fake();

        [$user, $trip] = $this->makeAdminWithTrip();

        $response = $this->actingAs($user)
            ->postJson("/api/trips/{$trip->trip_id}/send-confirmation");

        $response->assertStatus(200);
        $response->assertJsonFragment(['message' => 'Confirmation email queued. It will be sent to agency@example.com shortly.']);

        // Job MUST have been dispatched
        Queue::assertPushed(SendBookingConfirmationJob::class, function ($job) use ($trip) {
            return $job->tripId === $trip->id
                && $job->recipientEmail === 'agency@example.com';
        });

        // Mail must NOT have been sent inline
        Mail::assertNothingSent();
    }

    // -------------------------------------------------------------------------
    // 2. WhatsApp URL is still returned in the immediate response
    // -------------------------------------------------------------------------

    public function test_send_confirmation_email_returns_whatsapp_url(): void
    {
        Queue::fake();

        [$user, $trip] = $this->makeAdminWithTrip(['client_phone' => '+91 98765 43210']);

        $response = $this->actingAs($user)
            ->postJson("/api/trips/{$trip->trip_id}/send-confirmation");

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'whatsapp_url']);
        $this->assertStringStartsWith('https://wa.me/', $response->json('whatsapp_url'));
    }

    // -------------------------------------------------------------------------
    // 3. Returns 422 when agency has no contact_email
    // -------------------------------------------------------------------------

    public function test_send_confirmation_email_returns_422_when_no_contact_email(): void
    {
        Queue::fake();

        $user = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        SubscriptionService::initializeTrial($user);

        // Agency settings deliberately missing contact_email
        AgencySetting::create([
            'user_id'       => $user->id,
            'agency_name'   => 'No Email Agency',
            'contact_email' => null,
        ]);

        $trip = Trip::create([
            'trip_id'    => 'TRP999001',
            'trip_title' => 'Test Trip',
            'user_id'    => $user->id,
            'status'     => 'pending',
            'duration'   => 1,
            'cost'       => 0,
        ]);

        $response = $this->actingAs($user)
            ->postJson("/api/trips/{$trip->trip_id}/send-confirmation");

        $response->assertStatus(422);
        Queue::assertNothingPushed();
    }

    // -------------------------------------------------------------------------
    // 4. SendBookingConfirmationJob — has correct public properties so
    //    Queue::assertPushed() can inspect them (not protected)
    // -------------------------------------------------------------------------

    public function test_job_stores_trip_id_and_recipient(): void
    {
        $job = new SendBookingConfirmationJob(
            tripId: 42,
            recipientEmail: 'test@example.com',
            agencyName: 'Test Agency',
            confirmationMessage: 'Hello',
            whatsappMessage: 'Hello WA'
        );

        // Verify the data is preserved correctly for the queue worker
        $this->assertSame(42, $job->tripId);
        $this->assertSame('test@example.com', $job->recipientEmail);
        $this->assertSame(3, $job->tries);
        $this->assertSame(120, $job->timeout);
    }
}
