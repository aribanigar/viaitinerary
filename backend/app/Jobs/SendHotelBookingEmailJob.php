<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

use App\Models\Accommodation;
use App\Models\AgencySetting;
use App\Mail\HotelBookingNotificationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Support\AgencyMailer;

class SendHotelBookingEmailJob implements ShouldQueue
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
        public int $accommodationId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $accommodation = Accommodation::with(['hotel', 'trip'])->find($this->accommodationId);

        if (!$accommodation || !$accommodation->hotel || !$accommodation->hotel->email) {
            Log::warning("Skipping hotel email: Accommodation or hotel email missing for ID: {$this->accommodationId}");
            return;
        }

        $trip = $accommodation->trip;
        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);

        Mail::mailer($mailer)->to($accommodation->hotel->email)->send(
            new HotelBookingNotificationMail($trip, $accommodation, $agencySettings, $fromEmail, $fromName)
        );

        Log::info("Hotel booking email sent to {$accommodation->hotel->email} for Trip: {$trip->trip_id}");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("SendHotelBookingEmailJob failed for accommodation ID {$this->accommodationId}: " . $exception->getMessage());
    }
}
