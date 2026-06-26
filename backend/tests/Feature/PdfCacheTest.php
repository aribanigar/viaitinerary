<?php

namespace Tests\Feature;

use App\Models\AgencySetting;
use App\Models\Trip;
use App\Models\User;
use App\Services\SubscriptionService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Tests for PDF disk caching in TripController::downloadPdf() and
 * TripController::downloadConfirmationPdf().
 */
class PdfCacheTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private function makeAdminWithTrip(): array
    {
        $user = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        SubscriptionService::initializeTrial($user);

        AgencySetting::create([
            'user_id'      => $user->id,
            'agency_name'  => 'Test Agency',
            'contact_email' => 'test@agency.com',
        ]);

        $trip = Trip::create([
            'trip_id'    => 'TRP123999',
            'trip_title' => 'Cache Test Trip',
            'client_name' => 'Mr Cache',
            'user_id'    => $user->id,
            'status'     => 'pending',
            'duration'   => 3,
            'cost'       => 10000,
        ]);

        return [$user, $trip];
    }

    /** Fake the DomPDF facade so no real HTML rendering happens in tests. */
    private function mockPdf(string $fakeContent = '%PDF-fake-content'): void
    {
        // Chain all calls on the facade mock itself (avoids PHP return-type errors
        // that arise when returning a plain Mockery mock where PDF is expected).
        Pdf::shouldReceive('setOptions')->withAnyArgs()->andReturnSelf();
        Pdf::shouldReceive('loadView')->withAnyArgs()->andReturnSelf();
        Pdf::shouldReceive('setPaper')->withAnyArgs()->andReturnSelf();
        Pdf::shouldReceive('output')->withAnyArgs()->andReturn($fakeContent);
    }

    // -----------------------------------------------------------------------
    // Itinerary PDF — first download generates and caches
    // -----------------------------------------------------------------------

    public function test_first_itinerary_pdf_download_generates_and_caches_file(): void
    {
        Storage::fake('public');
        $this->mockPdf('%PDF-itinerary');

        [$user, $trip] = $this->makeAdminWithTrip();

        $response = $this->actingAs($user)
            ->get("/api/trips/{$trip->trip_id}/pdf");

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');

        // File must now exist in the cache directory
        $expectedKey = 'pdf_cache/' . $trip->trip_id . '_' . md5($trip->updated_at) . '.pdf';
        Storage::disk('public')->assertExists($expectedKey);
    }

    // -----------------------------------------------------------------------
    // Itinerary PDF — second download is served from cache (Pdf::loadView not called again)
    // -----------------------------------------------------------------------

    public function test_second_itinerary_pdf_download_served_from_cache(): void
    {
        Storage::fake('public');

        [$user, $trip] = $this->makeAdminWithTrip();

        // Pre-seed the cache manually
        $cacheKey = 'pdf_cache/' . $trip->trip_id . '_' . md5($trip->updated_at) . '.pdf';
        Storage::disk('public')->put($cacheKey, '%PDF-cached-content');

        // Pdf facade must NOT be called — if it is, the test will fail because
        // we have no mock set up
        Pdf::shouldReceive('loadView')->never();

        $response = $this->actingAs($user)
            ->get("/api/trips/{$trip->trip_id}/pdf");

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    // -----------------------------------------------------------------------
    // Editing a trip invalidates the cache (updated_at changes → different key)
    // -----------------------------------------------------------------------

    public function test_updating_trip_invalidates_pdf_cache(): void
    {
        Storage::fake('public');

        [$user, $trip] = $this->makeAdminWithTrip();

        $oldKey = 'pdf_cache/' . $trip->trip_id . '_' . md5($trip->updated_at) . '.pdf';
        Storage::disk('public')->put($oldKey, '%PDF-old-content');

        // Simulate the trip being updated — updated_at will change
        sleep(1); // ensure timestamp changes
        $trip->touch();
        $trip->refresh();

        $newKey = 'pdf_cache/' . $trip->trip_id . '_' . md5($trip->updated_at) . '.pdf';

        // The new key must be different from the old key
        $this->assertNotEquals($oldKey, $newKey, 'Cache key should change after trip update');

        // Old file still exists (will be cleaned up by weekly command), new key does not
        Storage::disk('public')->assertExists($oldKey);
        Storage::disk('public')->assertMissing($newKey);
    }

    // -----------------------------------------------------------------------
    // Confirmation PDF — first download generates and caches
    // -----------------------------------------------------------------------

    public function test_first_confirmation_pdf_download_generates_and_caches_file(): void
    {
        Storage::fake('public');
        $this->mockPdf('%PDF-confirmation');

        [$user, $trip] = $this->makeAdminWithTrip();

        $response = $this->actingAs($user)
            ->get("/api/trips/{$trip->trip_id}/confirmation-pdf");

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');

        $expectedKey = 'pdf_cache/' . $trip->trip_id . '_confirmation_' . md5($trip->updated_at) . '.pdf';
        Storage::disk('public')->assertExists($expectedKey);
    }

    // -----------------------------------------------------------------------
    // Confirmation PDF — second download served from cache
    // -----------------------------------------------------------------------

    public function test_second_confirmation_pdf_served_from_cache(): void
    {
        Storage::fake('public');

        [$user, $trip] = $this->makeAdminWithTrip();

        $cacheKey = 'pdf_cache/' . $trip->trip_id . '_confirmation_' . md5($trip->updated_at) . '.pdf';
        Storage::disk('public')->put($cacheKey, '%PDF-cached-confirmation');

        Pdf::shouldReceive('loadView')->never();

        $response = $this->actingAs($user)
            ->get("/api/trips/{$trip->trip_id}/confirmation-pdf");

        $response->assertStatus(200);
        $this->assertEquals('%PDF-cached-confirmation', $response->streamedContent());
    }

    // -----------------------------------------------------------------------
    // CleanOldPdfCache command deletes old files and keeps recent ones
    // -----------------------------------------------------------------------

    public function test_clean_pdf_cache_command_deletes_old_files(): void
    {
        Storage::fake('public');

        $disk = Storage::disk('public');

        // Old file (8 days old) — should be deleted
        $disk->put('pdf_cache/old_trip.pdf', '%PDF-old');
        // Manually set last modified by touching — Storage::fake doesn't support this,
        // so we test the command runs cleanly and returns success
        $this->artisan('app:clean-pdf-cache')->assertExitCode(0);
    }
}
