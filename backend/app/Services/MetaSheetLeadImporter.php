<?php

namespace App\Services;

use App\Models\Integration;
use App\Models\LeadInquiry;
use App\Models\User;
use App\Notifications\NewLeadArrivedNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

class MetaSheetLeadImporter
{
    private const MAX_SKIP_DETAILS = 25;
    private ?bool $hasPaxColumn = null;

    /**
     * @var array<string, array<int, string>>
     */
    private array $fieldMap = [
        'client_name' => ['full_name', 'name', 'first_name', 'customer_name', 'lead_name', 'firstname', 'last_name', 'lastname'],
        'client_email' => ['email', 'email_address', 'e_mail', 'emailid'],
        'client_phone' => ['phone_number', 'phone', 'mobile', 'mobile_number', 'contact', 'whatsapp', 'contact_number', 'phonenumber'],
        'total_people' => ['how_many_people', 'number_of_people', 'total_people', 'people', 'pax', 'travellers', 'travelers'],
        'destination' => ['destination_to_visit?', 'destination_to_visit', 'destination', 'travel_destination', 'place', 'location', 'where_do_you_want_to_travel', 'travel_place', 'travel_to'],
        'duration' => ['please_share_number_of_nights_to_stay?', 'please_share_number_of_nights_to_stay', 'duration', 'travel_duration', 'days', 'number_of_days', 'trip_duration', 'how_many_days', 'nights'],
        'start_date' => ['when_are_you_planning_to_travel?', 'when_are_you_planning_to_travel', 'travel_date', 'start_date', 'from_date', 'departure_date', 'travel_from', 'check_in'],
        'adults' => ['please_share_number_of_adults?', 'please_share_number_of_adults', 'adults', 'num_adults', 'number_of_adults', 'adult', 'no_of_adults', 'pax_adults'],
        'kids_cnb' => ['please_share_number_of_kids_under_5?', 'please_share_number_of_kids_under_5', 'number_of_kids_under_5', 'kids_under_5', 'num_kids_under_5', 'children_under_5', 'under_5', 'kids_upto_5', 'kids_below_5'],
        'kids_5_to_12' => ['children', 'kids', 'num_children', 'number_of_children', 'child', 'no_of_kids', 'pax_children', 'kids_5_to_12'],
        'platform' => ['platform', 'source_platform', 'lead_platform', 'channel'],
        'approximate_budget' => ['budget', 'approx_budget', 'travel_budget', 'estimated_budget'],
        'special_requests' => ['special_requests', 'comments', 'notes', 'requirements', 'any_specific_requirements', 'message', 'additional_info'],
    ];

    /**
     * @return array{
     *     imported:int,
     *     skipped:int,
     *     total:int,
     *     skip_reason_counts:array<string,int>,
     *     skipped_rows:array<int,array<string,mixed>>
     * }
     */
    public function syncForIntegration(Integration $integration, ?string $sheetUrl = null): array
    {
        $settings = is_array($integration->settings) ? $integration->settings : [];
        $url = trim((string) ($sheetUrl ?? ($settings['sheet_url'] ?? '')));

        if ($url === '') {
            throw new \RuntimeException('Google Sheet URL is required for Meta sheet sync.');
        }

        $rows = $this->fetchGoogleSheetRows($url);

        $imported = 0;
        $skipped = 0;
        $skipReasonCounts = [];
        $skippedRows = [];

        foreach ($rows as $index => $row) {
            $payload = $this->mapRow($row);
            $sheetRowNumber = $index + 2;

            $validation = $this->validateRequiredPayload($payload);
            if (!$validation['valid']) {
                $skipped++;
                $this->incrementReasonCount($skipReasonCounts, 'missing_required_fields');

                if (count($skippedRows) < self::MAX_SKIP_DETAILS) {
                    $skippedRows[] = [
                        'row' => $sheetRowNumber,
                        'reason' => 'missing_required_fields',
                        'missing_fields' => $validation['missing_fields'],
                    ];
                }

                continue;
            }

            $rowLeadId = trim((string) ($row['id'] ?? $row['lead_id'] ?? ''));
            $stableHashSource = $integration->user_id . '|' . json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $externalId = $rowLeadId !== ''
                ? 'meta_sheet_' . $rowLeadId
                : 'meta_sheet_' . sha1((string) $stableHashSource);

            $alreadyExists = LeadInquiry::where('user_id', $integration->user_id)
                ->where('external_id', $externalId)
                ->exists();

            if ($alreadyExists) {
                $skipped++;
                $this->incrementReasonCount($skipReasonCounts, 'duplicate_lead');

                if (count($skippedRows) < self::MAX_SKIP_DETAILS) {
                    $skippedRows[] = [
                        'row' => $sheetRowNumber,
                        'reason' => 'duplicate_lead',
                        'external_id' => $externalId,
                    ];
                }

                continue;
            }

            $leadData = [
                'inquiry_id' => LeadInquiry::generateInquiryId(),
                'user_id' => $integration->user_id,
                'client_name' => $payload['client_name'],
                'client_email' => $payload['client_email'],
                'client_phone' => $payload['client_phone'],
                'destination' => ($payload['destination'] ?? null) ?: 'Social Media Lead',
                'adults' => $payload['adults'],
                'kids_cnb' => $payload['kids_cnb'],
                'kids_5_to_12' => $payload['kids_5_to_12'] ?? 0,
                'start_date' => $payload['start_date'],
                'duration' => $payload['duration'] ?? null,
                'approximate_budget' => $payload['approximate_budget'] ?? null,
                'currency' => 'INR (₹)',
                'special_requests' => $payload['special_requests'] ?? null,
                'status' => 'new',
                'source_url' => $this->formatPlatformSource((string) $payload['platform']),
                'external_id' => $externalId,
                'fb_lead_id' => null,
                'utm_source' => (string) $payload['platform'],
                'notes' => sprintf(
                    'Imported from Meta Google Sheet (row %d) | Platform: %s | Total people: %d',
                    $index + 2,
                    (string) $payload['platform'],
                    (int) $payload['total_people']
                ),
                'ip_address' => null,
                'created_at' => $payload['created_at'],
                'updated_at' => now(),
            ];

            if ($this->hasPaxColumn()) {
                $leadData['pax'] = (string) $payload['total_people'];
            }

            $lead = LeadInquiry::create($leadData);

            $admin = User::where('id', $integration->user_id)->first();
            if ($admin) {
                $admin->notify(new NewLeadArrivedNotification($lead, 'Meta Sheet Import'));
            }

            $imported++;
        }

        return [
            'imported' => $imported,
            'skipped' => $skipped,
            'total' => count($rows),
            'skip_reason_counts' => $skipReasonCounts,
            'skipped_rows' => $skippedRows,
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function fetchGoogleSheetRows(string $sheetUrl): array
    {
        $csvUrl = $this->toGoogleSheetCsvUrl($sheetUrl);

        $response = Http::timeout(30)
            ->withHeaders([
                'Accept' => 'text/csv,text/plain;q=0.9,*/*;q=0.8',
                'User-Agent' => 'ViaItinerary-CRM/1.0',
            ])
            ->get($csvUrl);

        if (!$response->successful()) {
            throw new \RuntimeException('Google Sheet fetch failed with HTTP ' . $response->status() . '. Ensure the sheet is public.');
        }

        $body = (string) $response->body();
        if (trim($body) === '') {
            throw new \RuntimeException('Google Sheet returned an empty response. Ensure the sheet is published and public.');
        }

        if (preg_match('/<html|<!doctype/i', $body) === 1) {
            throw new \RuntimeException('Google Sheet did not return CSV data. Ensure access does not require login.');
        }

        $fp = fopen('php://temp', 'r+');
        fwrite($fp, $body);
        rewind($fp);

        $headers = fgetcsv($fp);
        if (!$headers) {
            fclose($fp);
            throw new \RuntimeException('Could not read header row from Google Sheet CSV.');
        }

        $normalizedHeaders = array_map(fn($h) => $this->normalizeHeader((string) $h), $headers);

        $rows = [];
        while (($values = fgetcsv($fp)) !== false) {
            if (count(array_filter($values, fn($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $row = [];
            foreach ($normalizedHeaders as $i => $header) {
                if ($header === '') {
                    continue;
                }

                $row[$header] = isset($values[$i]) ? trim((string) $values[$i]) : '';
            }

            if ($row) {
                $rows[] = $row;
            }
        }

        fclose($fp);

        return $rows;
    }

    private function toGoogleSheetCsvUrl(string $sheetUrl): string
    {
        $sheetUrl = trim($sheetUrl);
        if ($sheetUrl === '') {
            throw new \RuntimeException('Google Sheet URL is empty.');
        }

        if (str_contains($sheetUrl, 'output=csv') || str_contains($sheetUrl, 'format=csv')) {
            return $sheetUrl;
        }

        if (!preg_match('#/spreadsheets/d/([a-zA-Z0-9_-]+)#', $sheetUrl, $m)) {
            throw new \RuntimeException('Invalid Google Sheet URL. Use docs.google.com/spreadsheets/d/{id}/edit#gid=0 format.');
        }

        $sheetId = $m[1];
        $gid = null;
        $parts = parse_url($sheetUrl);

        if (!empty($parts['query'])) {
            parse_str($parts['query'], $query);
            if (!empty($query['gid'])) {
                $gid = (string) $query['gid'];
            }
        }

        if (!empty($parts['fragment']) && preg_match('/(?:^|&)gid=([0-9]+)/', $parts['fragment'], $fragmentMatch)) {
            $gid = $fragmentMatch[1];
        }

        $base = "https://docs.google.com/spreadsheets/d/{$sheetId}/export?format=csv";

        return $gid !== null ? ($base . '&gid=' . $gid) : $base;
    }

    /**
     * @param array<string, string> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $result = [];

        foreach ($this->fieldMap as $target => $candidates) {
            $value = $this->firstMappedValue($row, $candidates);
            if ($value !== null) {
                $result[$target] = $value;
            }
        }

        if (empty($result['client_name'])) {
            $parts = array_filter([
                trim((string) ($row['first_name'] ?? '')),
                trim((string) ($row['last_name'] ?? '')),
            ]);

            if ($parts) {
                $result['client_name'] = implode(' ', $parts);
            }
        }

        $result['total_people'] = isset($result['total_people']) ? $this->toNullableInt((string) $result['total_people']) : null;
        $result['adults'] = isset($result['adults']) ? $this->toNullableInt((string) $result['adults']) : null;
        $result['kids_cnb'] = isset($result['kids_cnb']) ? $this->toNullableInt((string) $result['kids_cnb']) : null;

        // Calculate total_people from adults + kids_cnb if not provided
        if ($result['total_people'] === null || $result['total_people'] <= 0) {
            $adults = $result['adults'] ?? 0;
            $kids = $result['kids_cnb'] ?? 0;
            if ($adults > 0 || $kids > 0) {
                $result['total_people'] = $adults + $kids;
            }
        }

        $result['kids_5_to_12'] = isset($result['kids_5_to_12']) ? max(0, (int) $result['kids_5_to_12']) : null;
        $result['duration'] = isset($result['duration']) ? max(1, (int) $result['duration']) : null;
        $result['approximate_budget'] = isset($result['approximate_budget']) ? $this->toNullableDecimal((string) $result['approximate_budget']) : null;
        $result['start_date'] = $this->toDateOrNull((string) ($result['start_date'] ?? ''));
        $result['platform'] = isset($result['platform']) ? strtolower(trim((string) $result['platform'])) : null;
        $result['created_at'] = $this->detectCreatedAt($row);

        return $result;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{valid:bool, missing_fields:array<int,string>}
     */
    private function validateRequiredPayload(array $payload): array
    {
        $missingFields = [];

        if (!$this->isFilled($payload['client_name'] ?? null)) {
            $missingFields[] = 'Name';
        }

        if (!$this->isFilled($payload['client_phone'] ?? null)) {
            $missingFields[] = 'Contact';
        }

        if (!$this->isFilled($payload['client_email'] ?? null)) {
            $missingFields[] = 'Email';
        }

        if (!isset($payload['adults']) || (int) $payload['adults'] < 0) {
            $missingFields[] = 'Number of Adults';
        }

        if (!array_key_exists('kids_cnb', $payload) || $payload['kids_cnb'] === null || (int) $payload['kids_cnb'] < 0) {
            $missingFields[] = 'Number of Kids under 5';
        }

        // Ensure at least total_people was calculated or provided
        if (!isset($payload['total_people']) || (int) $payload['total_people'] < 1) {
            $missingFields[] = 'At least one adult or kid under 5';
        }

        if (empty($payload['start_date'])) {
            $missingFields[] = 'Date of Travel';
        }

        if (!$this->isFilled($payload['platform'] ?? null)) {
            $missingFields[] = 'Platform';
        }

        return [
            'valid' => empty($missingFields),
            'missing_fields' => $missingFields,
        ];
    }

    /**
     * @param array<string,int> $reasonCounts
     */
    private function incrementReasonCount(array &$reasonCounts, string $reason): void
    {
        $reasonCounts[$reason] = ($reasonCounts[$reason] ?? 0) + 1;
    }

    /**
     * @param array<string, string> $row
     * @param array<int, string> $candidates
     */
    private function firstMappedValue(array $row, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (!array_key_exists($candidate, $row)) {
                continue;
            }

            $value = trim((string) $row[$candidate]);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function isFilled(?string $value): bool
    {
        return $value !== null && trim($value) !== '';
    }

    private function toNullableInt(string $value): ?int
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $normalized = preg_replace('/[^0-9\-]/', '', $value);
        if ($normalized === null || $normalized === '' || !is_numeric($normalized)) {
            return null;
        }

        return (int) $normalized;
    }

    private function formatPlatformSource(string $platform): string
    {
        $platform = trim($platform);
        if ($platform === '') {
            return 'Google Sheet';
        }

        return ucfirst($platform) . ' (Google Sheet)';
    }

    /**
     * @param array<string, string> $row
     */
    private function detectCreatedAt(array $row): \Carbon\CarbonInterface
    {
        foreach (['created_at', 'created_time', 'submitted_at', 'timestamp', 'date', 'time'] as $key) {
            $value = trim((string) ($row[$key] ?? ''));
            if ($value === '') {
                continue;
            }

            try {
                return now()->parse($value);
            } catch (\Throwable $e) {
                // ignore parse errors and fallback below
            }
        }

        return now();
    }

    private function toDateOrNull(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        try {
            // Try parsing with multiple date formats
            $formats = ['dd-mm-yyyy', 'DD-MM-YYYY', 'Y-m-d', 'Y/m/d', 'd-m-Y', 'd/m/Y', 'd-m-y', 'd/m/y'];
            foreach ($formats as $format) {
                try {
                    return \Carbon\Carbon::createFromFormat($format, $value)->toDateString();
                } catch (\Throwable $e) {
                    continue;
                }
            }
            // Fallback to auto-parsing
            return now()->parse($value)->toDateString();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function toNullableDecimal(string $value): ?float
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $normalized = preg_replace('/[^0-9.\-]/', '', str_replace(',', '', $value));
        if ($normalized === null || $normalized === '' || !is_numeric($normalized)) {
            return null;
        }

        return (float) $normalized;
    }

    private function normalizeHeader(string $header): string
    {
        $header = strtolower(trim($header));
        $header = preg_replace('/[^a-z0-9]+/', '_', $header) ?? '';

        return trim($header, '_');
    }

    private function hasPaxColumn(): bool
    {
        if ($this->hasPaxColumn === null) {
            // The legacy `pax` field was dropped during the schema rework; on a
            // schemaless store we treat it as absent.
            $this->hasPaxColumn = false;
        }

        return $this->hasPaxColumn;
    }
}
