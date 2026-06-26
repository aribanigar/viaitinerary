<?php

namespace App\Support;

use App\Models\AgencySetting;

class AgencyMailer
{
    public static function configureForAdminId(int $adminId): array
    {
        $settings = AgencySetting::where('user_id', $adminId)->first();

        return self::configureForSettings($settings);
    }

    public static function configureForSettings(?AgencySetting $settings): array
    {
        $fallbackMailer = 'booking';
        $fallbackFromEmail = config('mail.mailers.booking.username');
        $fallbackFromName = $settings?->agency_name ?? config('mail.from.name');

        if (
            !$settings ||
            !$settings->smtp_host ||
            !$settings->smtp_port ||
            !$settings->smtp_email ||
            !$settings->smtp_app_password
        ) {
            return [$fallbackMailer, $fallbackFromEmail, $fallbackFromName];
        }

        $encryption = $settings->smtp_encryption;
        if ($encryption === 'none' || $encryption === '') {
            $encryption = null;
        }

        config([
            'mail.mailers.agency' => [
                'transport' => 'smtp',
                'host' => $settings->smtp_host,
                'port' => (int) $settings->smtp_port,
                'username' => $settings->smtp_email,
                'password' => $settings->smtp_app_password,
                'encryption' => $encryption,
                'timeout' => null,
            ],
        ]);

        return ['agency', $settings->smtp_email, $settings->agency_name ?? $fallbackFromName];
    }
}
