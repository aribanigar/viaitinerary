<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Payment Receipt - {{ $trip->trip_id }}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');

        @page {
            margin: 0;
        }

        body {
            font-family: 'Montserrat', 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.4;
            background-color: #ffffff;
        }

        * {
            font-family: 'Montserrat', 'Helvetica', 'Arial', sans-serif;
            box-sizing: border-box;
        }

        table,
        td,
        th {
            font-family: 'Montserrat', 'Helvetica', 'Arial', sans-serif;
        }

        .pdf-symbol {
            font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif !important;
            font-weight: 400 !important;
            font-style: normal;
            display: inline-block;
            line-height: 1;
        }

        .currency-symbol {
            font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif !important;
            display: inline-block;
            line-height: 1;
            margin-right: 3px;
            vertical-align: middle;
            white-space: nowrap;
            text-transform: none;
            font-weight: 400 !important;
            font-style: normal !important;
        }

        /* Variables */
        .color-primary {
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
        }

        .bg-primary {
            background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
        }

        .bg-dark-green {
            background-color: {{ $agencySettings?->secondary_color ?? '#0D2D2D' }};
        }

        .color-dark-green {
            color: {{ $agencySettings?->secondary_color ?? '#0D2D2D' }};
        }

        .page {
            width: 210mm;
            height: 297mm;
            position: relative;
            background-color: #0D2D2D;
            overflow: hidden;
        }

        /* Header Labels */
        .orange-header-label {
            background: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            color: white;
            padding: 12px 30px 12px 40px;
            display: inline-block;
            width: auto;
            min-width: 180px;
            max-width: 500px;
            border-bottom-right-radius: 40px;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 100;
        }

        .header-logo {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
        }

        .agency-name-fallback h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            line-height: 1.1;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .agency-name-fallback p {
            margin: 0;
            font-size: 8px;
            font-weight: 600;
            letter-spacing: 1.2px;
            line-height: 1;
            white-space: nowrap;
        }

        /* Hero Areas */
        .hero-section {
            height: 140px;
            width: 100%;
            background-color: {{ $agencySettings?->secondary_color ?? '#0D2D2D' }};
            position: relative;
            overflow: hidden;
        }

        .hero-pattern {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.05;
            background-image: radial-gradient(#ffffff 1px, transparent 1px);
            background-size: 20px 20px;
        }

        .hero-content {
            padding-top: 85px;
            text-align: center;
            color: white;
            z-index: 2;
        }

        .hero-content h1 {
            font-size: 36px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 4px;
        }

        .hero-content p {
            font-size: 12px;
            letter-spacing: 3px;
            font-weight: 600;
            margin: 5px 0 0;
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
        }

        /* Content Area */
        .content-area {
            color: white;
            padding: 30px 45px;
            position: relative;
        }

        .receipt-banner {
            background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            color: white;
            text-align: center;
            padding: 5px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 15px;
        }

        .info-grid {
            width: 100%;
            margin-top: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 15px;
        }

        .info-cell {
            padding: 5px 0;
        }

        .info-label {
            font-size: 9px;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.6);
            letter-spacing: 1px;
            margin-bottom: 2px;
        }

        .info-value {
            font-size: 14px;
            font-weight: 500;
        }

        /* Table Styling */
        .receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .receipt-table th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.6);
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 8px;
        }

        .receipt-table td {
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .item-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 2px;
        }

        .item-sub {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
        }

        .total-box {
            display: inline-block;
            background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            padding: 15px 30px;
            border-radius: 4px;
            margin-top: 15px;
        }

        .total-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .total-amount {
            font-size: 24px;
            font-weight: 800;
            line-height: 1;
        }

        .total-amount .currency-symbol {
            font-size: 20px;
            margin-right: 2px;
        }

        /* Footer Decoration */
        .footer-note {
            margin-top: 30px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-left: 3px solid {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-size: 12px;
            font-style: italic;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
        }

        .footer-wrapper {
            position: absolute;
            bottom: 20px;
            left: 45px;
            right: 45px;
        }

        .footer-line {
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
            margin-bottom: 10px;
        }

        .footer-table {
            width: 100%;
            font-size: 11px;
            color: white;
            opacity: 0.8;
        }
    </style>
</head>

<body>
    <div class="page">
        <!-- Agency Header -->
        <div class="orange-header-label">
            @if ($logoBase64 ?? false)
                <img src="{{ $logoBase64 }}" class="header-logo">
            @elseif($agencySettings?->logo_url)
                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
            @else
                <div class="agency-name-fallback">
                    <h1>{{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</h1>
                    <p>TRAVEL SIMPLIFIED</p>
                </div>
            @endif
        </div>

        <!-- Hero Section -->
        <div class="hero-section">
            <div class="hero-pattern"></div>
            <div class="hero-content">
                <h1>PAYMENT RECEIVED</h1>
                <p>TRANSACTION RECEIPT BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</p>
            </div>
        </div>

        <div class="receipt-banner">
            Official Payment Confirmation & Acknowledgement Receipt
        </div>

        <div class="content-area">

            @php
                $currencySymbol = trim((string) ($trip->currency_symbol ?? '₹'));
                // Guard against empty/legacy invalid symbols from old records.
                if ($currencySymbol === '' || $currencySymbol === '?') {
                    $currencySymbol = '₹';
                }
                $currencyPrefix = $currencySymbol;
            @endphp

            <table class="info-grid" style="width: 100%;">
                <tr>
                    <td width="50%" class="info-cell">
                        <div class="info-label">Receipt Number</div>
                        <div class="info-value" style="color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};">
                            #{{ strtoupper(substr($trip->trip_id, 0, 8)) }}-{{ date('YmdHi') }}
                        </div>
                    </td>
                    <td width="50%" class="info-cell">
                        <div class="info-label">Date of Payment</div>
                        <div class="info-value">{{ date('d F Y') }}</div>
                    </td>
                </tr>
                <tr>
                    <td class="info-cell">
                        <div class="info-label">Guest Name</div>
                        <div class="info-value">{{ $trip->client_name }}</div>
                    </td>
                    <td class="info-cell">
                        <div class="info-label">Tour Duration</div>
                        <div class="info-value">{{ $trip->duration }} Nights / {{ $trip->duration + 1 }} Days</div>
                    </td>
                </tr>
            </table>

            <table class="receipt-table">
                <thead>
                    <tr>
                        <th width="55%">Description</th>
                        <th width="15%" style="text-align: center;">Qty</th>
                        <th width="35%" style="text-align: right;">Paid / Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td width="50%">
                            <div class="item-title">{{ $trip->trip_title }}</div>
                            <div class="item-sub">{{ $trip->destination }} | ID: #{{ $trip->trip_id }}</div>
                        </td>
                        <td width="15%" style="text-align: center; vertical-align: middle; white-space: nowrap;">
                            {{ $trip->adults }} Adults
                            @php
                                $kidsCountTotal =
                                    ($trip->kids_cnb ?? ($trip->kids_upto_5 ?? 0)) + ($trip->kids_5_to_12 ?? 0);
                            @endphp
                            {{ $kidsCountTotal > 0 ? '+ ' . $kidsCountTotal . ' Kids' : '' }}
                        </td>
                        <td width="35%" style="text-align: right; vertical-align: middle; white-space: nowrap;">
                            <span style="font-size: 14px; font-weight: 700;">
                                <span
                                    class="currency-symbol">{{ $currencyPrefix }}</span>{{ number_format($trip->paid_amount, 2) }}
                            </span>
                            <span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-left: 5px;">
                                / <span
                                    class="currency-symbol">{{ $currencyPrefix }}</span>{{ number_format($trip->cost, 2) }}
                            </span>
                        </td>
                    </tr>
                    @if (($trip->gst_amount ?? 0) > 0)
                        <tr>
                            <td>
                                <div class="item-title">GST / Taxes</div>
                                <div class="item-sub">Applicable government taxes</div>
                            </td>
                            <td style="text-align: center;">-</td>
                            <td style="text-align: right;">
                                <span
                                    class="currency-symbol">{{ $currencyPrefix }}</span>{{ number_format($trip->gst_amount, 2) }}
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>

            @if (isset($payments) && $payments->count() > 0)
                <div
                    style="margin-top: 30px; margin-bottom: 10px; font-size: 13px; font-weight: 700; color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; text-transform: uppercase; letter-spacing: 1px;">
                    Payment History</div>
                <table class="receipt-table" style="margin-top: 0;">
                    <thead>
                        <tr>
                            <th width="30%">Date</th>
                            <th width="45%">Method</th>
                            <th width="25%" style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($payments as $payment)
                            <tr>
                                <td style="font-size: 12px;">
                                    {{ $payment->payment_date ? $payment->payment_date->format('d M Y') : '-' }}</td>
                                <td style="font-size: 12px; text-transform: capitalize;">{{ $payment->payment_method }}
                                </td>
                                <td style="text-align: right; font-weight: 600;">
                                    <span
                                        class="currency-symbol pdf-symbol">{{ $currencyPrefix }}</span>{{ number_format($payment->amount, 2) }}
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif

            <div style="text-align: right; margin-top: 30px;">
                <div class="total-box">
                    <div class="total-label" style="color: white;">Transaction Receipt For</div>
                    <div class="total-amount" style="color: white;">
                        <span
                            class="currency-symbol pdf-symbol">{{ $currencyPrefix }}</span>{{ number_format($paymentAmount ?? 0, 2) }}
                    </div>
                </div>
            </div>

            <div class="footer-note">
                <strong>Important Note:</strong> Please carry a valid government-issued photo ID for all guests. For any
                assistance during your travel, please contact our support team at
                @php
                    $phone = $agencySettings?->contact_phone ?? 'the numbers below';
                    if ($phone !== 'the numbers below') {
                        // Strip all non-numeric characters to get clean number
                        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
                        if (strlen($cleanPhone) >= 10) {
                            // Format: +91 86051-499 or similar
                            $mainNumber = substr($cleanPhone, -10);
                            $countryCode =
                                strlen($cleanPhone) > 10
                                    ? '+' . substr($cleanPhone, 0, strlen($cleanPhone) - 10) . ' '
                                    : '';
                            $phone = $countryCode . substr($mainNumber, 0, 5) . '-' . substr($mainNumber, 5);
                        }
                    }
                @endphp
                @php
                    $voucherNote =
                        'Please carry a valid government-issued photo ID for all guests. For any assistance during your travel, please contact our support team at {agencyPhone}. We wish you a pleasant journey!';
                    $voucherNote = str_replace(
                        ['{agencyName}', '{clientName}', '{tripId}', '{agencyPhone}'],
                        [
                            $agencySettings?->agency_name ?? 'Travel Agency',
                            $trip->client_name ?? 'Guest',
                            $trip->trip_id ?? 'N/A',
                            $phone,
                        ],
                        $voucherNote,
                    );
                @endphp
                {!! nl2br(e($voucherNote)) !!}
            </div>
        </div>

        <div class="footer-wrapper">
            <div class="footer-line"></div>
            <table class="footer-table">
                <tr>
                    <td width="33%">{{ $agencySettings?->contact_email }}</td>
                    <td width="34%" align="center">
                        @php
                            $wa = $agencySettings?->whatsapp ?? $agencySettings?->contact_phone;
                            if ($wa) {
                                $cleanWa = preg_replace('/[^0-9]/', '', $wa);
                                if (strlen($cleanWa) >= 10) {
                                    $mn = substr($cleanWa, -10);
                                    $cc =
                                        strlen($cleanWa) > 10
                                            ? '+' . substr($cleanWa, 0, strlen($cleanWa) - 10) . ' '
                                            : '';
                                    $wa = $cc . substr($mn, 0, 5) . '-' . substr($mn, 5);
                                }
                            }
                        @endphp
                        <b>{{ $wa }}</b>
                    </td>
                    <td width="33%" align="right">{{ $agencySettings?->website }}</td>
                </tr>
            </table>
        </div>
    </div>
</body>

</html>
