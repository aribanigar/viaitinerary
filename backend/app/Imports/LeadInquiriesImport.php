<?php

namespace App\Imports;

use App\Models\LeadInquiry;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class LeadInquiriesImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    public function __construct(
        private readonly int $adminId,
        private readonly int $assignedTo
    ) {}

    public function model(array $row)
    {
        $clientName = trim((string) ($row['client_name'] ?? $row['name'] ?? ''));
        $clientEmail = trim((string) ($row['client_email'] ?? $row['email'] ?? ''));
        $destination = trim((string) ($row['destination'] ?? ''));

        if ($clientName === '' || $clientEmail === '' || $destination === '') {
            return null;
        }

        $startDateRaw = $row['start_date'] ?? null;
        $startDate = null;

        if (!empty($startDateRaw)) {
            try {
                $startDate = Carbon::parse($startDateRaw)->toDateString();
            } catch (\Throwable $e) {
                $startDate = null;
            }
        }

        $allowedStatuses = ['new', 'contacted', 'quoted', 'converted', 'closed'];
        $status = strtolower(trim((string) ($row['status'] ?? 'new')));
        if (!in_array($status, $allowedStatuses, true)) {
            $status = 'new';
        }

        return LeadInquiry::create([
            'inquiry_id' => LeadInquiry::generateInquiryId(),
            'user_id' => $this->adminId,
            'client_name' => $clientName,
            'client_email' => $clientEmail,
            'client_phone' => trim((string) ($row['client_phone'] ?? $row['phone'] ?? '')) ?: null,
            'destination' => $destination,
            'adults' => (int) ($row['adults'] ?? 1),
            'kids_cnb' => (int) ($row['kids_cnb'] ?? 0),
            'kids_5_to_12' => (int) ($row['kids_5_to_12'] ?? 0),
            'start_date' => $startDate,
            'duration' => !empty($row['duration']) ? (int) $row['duration'] : null,
            'approximate_budget' => is_numeric($row['approximate_budget'] ?? null)
                ? $row['approximate_budget']
                : null,
            'currency' => trim((string) ($row['currency'] ?? 'INR (₹)')) ?: 'INR (₹)',
            'special_requests' => trim((string) ($row['special_requests'] ?? '')) ?: null,
            'status' => $status,
            'notes' => trim((string) ($row['notes'] ?? '')) ?: null,
            'assigned_to' => $this->assignedTo,
            'is_public' => false,
            'source_url' => 'Bulk Lead Import',
        ]);
    }
}
