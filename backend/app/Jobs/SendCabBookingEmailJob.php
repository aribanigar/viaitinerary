<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

use App\Models\Transportation;
use App\Models\AgencySetting;
use App\Mail\CabBookingNotificationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Support\AgencyMailer;

class SendCabBookingEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * Timeout in seconds.
     */
    public int $timeout = 120;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $transportationId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $transportation = Transportation::with(['vehicle', 'trip'])->find($this->transportationId);

        if (!$transportation || !$transportation->vehicle || !$transportation->vehicle->email) {
            Log::warning("Skipping cab email: Transportation or vehicle email missing for ID: {$this->transportationId}");
            return;
        }

        $trip = $transportation->trip;
        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);

        Mail::mailer($mailer)->to($transportation->vehicle->email)->send(
            new CabBookingNotificationMail($trip, $transportation, $agencySettings, $fromEmail, $fromName)
        );

        Log::info("Cab booking email sent to {$transportation->vehicle->email} for Trip: {$trip->trip_id}");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("SendCabBookingEmailJob failed for transportation ID {$this->transportationId}: " . $exception->getMessage());
    }
}
