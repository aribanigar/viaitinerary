<?php

namespace App\Jobs;

use App\Mail\PaymentReceiptMail;
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

class SendPaymentVoucherJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        public readonly int $tripId,
        public readonly float $paymentAmount,
        public readonly string $recipientEmail,
        public readonly string $agencyName
    ) {}

    public function handle(): void
    {
        $trip = Trip::findOrFail($this->tripId);
        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        // Prepare context for the receipt PDF
        $logoBase64 = $this->toBase64($agencySettings?->logo_path);

        // Load receipt template (assuming pdf.receipt exists or we use pdf.confirmation with different params)
        // For now using a common receipt view or confirmation view
        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])
            ->loadView('pdf.receipt', [
                'trip' => $trip,
                'payments' => $trip->payments()->orderBy('payment_date', 'desc')->get(),
                'paymentAmount' => $this->paymentAmount,
                'agencySettings' => $agencySettings,
                'logoBase64' => $logoBase64,
                'date' => now()->format('d M Y'),
            ]);

        $pdfContent = $pdf->output();

        [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);

        Mail::mailer($mailer)->to($this->recipientEmail)->send(new PaymentReceiptMail(
            $trip,
            $pdfContent,
            $this->agencyName,
            $this->paymentAmount,
            $fromEmail,
            $fromName
        ));

        Log::info("Payment voucher sent for trip {$trip->trip_id} to {$this->recipientEmail}");
    }

    private function toBase64(?string $imagePath): ?string
    {
        if (!$imagePath) return null;
        if (str_starts_with($imagePath, 'http')) return $imagePath;

        $fullPath = storage_path('app/public/' . $imagePath);
        if (!file_exists($fullPath)) return null;

        $data = @file_get_contents($fullPath);
        if ($data === false) return null;

        $base64 = base64_encode($data);
        $mime = mime_content_type($fullPath);
        return "data:$mime;base64,$base64";
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("SendPaymentVoucherJob failed for trip ID {$this->tripId}: " . $exception->getMessage());
    }
}
