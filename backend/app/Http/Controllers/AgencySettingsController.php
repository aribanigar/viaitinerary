<?php

namespace App\Http\Controllers;

use App\Models\AgencyDocumentTemplate;
use App\Models\AgencySetting;
use App\Support\AgencyMailer;
use App\Traits\HandlesBase64Images;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

class AgencySettingsController extends Controller
{
    use HandlesBase64Images;

    public function verifyIfsc(Request $request)
    {
        $ifsc = strtoupper(trim((string) $request->query('ifsc', '')));
        if ($ifsc === '') {
            return response()->json([
                'message' => 'IFSC required.',
            ], 400);
        }

        if (!preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $ifsc)) {
            return response()->json([
                'message' => 'Invalid IFSC format. Should be like HDFC0001234.',
            ], 400);
        }

        try {
            $response = Http::timeout(10)
                ->acceptJson()
                ->get("https://ifsc.razorpay.com/{$ifsc}");

            if ($response->status() === 404) {
                return response()->json([
                    'message' => 'IFSC not found. Please check the code.',
                ], 404);
            }

            if (!$response->successful()) {
                return response()->json([
                    'message' => 'Could not verify IFSC at this time.',
                ], 502);
            }

            $data = $response->json();

            return response()->json([
                'data' => [
                    'bank' => $data['BANK'] ?? null,
                    'branch' => $data['BRANCH'] ?? null,
                    'city' => $data['CITY'] ?? null,
                    'state' => $data['STATE'] ?? null,
                    'address' => $data['ADDRESS'] ?? null,
                    'ifsc' => $data['IFSC'] ?? $ifsc,
                ],
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => 'IFSC verification service unavailable.',
            ], 503);
        }
    }

    public function testSmtp(Request $request)
    {
        $validated = $request->validate([
            'testEmail' => 'required|email',
        ]);

        $adminId = $request->user()->getAdminId();
        $settings = AgencySetting::where('user_id', $adminId)->first();

        if (
            !$settings ||
            !$settings->smtp_host ||
            !$settings->smtp_port ||
            !$settings->smtp_email ||
            !$settings->smtp_app_password
        ) {
            return response()->json([
                'message' => 'SMTP credentials are not configured.',
            ], 422);
        }

        [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForSettings($settings);

        Mail::mailer($mailer)->raw(
            'This is a test email sent from your SMTP settings.',
            function ($message) use ($validated, $fromEmail, $fromName) {
                $message
                    ->to($validated['testEmail'])
                    ->from($fromEmail, $fromName)
                    ->subject('SMTP Test Email');
            }
        );

        return response()->json([
            'message' => 'Test email sent successfully.',
        ]);
    }

    public function show(Request $request)
    {
        $settings = AgencySetting::with('documentTemplate')
            ->where('user_id', $request->user()->getAdminId())
            ->first();

        if (!$settings) {
            // Updated defaults based on user attachment
            return response()->json([
                'agencyName' => 'TravelAgency',
                'phone' => '+1 234 567 890',
                'website' => 'www.youragency.com',
                'companyAddress' => '',
                'email' => 'contact@agency.com',
                'whatsapp' => '+1 234 567 890',
                'brandColor' => '#F4A229',
                'secondaryColor' => '#0D2D2D',
                'fontFamily' => 'Montserrat',
                'logo' => null,
                'beneficiaryName' => '',
                'bankName' => '',
                'accountNumber' => '',
                'ifscCode' => '',
                'greetingMessage' => 'Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.',
                'confirmationMessage' => "Thank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.",
                'confirmationPdfMessage' => "Thank you for choosing {agencyName} for your upcoming journey. We are pleased to confirm your travel arrangements and sincerely appreciate the opportunity to curate your travel experience. Our team looks forward to welcoming you and ensuring a seamless, comfortable, and memorable holiday.",
                'paymentVoucherEmailMessage' => 'Dear {clientName},\n\nThank you for your payment of {currencySymbol}{paymentAmount}. Please find your payment receipt attached below.\n\nRegards,\n{agencyName}',
                'invoiceEmailMessage' => 'Dear {clientName},\n\nPlease find your invoice attached for trip {tripId}.\n\nRegards,\n{agencyName}',
                'confirmationHeroImage' => null,
                'defaultTripImage' => null,
                'gstPercentage' => 5.00,
                'profitMarginPercentage' => 10.00,
                'smtpEmail' => null,
                'smtpHost' => null,
                'smtpPort' => 587,
                'smtpEncryption' => 'tls',
                'hasSmtpPassword' => false,
            ], 200);
        }

        // Map snake_case database fields to camelCase for the frontend
        return response()->json([
            'agencyName' => $settings->agency_name,
            'phone' => $settings->contact_phone,
            'website' => $settings->website,
            'companyAddress' => $settings->company_address,
            'email' => $settings->contact_email,
            'whatsapp' => $settings->whatsapp,
            'brandColor' => $settings->brand_color,
            'secondaryColor' => $settings->secondary_color,
            'fontFamily' => $settings->font_family,
            'logo' => $this->getImageUrl($settings->logo_path),
            'beneficiaryName' => $settings->beneficiary_name,
            'bankName' => $settings->bank_name,
            'accountNumber' => $settings->account_number,
            'ifscCode' => $settings->ifsc_code,
            'greetingMessage' => $settings->greeting_message,
            'confirmationMessage' => $settings->confirmation_message,
            'confirmationPdfMessage' => $settings->confirmation_pdf_message,
            'paymentVoucherEmailMessage' => $settings->payment_voucher_email_message,
            'invoiceEmailMessage' => $settings->invoice_email_message,
            'confirmationHeroImage' => $this->getImageUrl($settings->confirmation_hero_image),
            'defaultTripImage' => $this->getImageUrl($settings->default_trip_image_path),
            'gstPercentage' => $settings->gst_percentage,
            'profitMarginPercentage' => $settings->profit_margin_percentage,
            'smtpEmail' => $settings->smtp_email,
            'smtpHost' => $settings->smtp_host,
            'smtpPort' => $settings->smtp_port,
            'smtpEncryption' => $settings->smtp_encryption ?: 'tls',
            'hasSmtpPassword' => !empty($settings->smtp_app_password),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'agencyName' => 'required|string',
            'phone' => 'required|string',
            'website' => 'nullable|string',
            'companyAddress' => 'nullable|string|max:500',
            'email' => 'required|email',
            'whatsapp' => 'required|string',
            'brandColor' => 'nullable|string',
            'secondaryColor' => 'nullable|string',
            'fontFamily' => 'nullable|string',
            'logo' => 'nullable|string', // Base64 or URL
            'confirmationHeroImage' => 'nullable|string', // Base64 or URL
            'defaultTripImage' => 'nullable|string', // Base64 or URL
            'beneficiaryName' => 'nullable|string',
            'bankName' => 'nullable|string',
            'accountNumber' => 'nullable|string',
            'ifscCode' => 'nullable|string|regex:/^[A-Z]{4}0[A-Z0-9]{6}$/i',
            'greetingMessage' => 'nullable|string',
            'confirmationMessage' => 'nullable|string',
            'confirmationPdfMessage' => 'nullable|string',
            'paymentVoucherEmailMessage' => 'nullable|string',
            'invoiceEmailMessage' => 'nullable|string',
            'gstPercentage' => 'nullable|numeric',
            'profitMarginPercentage' => 'nullable|numeric',
            'smtpEmail' => 'nullable|email',
            'smtpHost' => 'nullable|string',
            'smtpPort' => 'nullable|integer|min:1|max:65535',
            'smtpEncryption' => 'nullable|in:tls,ssl,none',
            'smtpAppPassword' => 'nullable|string|min:8',
            'clearSmtpPassword' => 'nullable|boolean',
        ]);

        if (isset($validated['ifscCode']) && $validated['ifscCode'] !== null) {
            $normalizedIfsc = strtoupper(trim($validated['ifscCode']));
            $validated['ifscCode'] = $normalizedIfsc === '' ? null : $normalizedIfsc;
        }

        $settings = AgencySetting::firstOrNew(['user_id' => $user->getAdminId()]);
        $template = AgencyDocumentTemplate::firstOrNew(['user_id' => $user->getAdminId()]);

        // Handle Logo Upload
        if (array_key_exists('logo', $validated)) {
            $existingLogoPath = $settings->logo_path;

            if (str_starts_with($validated['logo'], 'data:image')) {
                $settings->logo_path = $this->saveBase64Image($validated['logo'], 'agency');
                if ($settings->logo_path !== $existingLogoPath) {
                    $this->deleteStoredImage($existingLogoPath);
                }
            } elseif ($validated['logo'] === null) {
                $this->deleteStoredImage($existingLogoPath);
                $settings->logo_path = null;
            }
        }

        // Handle Confirmation Hero Image Upload
        if (array_key_exists('confirmationHeroImage', $validated)) {
            $existingHeroSettingsPath = $settings->getRawOriginal('confirmation_hero_image');
            $existingHeroTemplatePath = $template->confirmation_hero_image;
            $existingHeroPaths = array_filter([
                $existingHeroSettingsPath,
                $existingHeroTemplatePath,
            ]);

            if (str_starts_with($validated['confirmationHeroImage'], 'data:image')) {
                $newHeroPath = $this->saveBase64Image($validated['confirmationHeroImage'], 'agency');
                $settings->confirmation_hero_image = $newHeroPath;
                $template->confirmation_hero_image = $newHeroPath;

                foreach (array_unique($existingHeroPaths) as $path) {
                    if ($path !== $newHeroPath) {
                        $this->deleteStoredImage($path);
                    }
                }
            } elseif ($validated['confirmationHeroImage'] === null) {
                foreach (array_unique($existingHeroPaths) as $path) {
                    $this->deleteStoredImage($path);
                }

                $settings->confirmation_hero_image = null;
                $template->confirmation_hero_image = null;
            }
        }

        // Handle Default Trip Image Upload
        if (array_key_exists('defaultTripImage', $validated)) {
            $existingDefaultPath = $settings->default_trip_image_path;

            if (str_starts_with($validated['defaultTripImage'], 'data:image')) {
                $settings->default_trip_image_path = $this->saveBase64Image($validated['defaultTripImage'], 'agency');
                if ($settings->default_trip_image_path !== $existingDefaultPath) {
                    $this->deleteStoredImage($existingDefaultPath);
                }
            } elseif ($validated['defaultTripImage'] === null) {
                $this->deleteStoredImage($existingDefaultPath);
                $settings->default_trip_image_path = null;
            }
        }

        $settings->fill([
            'agency_name' => $validated['agencyName'],
            'contact_phone' => $validated['phone'],
            'website' => $validated['website'],
            'company_address' => $validated['companyAddress'] ?? null,
            'contact_email' => $validated['email'],
            'whatsapp' => $validated['whatsapp'],
            'brand_color' => $validated['brandColor'] ?? '#F4A229',
            'secondary_color' => $validated['secondaryColor'] ?? '#0D2D2D',
            'font_family' => $validated['fontFamily'] ?? 'Montserrat',
            'beneficiary_name' => $validated['beneficiaryName'],
            'bank_name' => $validated['bankName'] ?? null,
            'account_number' => $validated['accountNumber'],
            'ifsc_code' => $validated['ifscCode'],
            'greeting_message' => $validated['greetingMessage'],
            'confirmation_message' => $validated['confirmationMessage'],
            'confirmation_pdf_message' => $validated['confirmationPdfMessage'],
            'payment_voucher_email_message' => $validated['paymentVoucherEmailMessage'] ?? null,
            'invoice_email_message' => $validated['invoiceEmailMessage'] ?? null,
            'gst_percentage' => $validated['gstPercentage'] ?? 5.00,
            'profit_margin_percentage' => $validated['profitMarginPercentage'] ?? 10.00,
            'smtp_email' => $validated['smtpEmail'] ?? $settings->smtp_email,
            'smtp_host' => $validated['smtpHost'] ?? $settings->smtp_host,
            'smtp_port' => $validated['smtpPort'] ?? $settings->smtp_port,
            'smtp_encryption' => $validated['smtpEncryption'] ?? $settings->smtp_encryption,
        ]);

        if (!empty($validated['clearSmtpPassword'])) {
            $settings->smtp_app_password = null;
        } elseif (!empty($validated['smtpAppPassword'])) {
            $settings->smtp_app_password = trim($validated['smtpAppPassword']);
        }

        $settings->save();

        $template->fill([
            'confirmation_message' => $validated['confirmationMessage'] ?? $template->confirmation_message,
            'confirmation_pdf_message' => $validated['confirmationPdfMessage'] ?? $template->confirmation_pdf_message,
            'payment_voucher_email_message' => $validated['paymentVoucherEmailMessage'] ?? $template->payment_voucher_email_message,
            'invoice_email_message' => $validated['invoiceEmailMessage'] ?? $template->invoice_email_message,
        ]);
        $template->save();

        $settings->setRelation('documentTemplate', $template);

        return response()->json([
            'agencyName' => $settings->agency_name,
            'phone' => $settings->contact_phone,
            'website' => $settings->website,
            'companyAddress' => $settings->company_address,
            'email' => $settings->contact_email,
            'whatsapp' => $settings->whatsapp,
            'brandColor' => $settings->brand_color,
            'secondaryColor' => $settings->secondary_color,
            'fontFamily' => $settings->font_family,
            'logo' => $this->getImageUrl($settings->logo_path),
            'confirmationHeroImage' => $this->getImageUrl($settings->confirmation_hero_image),
            'beneficiaryName' => $settings->beneficiary_name,
            'bankName' => $settings->bank_name,
            'accountNumber' => $settings->account_number,
            'ifscCode' => $settings->ifsc_code,
            'greetingMessage' => $settings->greeting_message,
            'confirmationMessage' => $settings->confirmation_message,
            'confirmationPdfMessage' => $settings->confirmation_pdf_message,
            'paymentVoucherEmailMessage' => $settings->payment_voucher_email_message,
            'invoiceEmailMessage' => $settings->invoice_email_message,
            'gstAmount' => $settings->gst_amount,
            'defaultTripImage' => $this->getImageUrl($settings->default_trip_image_path),
            'profitMarginPercentage' => $settings->profit_margin_percentage,
            'smtpEmail' => $settings->smtp_email,
            'smtpHost' => $settings->smtp_host,
            'smtpPort' => $settings->smtp_port,
            'smtpEncryption' => $settings->smtp_encryption ?: 'tls',
            'hasSmtpPassword' => !empty($settings->smtp_app_password),
        ]);
    }
}
