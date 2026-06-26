<?php

namespace App\Jobs;

use App\Models\Trip;
use App\Models\AgencySetting;
use App\Models\Policy;
use App\Services\SubscriptionService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class GenerateTripPdfJob implements ShouldQueue
{
    use Queueable;

    protected $trip;

    /**
     * Create a new job instance.
     */
    public function __construct(Trip $trip)
    {
        $this->trip = $trip;
    }

    /**
     * Execute the job.
     */
    public function handle()
    {
        $trip = $this->trip;
        $adminId = $trip->user_id;

        $tripOwner = \App\Models\User::find($adminId);
        $workspaceAdmin = $tripOwner;
        if ($tripOwner && $tripOwner->role === 'team') {
            $workspaceAdmin = \App\Models\User::find($tripOwner->getAdminId()) ?? $tripOwner;
        }

        $agencySettings = AgencySetting::where('user_id', $adminId)->first();
        $policies = Policy::where('user_id', $adminId)->first();

        // Load relations for PDF
        $trip->load(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref']);

        // Base64 logo for PDF
        $logoBase64 = null;
        if ($agencySettings && $agencySettings->logo_path) {
            $logoPath = storage_path('app/public/' . $agencySettings->logo_path);
            if (file_exists($logoPath)) {
                $logoData = file_get_contents($logoPath);
                $logoBase64 = 'data:image/' . pathinfo($logoPath, PATHINFO_EXTENSION) . ';base64,' . base64_encode($logoData);
            }
        }

        // Base64 watermark logo for trial users.
        // Fail-closed: if subscription cannot be verified, keep watermark ON.
        $watermarkBase64 = null;
        $shouldShowWatermark = true;
        $resolvedSub = null;

        if ($workspaceAdmin) {
            $resolvedSub = SubscriptionService::getSubscriptionForUser($workspaceAdmin);

            // Super-admin explicit bypass disables watermark.
            if ($workspaceAdmin->bypass_subscription) {
                $shouldShowWatermark = false;
            } elseif ($resolvedSub) {
                // Only clearly paid/non-trial plans remove watermark.
                $shouldShowWatermark = $resolvedSub->isTrial() || $resolvedSub->plan_key === 'trial';
            }

            // Checking multiple fallback paths for production (public_html, public, etc.)
            $pathsToTry = [
                public_path('logo-light.png'),
                base_path('../public_html/logo-light.png'),
                base_path('public/logo-light.png'),
                storage_path('app/public/logo-light.png')
            ];

            $finalWatermarkPath = null;
            foreach ($pathsToTry as $p) {
                if (file_exists($p)) {
                    $finalWatermarkPath = $p;
                    break;
                }
            }

            // Production Log: Checking subscription status for watermark
            \Illuminate\Support\Facades\Log::info("Watermark Debug - User: {$adminId}", [
                'workspace_admin_id' => $workspaceAdmin->id,
                'plan_key' => $resolvedSub?->plan_key,
                'status' => $resolvedSub?->status,
                'should_show_watermark' => $shouldShowWatermark,
                'bypass_subscription' => $workspaceAdmin->bypass_subscription,
                'path_found' => $finalWatermarkPath,
                'logo_exists' => !is_null($finalWatermarkPath)
            ]);
        } else {
            \Illuminate\Support\Facades\Log::warning("Watermark Debug - User: {$adminId} has NO resolvable workspace admin.");
        }

        if ($shouldShowWatermark && isset($finalWatermarkPath) && $finalWatermarkPath) {
            $watermarkData = file_get_contents($finalWatermarkPath);
            $watermarkBase64 = 'data:image/' . pathinfo($finalWatermarkPath, PATHINFO_EXTENSION) . ';base64,' . base64_encode($watermarkData);
        }

        // Base64 trip image
        $tripImageBase64 = null;
        if ($trip->image_path) {
            $tripPath = storage_path('app/public/' . $trip->image_path);
            if (file_exists($tripPath)) {
                $tripData = file_get_contents($tripPath);
                $tripImageBase64 = 'data:image/' . pathinfo($tripPath, PATHINFO_EXTENSION) . ';base64,' . base64_encode($tripData);
            }
        }

        // Base64 itinerary images
        foreach ($trip->itineraries as $itinerary) {
            if ($itinerary->image_path) {
                $path = storage_path('app/public/' . $itinerary->image_path);
                if (file_exists($path)) {
                    $data = file_get_contents($path);
                    $itinerary->image_base64 = 'data:image/' . pathinfo($path, PATHINFO_EXTENSION) . ';base64,' . base64_encode($data);
                }
            }
        }

        // Base64 hotel images
        foreach ($trip->accommodations as $accommodation) {
            // Fallback to hotel image if accommodation-specific image is missing
            $imagePath = $accommodation->image_path ?: ($accommodation->hotel ? $accommodation->hotel->image_path : null);

            if ($imagePath) {
                $path = storage_path('app/public/' . $imagePath);
                if (file_exists($path)) {
                    $data = file_get_contents($path);
                    $accommodation->image_base64 = 'data:image/' . pathinfo($path, PATHINFO_EXTENSION) . ';base64,' . base64_encode($data);
                }
            }
        }

        // Determine template
        $templateView = 'pdf.trip-modern';
        if ($trip->template === 'ClassicTemplate') {
            $templateView = 'pdf.trip-classic';
        }

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])
            ->loadView($templateView, [
                'trip' => $trip,
                'agencySettings' => $agencySettings,
                'logoBase64' => $logoBase64,
                'watermarkBase64' => $watermarkBase64,
                'tripImageBase64' => $tripImageBase64,
                'policies' => $policies,
            ]);

        return $pdf->output();
    }
}
