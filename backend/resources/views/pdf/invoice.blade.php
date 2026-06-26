    <!DOCTYPE html>
    <html lang="en">

    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Trip Invoice - {{ $trip->trip_id }}</title>
        <style type="text/css">
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');

            @page {
                margin: 0;
            }

            body {
                font-family: 'Montserrat', 'DejaVu Sans', 'Helvetica', 'Arial', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f0ece4;
                color: #191c1d;
                line-height: 1.4;
            }

            .glyph-font {
                font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif;
            }

            .pdf-symbol {
                font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif !important;
                font-weight: 400 !important;
                font-style: normal;
                display: inline-block;
                text-transform: none;
            }

            * {
                box-sizing: border-box;
            }

            .header {
                background-color: {{ $agencySettings?->secondary_color ?? '#0e3d2f' }};
                padding: 25px 40px;
                color: #ffffff;
            }

            .header-table {
                width: 100%;
                border-collapse: collapse;
            }

            .agency-logo-container {
                background-color: #ffffff;
                padding: 10px;
                border-radius: 8px;
                display: inline-block;
                margin-bottom: 10px;
            }

            .agency-logo {
                max-height: 60px;
                max-width: 200px;
                display: block;
            }

            .agency-name {
                font-size: 22px;
                font-weight: 900;
                margin: 0;
                letter-spacing: -0.01em;
            }

            .agency-info {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                margin: 2px 0;
            }

            .status-badge {
                background-color: {{ $agencySettings?->brand_color ?? '#6effc2' }};
                color: #041a10;
                padding: 5px 16px;
                border-radius: 99px;
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 2px;
                display: inline-block;
                margin-bottom: 10px;
            }

            .status-badge-content {
                display: inline-table;
                line-height: 1;
            }

            .status-badge-icon {
                display: table-cell;
                vertical-align: middle;
                font-size: 13px;
                padding-right: 4px;
            }

            .status-badge-text {
                display: table-cell;
                vertical-align: middle;
                line-height: 1;
            }

            .status-badge .pdf-symbol {
                line-height: 1;
            }

            .invoice-meta {
                text-align: right;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }

            .invoice-meta strong {
                color: #ffffff;
            }

            .divider-gold {
                height: 3px;
                background-color: {{ $agencySettings?->brand_color ?? '#c8a84b' }};
            }

            .content-section {
                background-color: #ffffff;
                padding: 20px 40px;
            }

            .section-label {
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 3px;
                text-transform: uppercase;
                color: {{ $agencySettings?->brand_color ?? '#c8a84b' }};
                margin-bottom: 15px;
            }

            .info-grid {
                width: 100%;
                border-collapse: collapse;
            }

            .info-cell {
                vertical-align: top;
                padding-bottom: 5px;
            }

            .info-label {
                font-size: 11px;
                color: #aaa;
                width: 100px;
            }

            .info-value {
                font-size: 12px;
                font-weight: 700;
                color: #191c1d;
            }

            .package-details {
                padding: 20px 40px;
                background-color: #ffffff;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .package-table {
                width: 100%;
                border-collapse: collapse;
            }

            .package-column {
                width: 50%;
                vertical-align: top;
            }

            .inclusion-item {
                font-size: 11px;
                color: #444;
                margin-bottom: 6px;
            }

            .inclusion-icon {
                color: #1a6649;
                margin-right: 5px;
            }

            .exclusion-icon {
                color: #b91c1c;
                margin-right: 5px;
            }

            .cost-section {
                background-color: #f0ece4;
                padding: 20px 40px;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .bookings-section {
                background-color: #ffffff;
                padding: 20px 40px;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .booking-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e4e0d8;
            }

            .booking-table th,
            .booking-table td {
                border-bottom: 1px solid #ede8df;
                padding: 6px 12px;
                font-size: 11px;
                text-align: left;
                vertical-align: top;
            }

            .booking-table th {
                background-color: #f8f5ef;
                color: #4b5563;
                font-weight: 800;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }

            .booking-type {
                font-weight: 700;
                color: #0e3d2f;
            }

            .cost-card {
                background-color: #ffffff;
                border-radius: 14px;
                border: 1px solid #e4e0d8;
                padding: 24px;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .line-item {
                width: 100%;
                margin-bottom: 8px;
                font-size: 12px;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .line-item-label {
                color: #555;
            }

            .line-item-value {
                text-align: right;
                font-weight: 600;
            }

            .cost-divider {
                height: 1px;
                background-color: #f0ece4;
                margin: 15px 0;
            }

            .total-box {
                background-color: {{ $agencySettings?->secondary_color ?? '#0e3d2f' }};
                color: #ffffff;
                border-radius: 10px;
                padding: 15px 20px;
                margin-top: 15px;
            }

            .total-label {
                font-size: 13px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.7);
            }

            .total-amount {
                font-size: 32px;
                font-weight: 900;
                color: {{ $agencySettings?->brand_color ?? '#6effc2' }};
                text-align: right;
                line-height: 1;
            }

            .total-amount-wrap {
                display: inline-table;
            }

            .total-amount .pdf-symbol {
                display: table-cell;
                vertical-align: middle;
                font-size: 24px;
                padding-right: 2px;
                line-height: 1;
            }

            .total-amount-value {
                display: table-cell;
                vertical-align: middle;
                line-height: 1;
            }

            .payment-status-section {
                padding: 24px 40px;
                background-color: #ffffff;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .payment-grid {
                width: 100%;
                border-collapse: separate;
                border-spacing: 10px 0;
            }

            .payment-card {
                padding: 14px 16px;
                border-radius: 10px;
                border: 1px solid #e4e0d8;
            }

            .payment-badge-paid {
                background-color: #f0f7f3;
                border-color: #d0e8d8;
            }

            .payment-badge-due {
                background-color: #fff8e0;
                border-color: #f5d87a;
            }

            .important-notes {
                padding: 26px 40px;
                background-color: #f0ece4;
                font-size: 11px;
                color: #555;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .note-item {
                margin-bottom: 8px;
                position: relative;
                padding-left: 15px;
            }

            .note-bullet {
                position: absolute;
                left: 0;
                color: {{ $agencySettings?->brand_color ?? '#c8a84b' }};
            }

            .footer {
                background-color: {{ $agencySettings?->secondary_color ?? '#0e3d2f' }};
                padding: 30px 40px;
                color: #ffffff;
            }

            .footer-table {
                width: 100%;
            }

            .whatsapp-button {
                background-color: rgba(110, 255, 194, 0.1);
                border: 1px solid rgba(110, 255, 194, 0.25);
                border-radius: 8px;
                padding: 8px 16px;
                color: #6effc2;
                font-weight: 700;
                text-decoration: none;
                display: inline-block;
            }
        </style>
    </head>

    <body>

        <div class="header">
            <table class="header-table">
                <tr>
                    <td width="60%">
                        @if ($logoBase64)
                            <div class="agency-logo-container">
                                <img src="{{ $logoBase64 }}" class="agency-logo" alt="Logo">
                            </div>
                        @else
                            <div class="agency-name">{{ $agencySettings?->agency_name ?? 'Travel Agency' }}</div>
                        @endif
                        <div class="agency-info">Kashmir Tour & Travel</div>
                        <div class="agency-info">{{ $agencySettings?->contact_email }}</div>
                        <div class="agency-info">{{ $agencySettings?->contact_phone }}</div>
                    </td>
                    <td width="40%" style="text-align: right; vertical-align: top;">
                        <div class="status-badge">
                            <span class="status-badge-content">
                                <span class="pdf-symbol status-badge-icon">&#10003;</span>
                                <span class="status-badge-text">Trip Confirmed</span>
                            </span>
                        </div>
                        <div class="invoice-meta">Invoice No:
                            <strong>#INV-{{ strtoupper(substr($trip->trip_id, 0, 8)) }}</strong>
                        </div>
                        <div class="invoice-meta">Date: <strong>{{ date('d M Y') }}</strong></div>
                        <div class="invoice-meta" style="margin-top: 5px;">Powered by <strong
                                style="color: {{ $agencySettings?->brand_color ?? '#6effc2' }};">ViaKashmir
                                Itinerary</strong></div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="divider-gold"></div>

        <div class="content-section">
            <div class="section-label">Client Details</div>
            <table class="info-grid">
                <tr>
                    <td class="info-cell" width="50%">
                        <table width="100%">
                            <tr>
                                <td class="info-label">Client Name</td>
                                <td class="info-value">{{ $trip->client_name }}</td>
                            </tr>
                            <tr>
                                <td class="info-label">Phone</td>
                                <td class="info-value">{{ $trip->client_phone ?? 'N/A' }}</td>
                            </tr>
                            <tr>
                                <td class="info-label">Email</td>
                                <td class="info-value">{{ $trip->client_email ?? 'N/A' }}</td>
                            </tr>
                        </table>
                    </td>
                    <td class="info-cell" width="50%" style="padding-left: 20px; border-left: 1px solid #f0ece4;">
                        <table width="100%">
                            <tr>
                                <td class="info-label">Travel Dates</td>
                                <td class="info-value">{{ \Carbon\Carbon::parse($trip->start_date)->format('d M') }} —
                                    {{ \Carbon\Carbon::parse($trip->start_date)->addDays((int) $trip->duration)->format('d M Y') }}
                                </td>
                            </tr>
                            <tr>
                                <td class="info-label">Duration</td>
                                <td class="info-value">{{ $trip->duration }} Nights / {{ $trip->duration + 1 }} Days
                                </td>
                            </tr>
                            <tr>
                                <td class="info-label">Travellers</td>
                                <td class="info-value">{{ $trip->adults }}
                                    Adults{{ ($trip->kids_cnb ?? 0) + ($trip->kids_5_to_12 ?? 0) > 0 ? ', ' . (($trip->kids_cnb ?? 0) + ($trip->kids_5_to_12 ?? 0)) . ' Child' : '' }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>

        <div class="divider-gold"></div>

        @php
            $formatBookingDate = static function ($value): ?string {
                if (empty($value)) {
                    return null;
                }

                try {
                    if ($value instanceof \Carbon\CarbonInterface) {
                        return $value->format('d M Y');
                    }

                    return \Carbon\Carbon::parse($value)->format('d M Y');
                } catch (\Throwable $e) {
                    return null;
                }
            };

            $hotelRows = [];
            foreach ($trip->accommodations ?? [] as $accommodation) {
                $hotelName = trim((string) ($accommodation->hotel->name ?? 'Hotel'));
                $checkInDate = $formatBookingDate($accommodation->check_in ?? null);
                $checkOutDate = $formatBookingDate($accommodation->check_out ?? null);

                if ($hotelName === '' && !$checkInDate && !$checkOutDate) {
                    continue;
                }

                $dateLabel = 'N/A';
                $sortKey = PHP_INT_MAX;

                if ($checkInDate && $checkOutDate) {
                    $dateLabel = "{$checkInDate} to {$checkOutDate}";
                    $sortKey = \Carbon\Carbon::parse($accommodation->check_in)->timestamp;
                } elseif ($checkInDate) {
                    $dateLabel = $checkInDate;
                    $sortKey = \Carbon\Carbon::parse($accommodation->check_in)->timestamp;
                } elseif ($checkOutDate) {
                    $dateLabel = $checkOutDate;
                    $sortKey = \Carbon\Carbon::parse($accommodation->check_out)->timestamp;
                }

                $hotelRows[] = [
                    'date' => $dateLabel,
                    'name' => $hotelName,
                    'rooms' => $accommodation->rooms ?? 'N/A',
                    'meal_plan' => $accommodation->meal_plan ?? 'N/A',
                    'sort_key' => $sortKey,
                ];
            }

            usort($hotelRows, static function (array $a, array $b): int {
                return $a['sort_key'] <=> $b['sort_key'];
            });

            $cabRows = [];
            foreach ($trip->transportations ?? [] as $transportation) {
                $cabName = trim(
                    (string) ($transportation->vehicle->name ??
                        ($transportation->vehicle_type ?? ($transportation->type ?? 'Cab'))),
                );
                $cabDate = $formatBookingDate($transportation->date ?? null);

                if ($cabName === '' && !$cabDate) {
                    continue;
                }

                $cabRows[] = [
                    'date' => $cabDate ?? 'N/A',
                    'name' => $cabName,
                    'details' => $transportation->remarks ?? 'Booked for you',
                    'sort_key' => $cabDate ? \Carbon\Carbon::parse($transportation->date)->timestamp : PHP_INT_MAX,
                ];
            }

            usort($cabRows, static function (array $a, array $b): int {
                return $a['sort_key'] <=> $b['sort_key'];
            });
        @endphp

        @if (count($hotelRows) > 0 || count($cabRows) > 0)
            <div class="bookings-section">
                @if (count($hotelRows) > 0)
                    <div class="section-label">Hotel Bookings</div>
                    <table class="booking-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th width="25%">Date</th>
                                <th width="35%">Hotel Name</th>
                                <th width="20%">Rooms</th>
                                <th width="20%">Meal Plan</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($hotelRows as $row)
                                <tr>
                                    <td>{{ $row['date'] }}</td>
                                    <td class="booking-type">{{ $row['name'] }}</td>
                                    <td>{{ $row['rooms'] }}</td>
                                    <td>{{ $row['meal_plan'] }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif

                @if (count($cabRows) > 0)
                    <div class="section-label">Vehicle Bookings</div>
                    <table class="booking-table">
                        <thead>
                            <tr>
                                <th width="25%">Date</th>
                                <th width="35%">Vehicle</th>
                                <th width="40%">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($cabRows as $row)
                                <tr>
                                    <td>{{ $row['date'] }}</td>
                                    <td class="booking-type">{{ $row['name'] }}</td>
                                    <td>{{ $row['details'] }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif
            </div>

            <div class="divider-gold"></div>
        @endif

        <div class="cost-section">
            <h2
                style="font-size: 20px; font-weight: 800; color: {{ $agencySettings?->secondary_color ?? '#0e3d2f' }}; margin: 0 0 18px 0;">
                Billing Summary</h2>

            <div class="cost-card"
                style="background-color: {{ $agencySettings?->secondary_color ?? '#0e3d2f' }}; padding: 30px;">
                @php
                    $parseAmount = static function ($value): float {
                        if (is_numeric($value)) {
                            return (float) $value;
                        }

                        if (is_string($value)) {
                            $normalized = preg_replace('/[^\d.\-]/', '', $value);
                            return is_numeric($normalized) ? (float) $normalized : 0.0;
                        }

                        return 0.0;
                    };

                    $tripTotal = $parseAmount($trip->cost ?? 0);
                @endphp

                <table width="100%">
                    <tr>
                        <td>
                            <div style="font-size: 14px; font-weight: 700; color: rgba(255, 255, 255, 0.7);">Total
                                Amount</div>
                            <div style="font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 4px;">
                                Inclusive of all applicable taxes
                            </div>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <div class="total-amount">
                                <span class="total-amount-wrap">
                                    <span class="pdf-symbol">₹</span>
                                    <span class="total-amount-value">{{ number_format($tripTotal) }}</span>
                                </span>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        @php
            $extractPolicyText = static function ($item): string {
                if (is_string($item)) {
                    return trim($item);
                }

                if (is_array($item)) {
                    return trim((string) ($item['content'] ?? ($item['text'] ?? ($item['name'] ?? ''))));
                }

                if (is_object($item)) {
                    return trim((string) ($item->content ?? ($item->text ?? ($item->name ?? ''))));
                }

                return '';
            };

            $inclusionItems = [];
            foreach ($trip->inclusions ?? [] as $inclusionItem) {
                $text = $extractPolicyText($inclusionItem);
                if ($text !== '') {
                    $inclusionItems[] = $text;
                }
            }

            $exclusionItems = [];
            foreach ($trip->exclusions ?? [] as $exclusionItem) {
                $text = $extractPolicyText($exclusionItem);
                if ($text !== '') {
                    $exclusionItems[] = $text;
                }
            }

            $hasPackageDetails = count($inclusionItems) > 0 || count($exclusionItems) > 0;
        @endphp

        @if ($hasPackageDetails)
            <div class="package-details">
                <div class="section-label">Package Details</div>
                <table class="package-table">
                    <tr>
                        <td class="package-column" style="padding-right: 16px;">
                            <div style="font-size: 11px; font-weight: 800; color: #0e3d2f; margin-bottom: 5px;"><span
                                    class="pdf-symbol">&#10003;</span> Included
                            </div>
                            @forelse ($inclusionItems as $inclusion)
                                <div class="inclusion-item" style="margin-bottom: 4px;"><span
                                        class="inclusion-icon glyph-font"
                                        style="font-size: 10px;">&#10003;</span>{{ $inclusion }}
                                </div>
                            @empty
                                <div class="inclusion-item" style="color: #9ca3af;">No inclusions added</div>
                            @endforelse
                        </td>
                        <td class="package-column" style="padding-left: 16px; border-left: 1px solid #f0ece4;">
                            <div style="font-size: 11px; font-weight: 800; color: #b91c1c; margin-bottom: 5px;"><span
                                    class="pdf-symbol">&#10005;</span> Not
                                Included
                            </div>
                            @forelse ($exclusionItems as $exclusion)
                                <div class="inclusion-item" style="margin-bottom: 4px;"><span
                                        class="exclusion-icon glyph-font"
                                        style="font-size: 10px;">&#10005;</span>{{ $exclusion }}
                                </div>
                            @empty
                                <div class="inclusion-item" style="color: #9ca3af;">No exclusions added</div>
                            @endforelse
                        </td>
                    </tr>
                </table>
            </div>
        @endif

        @php
            $invoiceNotesRaw =
                "Carry valid government-issued photo ID for all travellers.\nBalance payment must be cleared before departure date.\nItinerary is subject to change due to weather or road conditions.\nCancellation policy as per agency terms and conditions.";
            $invoiceNotesRaw = str_replace(
                ['{agencyName}', '{clientName}', '{tripId}'],
                [
                    $agencySettings?->agency_name ?? 'Travel Agency',
                    $trip->client_name ?? 'Guest',
                    $trip->trip_id ?? 'N/A',
                ],
                $invoiceNotesRaw,
            );
            $invoiceNotes = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $invoiceNotesRaw))));
        @endphp

        <div class="important-notes">
            <div class="section-label" style="color: #888;">Important Notes</div>
            @foreach ($invoiceNotes as $note)
                <div class="note-item"><span class="note-bullet glyph-font">&bull;</span> {{ $note }}</div>
            @endforeach
        </div>

        <div class="footer">
            <table class="footer-table">
                <tr>
                    <td width="55%">
                        <div style="font-size: 13px; font-weight: 800; margin-bottom: 8px;">
                            {{ $agencySettings?->agency_name ?? 'Travel Agency' }}</div>
                        <div class="agency-info">{{ $agencySettings?->contact_email }}</div>
                        <div class="agency-info">{{ $agencySettings?->contact_phone }}</div>
                        <div class="agency-info">{{ $agencySettings?->website }}</div>
                    </td>
                    <td width="45%" style="text-align: right;">
                        <div style="font-size: 10px; color: rgba(255, 255, 255, 0.35); margin-bottom: 6px;">For any
                            queries
                        </div>
                        <a href="https://wa.me/{{ preg_replace('/[^0-9]/', '', $agencySettings?->whatsapp ?? $agencySettings?->contact_phone) }}"
                            class="whatsapp-button">WhatsApp Us</a>
                        <div style="font-size: 10px; color: rgba(255, 255, 255, 0.3); margin-top: 8px;">
                            {{ $agencySettings?->contact_phone }}</div>
                    </td>
                </tr>
            </table>
        </div>

    </body>

    </html>
