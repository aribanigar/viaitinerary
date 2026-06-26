<?php

namespace App\Jobs;

use App\Mail\BookingConfirmationMail;
use App\Models\AgencySetting;
use App\Models\Trip;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Support\AgencyMailer;

class SendBookingConfirmationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * Timeout in seconds — PDF generation can be slow.
     */
    public int $timeout = 120;

    public function __construct(
        public readonly int     $tripId,
        public readonly string  $recipientEmail,
        public readonly string  $agencyName,
        public readonly string  $confirmationMessage,
        public readonly ?string $confirmationPdfMessage = null,
        public readonly ?string $whatsappMessage = null
    ) {}

    public function handle(): void
    {
        $trip = Trip::with(['itineraries', 'accommodations', 'transportations'])->findOrFail($this->tripId);
        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        $logoBase64       = $this->toBase64($agencySettings?->logo_path);
        $tripImageBase64  = $this->toBase64($trip->image_path ?? null);
        $heroImageBase64  = $this->toBase64($agencySettings?->confirmation_hero_image);

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])
            ->loadView('pdf.confirmation', [
                'trip'                => $trip,
                'agencySettings'      => $agencySettings,
                'logoBase64'          => $logoBase64,
                'tripImageBase64'     => $tripImageBase64,
                'heroImageBase64'     => $heroImageBase64,
                'confirmationMessage' => $this->confirmationPdfMessage ?? $this->confirmationMessage,
            ]);

        $pdfContent = $pdf->output();

        [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);

        Mail::mailer($mailer)->to($this->recipientEmail)->send(new BookingConfirmationMail(
            $trip,
            $pdfContent,
            $this->agencyName,
            $agencySettings,
            $logoBase64,
            $tripImageBase64,
            $heroImageBase64,
            $this->whatsappMessage ?? $this->confirmationMessage,
            $fromEmail,
            $fromName
        ));

        Log::info("Booking confirmation email sent for trip {$trip->trip_id} to {$this->recipientEmail}");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("SendBookingConfirmationJob failed for trip ID {$this->tripId}: " . $exception->getMessage());
    }

    private function toBase64(?string $imagePath): ?string
    {
        if (!$imagePath) {
            return null;
        }

        if (str_starts_with($imagePath, 'http')) {
            return $imagePath;
        }

        $fullPath = storage_path('app/public/' . $imagePath);

        if (!file_exists($fullPath)) {
            Log::warning("Image not found for PDF: {$fullPath}");
            return null;
        }

        $data = @file_get_contents($fullPath);

        if ($data === false) {
            Log::warning("Could not read image for PDF: {$fullPath}");
            return null;
        }

        $type = pathinfo($fullPath, PATHINFO_EXTENSION);
        return 'data:image/' . $type . ';base64,' . base64_encode($data);
    }
}
