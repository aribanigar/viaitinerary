<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use App\Models\Payment;
use App\Models\AgencySetting;
use App\Models\Policy;
use App\Models\Destination;
use App\Models\Vehicle;
use App\Models\Hotel;
use App\Models\User;
use App\Services\SubscriptionService;
use App\Services\AccountingLedgerService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Jobs\SendBookingConfirmationJob;
use App\Mail\PaymentReceiptMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

use App\Jobs\SendPaymentVoucherJob;
use App\Jobs\SendHotelBookingEmailJob;
use App\Jobs\SendCabBookingEmailJob;
use App\Support\AgencyMailer;

class TripController extends Controller
{
    public function builderInit(Request $request)
    {
        $user = $request->user();
        $adminId = $user->getAdminId();

        $settings = AgencySetting::with('documentTemplate')->where('user_id', $adminId)->first();

        $destinations = Destination::where('user_id', $adminId)
            ->select('id', 'name', 'activities', 'image_path')
            ->get();
        $vehicles = Vehicle::where('user_id', $adminId)
            ->select('id', 'name', 'price')
            ->get();
        $hotels = Hotel::where('user_id', $adminId)
            ->select(
                'id',
                'name',
                'city',
                'price_sections',
                'image_path'
            )
            ->get();
        $policies = Policy::where('user_id', $adminId)->first();

        // Map policies to a flatter structure (handling array casts if necessary)
        $mappedPolicies = null;
        if ($policies) {
            $mappedPolicies = [
                'terms_conditions' => is_array($policies->terms_conditions) ? implode("\n", $policies->terms_conditions) : $policies->terms_conditions,
                'must_haves' => is_array($policies->must_haves) ? implode("\n", $policies->must_haves) : $policies->must_haves,
                'roles_responsibilities' => is_array($policies->roles_responsibilities) ? implode("\n", $policies->roles_responsibilities) : $policies->roles_responsibilities,
                'cancellation_policy' => is_array($policies->cancellation_policy) ? implode("\n", $policies->cancellation_policy) : $policies->cancellation_policy,
                'additional_expenses' => is_array($policies->additional_expenses) ? implode("\n", $policies->additional_expenses) : $policies->additional_expenses,
                'default_inclusions' => $policies->default_inclusions ?: [],
                'default_exclusions' => $policies->default_exclusions ?: [],
            ];
        }

        $resp = [
            'settings' => $settings,
            'destinations' => $destinations,
            'vehicles' => $vehicles,
            'hotels' => $hotels,
            'policies' => $mappedPolicies,
        ];

        // Optional: Get trip data if requested
        if ($request->has('trip_id')) {
            $tripData = Trip::with(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref'])
                ->where('trip_id', $request->trip_id)
                ->where('user_id', $adminId)
                ->first();
            $resp['trip'] = $tripData;
        }

        return response()->json($resp);
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $currentUserId = $user->id;

        // BelongsToAdmin global scope already handles user_id/team isolation.
        // We just need to join the creator info for the UI.
        $query = Trip::leftJoin('users as creators', 'trips.user_id', '=', 'creators.id')
            ->leftJoin('teams', 'trips.team_id', '=', 'teams.id')
            ->leftJoin('users as team_users', 'teams.user_id', '=', 'team_users.id')
            ->selectRaw('
            trips.id, 
            trips.trip_id, 
            trips.trip_title, 
            trips.client_name, 
            trips.client_phone,
            trips.start_date, 
            trips.duration, 
            trips.cost, 
            trips.paid_amount,
            trips.refunded_amount,
            trips.currency, 
            trips.image_path, 
            trips.status, 
            trips.updated_at,
            CASE 
                WHEN trips.team_id IS NOT NULL AND teams.user_id = ? THEN \'You\'
                WHEN trips.team_id IS NOT NULL THEN team_users.name
                WHEN trips.team_id IS NULL AND trips.user_id = ? THEN \'You\'
                ELSE creators.name
            END as created_by
        ', [$currentUserId, $currentUserId]);

        $search = $request->input('search');
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('trips.trip_title', 'like', "%{$search}%")
                    ->orWhere('trips.client_name', 'like', "%{$search}%")
                    ->orWhere('trips.trip_id', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 25);
        $trips = $query->latest('trips.created_at')->paginate($perPage);

        return response()->json($trips);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'tripId' => 'required|string|unique:trips,trip_id',
            'tripTitle' => 'required|string|max:255',
            'destination' => 'nullable|string|max:255',
            'destinationId' => 'nullable|exists:destinations,id',
            'clientName' => 'required|string|max:255',
            'clientPhone' => 'required|phone:AUTO',
            'clientEmail' => 'required|email|max:255',
            'adults' => 'nullable|integer|min:1',
            'kidsUpto5' => 'nullable|integer|min:0',
            'kids5to12' => 'nullable|integer|min:0',
            'startDate' => 'nullable|string',
            'duration' => 'nullable|integer|min:1',
            'cost' => 'nullable|numeric|min:0',
            'gst_amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string',
            'image' => 'nullable|string', // Base64
            'status' => 'nullable|string',
            'template' => 'nullable|string',
            'include_gst' => 'nullable|boolean',
            'use_flight' => 'nullable|boolean',
            'transport_details' => 'nullable|array',
            'inclusions' => 'nullable|array',
            'exclusions' => 'nullable|array',
            'other_costs' => 'nullable|array',
            'tagline' => 'nullable|string',
        ]);

        $adminId = $request->user()->getAdminId();

        // Note: trial / subscription enforcement is already handled by the
        // EnsureSubscriptionAllowsTripCreation middleware registered on this
        // route. The duplicate check that previously appeared here has been
        // removed to keep logic in one place (SubscriptionService).

        $trip = new Trip();
        $trip->user_id = $request->user()->getAdminId();
        $trip->team_id = $request->user()->getTeamId();
        $trip->trip_id = $validated['tripId'];
        $trip->trip_title = $validated['tripTitle'];
        $trip->destination = $validated['destination'] ?? null;
        $trip->destination_id = $validated['destinationId'] ?? null;
        $trip->client_name = $validated['clientName'] ?? null;
        $trip->client_phone = $validated['clientPhone'] ?? null;
        $trip->client_email = $validated['clientEmail'] ?? null;
        $trip->adults = $validated['adults'] ?? 2;
        $trip->kids_cnb = $validated['kidsUpto5'] ?? 0;
        $trip->kids_5_to_12 = $validated['kids5to12'] ?? 0;
        $trip->start_date = $this->formatDateForDatabase($validated['startDate'] ?? null);
        $trip->duration = $validated['duration'] ?? null;
        $trip->cost = $validated['cost'] ?? null;
        $trip->gst_amount = $validated['gst_amount'] ?? 0;
        $trip->currency = $validated['currency'] ?? 'INR (Rs)';
        $trip->template = $validated['template'] ?? 'ModernTemplate';
        $trip->status = $validated['status'] ?? 'pending';
        $trip->include_gst = $validated['include_gst'] ?? true;
        $trip->use_flight = $validated['use_flight'] ?? false;
        $trip->transport_details = $validated['transport_details'] ?? [];
        $trip->inclusions = $validated['inclusions'] ?? [];
        $trip->exclusions = $validated['exclusions'] ?? [];
        $trip->other_costs = $validated['other_costs'] ?? [];
        $trip->tagline = $validated['tagline'] ?? null;
        $trip->slug = Str::slug($validated['tripTitle'] . '-' . Str::random(6));

        // Handle Image Upload
        if ($request->filled('image')) {
            if (str_starts_with($request->image, 'data:image')) {
                $trip->image_path = $this->saveBase64Image($request->image, 'trips');
            } elseif (str_contains($request->image, '/api/storage/')) {
                // Extract path from URL
                $trip->image_path = substr($request->image, strpos($request->image, '/api/storage/') + 13);
            } else {
                $trip->image_path = $request->image;
            }
        } elseif ($request->has('image') && empty($request->image)) {
            $trip->image_path = null;
        }

        $trip->save();

        // Update trips_used counter on admin's subscription
        $admin = User::find($request->user()->getAdminId());
        if ($admin) {
            $subscription = SubscriptionService::getSubscriptionForUser($admin);
            if ($subscription) {
                $subscription->increment('trips_used');
            }
        }

        $this->syncRelations($trip, $request);

        try {
            app(AccountingLedgerService::class)->syncTrip($trip->fresh(['accommodations.hotel', 'transportations.vehicle']));
        } catch (\Throwable $e) {
            Log::warning('Accounting sync failed on trip create', [
                'trip_id' => $trip->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json($trip->load(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref']), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Trip $trip)
    {
        $this->authorize('view', $trip); // Ensure Policy exists or check user_id
        return response()->json($trip->load(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref']));
    }

    public function downloadPdf(Trip $trip)
    {
        $this->authorize('view', $trip);

        // Generate synchronously for the download request
        $job = new \App\Jobs\GenerateTripPdfJob($trip);
        $pdf = $job->handle();

        return response($pdf, 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="' . $trip->trip_id . '_Itinerary.pdf"');
    }

    public function downloadConfirmationPdf(Trip $trip)
    {
        $this->authorize('view', $trip);

        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        // Convert images to base64 for DomPDF
        $logoBase64 = null;
        if ($agencySettings && $agencySettings->logo_path) {
            if (str_starts_with($agencySettings->logo_path, 'http')) {
                $logoBase64 = $agencySettings->logo_path;
            } else {
                $logoBase64 = $this->imageToBase64(storage_path('app/public/' . $agencySettings->logo_path));
            }
        }

        $tripImageBase64 = null;
        if ($trip->image_path) {
            if (str_starts_with($trip->image_path, 'http')) {
                $tripImageBase64 = $trip->image_path;
            } else {
                $tripImageBase64 = $this->imageToBase64(storage_path('app/public/' . $trip->image_path));
            }
        }

        $heroImageBase64 = null;
        if ($agencySettings && $agencySettings->confirmation_hero_image) {
            if (str_starts_with($agencySettings->confirmation_hero_image, 'http')) {
                $heroImageBase64 = $agencySettings->confirmation_hero_image;
            } else {
                $heroImageBase64 = $this->imageToBase64(storage_path('app/public/' . $agencySettings->confirmation_hero_image));
            }
        }

        // Process dynamic confirmation message
        $confirmationMessage = $agencySettings->confirmation_pdf_message
            ?? $agencySettings->confirmation_message
            ?? "Warm greetings from {agencyName},\n\nThank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.";

        $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';
        $clientName = $trip->client_name ?? 'Guest';

        $confirmationMessage = str_replace(
            ['{agencyName}', '{clientName}'],
            [$agencyName, $clientName],
            $confirmationMessage
        );

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])
            ->loadView('pdf.confirmation', [
                'trip' => $trip,
                'agencySettings' => $agencySettings,
                'logoBase64' => $logoBase64,
                'tripImageBase64' => $tripImageBase64,
                'heroImageBase64' => $heroImageBase64,
                'confirmationMessage' => $confirmationMessage,
                'date' => now()->format('d M Y'),
            ]);

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="' . $trip->trip_id . '_Confirmation.pdf"');
    }

    public function downloadPaymentVoucherPdf(Trip $trip)
    {
        $this->authorize('view', $trip);

        $pdfContent = $this->buildPaymentVoucherPdf($trip);

        return response($pdfContent, 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="' . $trip->trip_id . '_Payment_Voucher.pdf"');
    }

    public function downloadInvoicePdf(Trip $trip)
    {
        $this->authorize('view', $trip);

        $pdfContent = $this->buildInvoicePdf($trip);

        return response($pdfContent, 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="' . $trip->trip_id . '_Invoice.pdf"');
    }

    public function sendConfirmationEmail(Request $request, Trip $trip)
    {
        $this->authorize('view', $trip);

        $validated = $request->validate([
            'recipient' => 'nullable|in:client,hotel,cab,payment_voucher,invoice',
        ]);

        $recipient = $validated['recipient'] ?? 'client';

        if ($recipient === 'hotel') {
            $trip->load(['accommodations.hotel']);

            $queuedCount = 0;
            foreach ($trip->accommodations as $accommodation) {
                if ($accommodation->hotel && $accommodation->hotel->email) {
                    SendHotelBookingEmailJob::dispatch($accommodation->id);
                    $queuedCount++;
                }
            }

            return response()->json([
                'message' => $queuedCount > 0
                    ? 'Hotel booking email notifications queued successfully.'
                    : 'No hotel email addresses found for this trip.',
            ]);
        }

        if ($recipient === 'cab') {
            $trip->load(['transportations.vehicle']);

            $queuedCount = 0;
            foreach ($trip->transportations as $transportation) {
                if ($transportation->vehicle && $transportation->vehicle->email) {
                    SendCabBookingEmailJob::dispatch($transportation->id);
                    $queuedCount++;
                }
            }

            return response()->json([
                'message' => $queuedCount > 0
                    ? 'Cab booking email notifications queued successfully.'
                    : 'No cab vendor email addresses found for this trip.',
            ]);
        }

        if ($recipient === 'payment_voucher' || $recipient === 'invoice') {
            if (!$trip->client_email) {
                return response()->json([
                    'message' => 'Client email is not set for this trip.'
                ], 422);
            }

            $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
            $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';

            $replacements = [
                '{agencyName}' => $agencyName,
                '{clientName}' => $trip->client_name ?? 'Guest',
                '{tripId}' => $trip->trip_id,
                '{paymentAmount}' => number_format((float) ($trip->paid_amount ?? 0), 2),
                '{currencySymbol}' => $trip->currency_symbol ?? '₹',
            ];

            if ($recipient === 'payment_voucher') {
                $subjectTemplate = 'Payment Receipt - Trip #{tripId}';
                $messageTemplate = $agencySettings->payment_voucher_email_message
                    ?? "Dear {clientName},\n\nThank you for your payment of {currencySymbol}{paymentAmount}. Please find your payment receipt attached below.\n\nRegards,\n{agencyName}";
                $pdfContent = $this->buildPaymentVoucherPdf($trip, $agencySettings);
                $fileName = $trip->trip_id . '_Payment_Voucher.pdf';
                $successMessage = 'Payment voucher emailed to the client.';
            } else {
                $subjectTemplate = 'Trip Invoice - {tripId}';
                $messageTemplate = $agencySettings->invoice_email_message
                    ?? "Dear {clientName},\n\nPlease find your invoice attached for trip {tripId}.\n\nRegards,\n{agencyName}";
                $pdfContent = $this->buildInvoicePdf($trip, $agencySettings);
                $fileName = $trip->trip_id . '_Invoice.pdf';
                $successMessage = 'Invoice emailed to the client.';
            }

            $subject = str_replace(array_keys($replacements), array_values($replacements), $subjectTemplate);
            $message = str_replace(array_keys($replacements), array_values($replacements), $messageTemplate);

            [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);

            Mail::mailer($mailer)->send([], [], function ($mailMessage) use ($trip, $subject, $message, $pdfContent, $fileName, $fromEmail, $fromName) {
                $mailMessage
                    ->to($trip->client_email)
                    ->subject($subject)
                    ->from($fromEmail, $fromName)
                    ->setBody(nl2br(e($message)), 'text/html');

                $mailMessage->attachData($pdfContent, $fileName, [
                    'mime' => 'application/pdf',
                ]);
            });

            return response()->json([
                'message' => $successMessage,
            ]);
        }

        // Update status to confirmed if it was pending
        if ($trip->status === 'pending') {
            $trip->status = 'confirmed';
        }

        $trip->confirmation_sent = true;
        $trip->save();

        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();

        if (!$agencySettings || !$agencySettings->contact_email) {
            return response()->json([
                'message' => 'Agency contact email is not set.'
            ], 422);
        }

        $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';

        // Build the confirmation message (cheap — just string work, no images)
        $confirmationMessage = $agencySettings->confirmation_message
            ?? "Warm greetings from {agencyName},\n\nThank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.";

        $confirmationPdfMessage = $agencySettings->confirmation_pdf_message
            ?? $confirmationMessage;

        $confirmationMessage = str_replace(
            ['{agencyName}', '{clientName}'],
            [$agencyName, $trip->client_name ?? 'Guest'],
            $confirmationMessage
        );

        $confirmationPdfMessage = str_replace(
            ['{agencyName}', '{clientName}'],
            [$agencyName, $trip->client_name ?? 'Guest'],
            $confirmationPdfMessage
        );

        $whatsappMessage = trim($confirmationMessage);

        // Dispatch the heavy PDF-generation + email work to the queue.
        // The HTTP request returns immediately — the user is not kept waiting.
        SendBookingConfirmationJob::dispatch(
            $trip->id,
            $agencySettings->contact_email,
            $agencyName,
            $confirmationMessage,
            $confirmationPdfMessage,
            $whatsappMessage
        );

        $response = [
            'message' => 'Confirmation email queued for the client.',
        ];

        // Build WhatsApp URL immediately — no need to wait for the job
        if ($trip->client_phone) {
            $response['whatsapp_url'] = 'https://wa.me/' . preg_replace('/\D/', '', $trip->client_phone) . '?text=' . urlencode($whatsappMessage);
        }

        return response()->json($response);
    }

    private function buildPaymentVoucherPdf(Trip $trip, ?AgencySetting $agencySettings = null): string
    {
        $agencySettings = $agencySettings ?: AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
        $logoBase64 = $this->getAgencyLogoBase64($agencySettings);

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])->loadView('pdf.receipt', [
            'trip' => $trip,
            'payments' => $trip->payments()->orderBy('payment_date', 'desc')->get(),
            'paymentAmount' => $trip->paid_amount,
            'agencySettings' => $agencySettings,
            'logoBase64' => $logoBase64,
            'date' => now()->format('d M Y'),
        ]);

        return $pdf->output();
    }

    private function buildInvoicePdf(Trip $trip, ?AgencySetting $agencySettings = null): string
    {
        $agencySettings = $agencySettings ?: AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
        $logoBase64 = $this->getAgencyLogoBase64($agencySettings);

        $trip->load(['accommodations.hotel', 'transportations.vehicle']);

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])->loadView('pdf.invoice', [
            'trip' => $trip,
            'agencySettings' => $agencySettings,
            'logoBase64' => $logoBase64,
        ]);

        return $pdf->output();
    }

    private function getAgencyLogoBase64(?AgencySetting $agencySettings): ?string
    {
        if (!$agencySettings || !$agencySettings->logo_path) {
            return null;
        }

        if (str_starts_with($agencySettings->logo_path, 'http')) {
            return $agencySettings->logo_path;
        }

        return $this->imageToBase64(storage_path('app/public/' . $agencySettings->logo_path));
    }

    public function duplicate(Request $request, Trip $trip)
    {
        $this->authorize('view', $trip);

        $canCreate = \App\Services\SubscriptionService::canCreateTrip($request->user());

        if (!$canCreate['allowed']) {
            return response()->json([
                'message' => $canCreate['reason']
            ], $canCreate['http_status']);
        }

        // 1. Replicate basic trip model
        $newTrip = $trip->replicate();
        $newTrip->trip_id = 'TRP' . mt_rand(100000, 999999);

        // Ensure trip_id is unique
        while (\App\Models\Trip::where('trip_id', $newTrip->trip_id)->exists()) {
            $newTrip->trip_id = 'TRP' . mt_rand(100000, 999999);
        }

        $newTrip->trip_title = $trip->trip_title . ' (Copy)';
        $newTrip->slug = Str::slug($newTrip->trip_title . '-' . Str::random(6));
        $newTrip->status = 'pending';
        $newTrip->user_id = $request->user()->getAdminId();
        $newTrip->team_id = $request->user()->getTeamId();
        $newTrip->save();

        // 2. Duplicate relations
        $trip->load(['itineraries', 'accommodations', 'transportations']);

        foreach ($trip->itineraries as $itinerary) {
            $newItinerary = $itinerary->replicate();
            $newItinerary->trip_id = $newTrip->id; // Use primary key 'id', not 'trip_id' string
            $newItinerary->save();
        }

        foreach ($trip->accommodations as $accommodation) {
            $newAccommodation = $accommodation->replicate();
            $newAccommodation->trip_id = $newTrip->id; // Use primary key 'id', not 'trip_id' string
            $newAccommodation->save();
        }

        foreach ($trip->transportations as $transportation) {
            $newTransportation = $transportation->replicate();
            $newTransportation->trip_id = $newTrip->id; // Use primary key 'id', not 'trip_id' string
            $newTransportation->save();
        }

        // 3. Update subscription
        $admin = \App\Services\SubscriptionService::resolveAdmin($request->user());
        if ($admin) {
            $subscription = \App\Services\SubscriptionService::getSubscriptionForUser($admin);
            if ($subscription) {
                $subscription->increment('trips_used');
            }
        }

        try {
            app(AccountingLedgerService::class)->syncTrip($newTrip->fresh(['accommodations.hotel', 'transportations.vehicle']));
        } catch (\Throwable $e) {
            Log::warning('Accounting sync failed on trip duplicate', [
                'trip_id' => $newTrip->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json($newTrip->load(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref']), 201);
    }

    private function imageToBase64($path)
    {
        if (!file_exists($path)) {
            Log::warning("Image file not found for PDF conversion: {$path}");
            return null;
        }
        $type = pathinfo($path, PATHINFO_EXTENSION);
        $data = @file_get_contents($path);
        if ($data === false) {
            Log::warning("Failed to read image file for PDF conversion: {$path}");
            return null;
        }
        return 'data:image/' . $type . ';base64,' . base64_encode($data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Trip $trip)
    {
        $this->authorize('update', $trip);

        $validated = $request->validate([
            'tripTitle' => 'sometimes|required|string|max:255',
            'destination' => 'nullable|string|max:255',
            'destinationId' => 'nullable|exists:destinations,id',
            'clientName' => 'sometimes|required|string|max:255',
            'clientPhone' => 'sometimes|required|phone:AUTO',
            'clientEmail' => 'sometimes|required|email|max:255',
            'adults' => 'nullable|integer|min:1',
            'kidsUpto5' => 'nullable|integer|min:0',
            'kids5to12' => 'nullable|integer|min:0',
            'startDate' => 'nullable|string',
            'duration' => 'nullable|integer|min:1',
            'cost' => 'nullable|numeric|min:0',
            'gst_amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string',
            'image' => 'nullable|string',
            'status' => 'nullable|string',
            'template' => 'nullable|string',
            'include_gst' => 'nullable|boolean',
            'use_flight' => 'nullable|boolean',
            'transport_details' => 'nullable|array',
            'inclusions' => 'nullable|array',
            'exclusions' => 'nullable|array',
            'other_costs' => 'nullable|array',
            'tagline' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'new_payment' => 'nullable|numeric|min:0',
            'refunded_amount' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string',
        ]);

        if (isset($validated['paid_amount']) && $validated['paid_amount'] > ($trip->cost ?? 0)) {
            return response()->json([
                'message' => 'The paid amount (' . $validated['paid_amount'] . ') cannot exceed the total trip cost (' . ($trip->cost ?? 0) . ').'
            ], 422);
        }

        if (isset($validated['new_payment']) && ($trip->paid_amount + $validated['new_payment']) > ($trip->cost ?? 0)) {
            return response()->json([
                'message' => 'Total paid amount (' . ($trip->paid_amount + $validated['new_payment']) . ') cannot exceed total trip cost (' . ($trip->cost ?? 0) . ').'
            ], 422);
        }

        if (isset($validated['tripTitle'])) $trip->trip_title = $validated['tripTitle'];
        if (isset($validated['destination'])) $trip->destination = $validated['destination'];
        if (isset($validated['destinationId'])) $trip->destination_id = $validated['destinationId'];
        if (isset($validated['clientName'])) $trip->client_name = $validated['clientName'];
        if (isset($validated['clientPhone'])) $trip->client_phone = $validated['clientPhone'];
        if (isset($validated['clientEmail'])) $trip->client_email = $validated['clientEmail'];
        if (isset($validated['adults'])) $trip->adults = $validated['adults'];
        if (isset($validated['kidsUpto5'])) $trip->kids_cnb = $validated['kidsUpto5'];
        if (isset($validated['kids5to12'])) $trip->kids_5_to_12 = $validated['kids5to12'];
        if (isset($validated['startDate'])) $trip->start_date = $this->formatDateForDatabase($validated['startDate']);
        if (isset($validated['duration'])) $trip->duration = $validated['duration'];
        if (isset($validated['cost'])) $trip->cost = $validated['cost'];
        if (isset($validated['gst_amount'])) $trip->gst_amount = $validated['gst_amount'];
        if (isset($validated['currency'])) $trip->currency = $validated['currency'];
        if (isset($validated['template'])) $trip->template = $validated['template'];
        if (isset($validated['status'])) $trip->status = $validated['status'];
        if (isset($validated['include_gst'])) $trip->include_gst = $validated['include_gst'];
        if (isset($validated['use_flight'])) $trip->use_flight = $validated['use_flight'];
        if (isset($validated['transport_details'])) $trip->transport_details = $validated['transport_details'];
        if (isset($validated['inclusions'])) $trip->inclusions = $validated['inclusions'];
        if (isset($validated['tagline'])) $trip->tagline = $validated['tagline'];
        if (isset($validated['exclusions'])) $trip->exclusions = $validated['exclusions'];
        if (isset($validated['other_costs'])) $trip->other_costs = $validated['other_costs'];
        if (isset($validated['payment_method'])) $trip->payment_method = $validated['payment_method'];

        if (isset($validated['new_payment'])) {
            $paymentReceived = (float)$validated['new_payment'];
            if ($paymentReceived > 0) {
                $trip->paid_amount += $paymentReceived;

                // Record payment history
                Payment::create([
                    'trip_id' => $trip->id,
                    'amount' => $paymentReceived,
                    'payment_method' => $trip->payment_method ?? 'N/A',
                    'payment_date' => now(),
                    'notes' => 'Recorded during trip update'
                ]);

                // Load agency settings for the name
                $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
                $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';

                SendPaymentVoucherJob::dispatch(
                    $trip->id,
                    (float)$paymentReceived,
                    $trip->client_email,
                    $agencyName
                );

                // Prepare WhatsApp message for frontend
                $whatsappData = [
                    'phone' => preg_replace('/\D/', '', $trip->client_phone),
                    'message' => "Warm greetings from $agencyName,\n\nWe have successfully received your payment of ₹" . number_format($paymentReceived, 2) . " ($trip->payment_method) for your upcoming trip ($trip->trip_id). Your total paid amount is now ₹" . number_format($trip->paid_amount, 2) . " out of ₹" . number_format($trip->cost, 2) . ".\n\nThank you for choosing $agencyName!"
                ];
            }
        }

        if (isset($validated['paid_amount'])) {
            $oldPaidAmount = $trip->paid_amount ?? 0;
            $newPaidAmount = (float)$validated['paid_amount'];
            $trip->paid_amount = $newPaidAmount;

            // Trigger payment voucher if amount increased
            if ($newPaidAmount > $oldPaidAmount) {
                $paymentReceived = $newPaidAmount - $oldPaidAmount;

                // Record payment history
                Payment::create([
                    'trip_id' => $trip->id,
                    'amount' => $paymentReceived,
                    'payment_method' => $trip->payment_method ?? 'N/A',
                    'payment_date' => now(),
                    'notes' => 'Adjustment of paid amount'
                ]);

                // Load agency settings for the name
                $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
                $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';

                SendPaymentVoucherJob::dispatch(
                    $trip->id,
                    (float)$paymentReceived,
                    $trip->client_email,
                    $agencyName
                );
            }
        }
        if (isset($validated['refunded_amount'])) $trip->refunded_amount = $validated['refunded_amount'];

        if ($request->filled('image')) {
            if (str_starts_with($request->image, 'data:image')) {
                $trip->image_path = $this->saveBase64Image($request->image, 'trips');
            } elseif (str_contains($request->image, '/api/storage/')) {
                // Extract path from URL
                $trip->image_path = substr($request->image, strpos($request->image, '/api/storage/') + 13);
            } else {
                $trip->image_path = $request->image;
            }
        } elseif ($request->has('image') && empty($request->image)) {
            $trip->image_path = null;
        }

        $trip->save();

        $this->syncRelations($trip, $request);

        try {
            app(AccountingLedgerService::class)->syncTrip($trip->fresh(['accommodations.hotel', 'transportations.vehicle']));
        } catch (\Throwable $e) {
            Log::warning('Accounting sync failed on trip update', [
                'trip_id' => $trip->id,
                'error' => $e->getMessage(),
            ]);
        }

        $response = $trip->load(['itineraries', 'accommodations.hotel', 'transportations.vehicle', 'destination_ref'])->toArray();
        if (isset($whatsappData)) {
            $response['whatsapp'] = $whatsappData;
        }

        return response()->json($response);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Trip $trip)
    {
        $this->authorize('delete', $trip);
        $trip->delete();
        return response()->json(['message' => 'Trip deleted']);
    }

    protected function generatePaymentReceipt(Trip $trip, $paymentAmount)
    {
        $agencySettings = AgencySetting::with('documentTemplate')->where('user_id', $trip->user_id)->first();
        $agencyName = $agencySettings->agency_name ?? 'ViaItinerary';

        $pdf = Pdf::loadView('pdf.receipt', [
            'trip' => $trip,
            'agencySettings' => $agencySettings,
            'paymentAmount' => $paymentAmount,
        ]);

        $pdfContent = $pdf->output();

        if ($agencySettings && $agencySettings->contact_email) {
            [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($trip->user_id);
            Mail::mailer($mailer)->to($trip->client_email)->send(
                new PaymentReceiptMail($trip, $pdfContent, $agencyName, $paymentAmount, $fromEmail, $fromName)
            );
        }
    }

    protected function syncRelations(Trip $trip, Request $request)
    {
        // 1. Sync Itineraries
        if ($request->has('itineraries')) {
            $incomingIds = collect($request->itineraries)->pluck('id')->filter();
            $trip->itineraries()->whereNotIn('id', $incomingIds)->delete();

            foreach ($request->itineraries as $item) {
                $data = [
                    'day_number' => $item['day_number'] ?? null,
                    'title' => $item['title'] ?? null,
                    'location' => $item['location'] ?? null,
                    'description' => $item['description'] ?? null,
                ];

                if (isset($item['image']) && !empty($item['image'])) {
                    if (str_starts_with($item['image'], 'data:image')) {
                        $data['image_path'] = $this->saveBase64Image($item['image'], 'itineraries');
                    } elseif (str_contains($item['image'], '/api/storage/')) {
                        // Extract path from URL like "http://localhost:8000/api/storage/destinations/xyz.jpeg"
                        $data['image_path'] = substr($item['image'], strpos($item['image'], '/api/storage/') + 13);
                    } else {
                        $data['image_path'] = $item['image'];
                    }
                } elseif (isset($item['image']) && empty($item['image'])) {
                    $data['image_path'] = null;
                }

                $trip->itineraries()->updateOrCreate(
                    ['id' => $item['id'] ?? null],
                    $data
                );
            }
        }

        // 2. Sync Accommodations
        if ($request->has('accommodations')) {
            $incomingIds = collect($request->accommodations)->pluck('id')->filter();
            $trip->accommodations()->whereNotIn('id', $incomingIds)->delete();

            $hotelIds = collect($request->accommodations)
                ->map(fn($item) => $item['hotelId'] ?? $item['hotel_id'] ?? null)
                ->filter()
                ->unique()
                ->values();

            $hotelMap = $hotelIds->isEmpty()
                ? collect()
                : Hotel::whereIn('id', $hotelIds)->get(['id', 'name', 'city'])->keyBy('id');

            foreach ($request->accommodations as $item) {
                $hotelId = $item['hotelId'] ?? $item['hotel_id'] ?? null;
                $hotelMatch = $hotelId ? ($hotelMap[$hotelId] ?? null) : null;
                $nameFromRequest = $item['name'] ?? null;
                $cityFromRequest = $item['city'] ?? null;

                $data = [
                    'hotel_id' => $hotelId,
                    'name' => $nameFromRequest ?? ($hotelMatch?->name) ?? 'Hotel',
                    'city' => $cityFromRequest ?? ($hotelMatch?->city) ?? null,
                    'category' => $item['category'] ?? null,
                    'rooms' => $item['rooms'] ?? null,
                    'beds' => ($item['extra_beds_5_to_12_count'] ?? 0) + ($item['extra_beds_above_12_count'] ?? 0),
                    'cnb_count' => $item['cnb_count'] ?? 0,
                    'extra_beds_5_to_12_count' => $item['extra_beds_5_to_12_count'] ?? 0,
                    'extra_beds_above_12_count' => $item['extra_beds_above_12_count'] ?? 0,
                    'extra_bed_category' => null,
                    'meal_plan' => $item['meal_plan'] ?? null,
                    'room_type' => $item['room_type'] ?? 'Deluxe',
                    'check_in' => $this->formatDateForDatabase($item['check_in'] ?? null),
                    'check_out' => $this->formatDateForDatabase($item['check_out'] ?? null),
                    'price_per_room' => $item['price_per_room'] ?? null,
                    'bed_prices' => $item['bed_prices'] ?? [],
                ];

                if (isset($item['image']) && !empty($item['image'])) {
                    if (str_starts_with($item['image'], 'data:image')) {
                        $data['image_path'] = $this->saveBase64Image($item['image'], 'accommodations');
                    } elseif (str_contains($item['image'], '/api/storage/')) {
                        // Extract path from URL like "http://localhost:8000/api/storage/hotels/xyz.jpeg"
                        $data['image_path'] = substr($item['image'], strpos($item['image'], '/api/storage/') + 13);
                    } else {
                        $data['image_path'] = $item['image'];
                    }
                } elseif (isset($item['image']) && empty($item['image'])) {
                    $data['image_path'] = null;
                }

                $trip->accommodations()->updateOrCreate(
                    ['id' => $item['id'] ?? null],
                    $data
                );
            }
        }

        // 3. Sync Transportations
        if ($request->has('transportations')) {
            $incomingIds = collect($request->transportations)->pluck('id')->filter();
            $trip->transportations()->whereNotIn('id', $incomingIds)->delete();

            foreach ($request->transportations as $item) {
                $data = [
                    'vehicle_id' => $item['vehicleId'] ?? null,
                    'trip_type' => $item['trip_type'] ?? null,
                    'destination' => $item['destination'] ?? null,
                    'route' => $item['route'] ?? null,
                    'date' => $this->formatDateForDatabase($item['date'] ?? null),
                    'vehicle_type' => $item['vehicle_type'] ?? null,
                    'quantity' => $item['quantity'] ?? 1,
                    'remarks' => $item['remarks'] ?? null,
                ];

                $trip->transportations()->updateOrCreate(
                    ['id' => $item['id'] ?? null],
                    $data
                );
            }
        }
    }

    // Helper from Trait
    use \App\Traits\HandlesBase64Images;

    /**
     * Convert ISO 8601 date string to MySQL date format (Y-m-d)
     */
    private function formatDateForDatabase($dateString)
    {
        if (empty($dateString)) {
            return null;
        }

        try {
            if (strpos($dateString, '-') !== false) {
                $parts = explode('-', $dateString);
                if (count($parts) === 3 && strlen($parts[0]) === 2) {
                    // It's DD-MM-YYYY
                    return Carbon::createFromFormat('d-m-Y', $dateString)->format('Y-m-d');
                }
            }
            return Carbon::parse($dateString)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }
}
