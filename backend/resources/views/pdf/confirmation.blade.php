<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Booking Confirmation - {{ $trip->trip_id }}</title>
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
        }

        table,
        td,
        th {
            font-family: 'Montserrat', 'Helvetica', 'Arial', sans-serif;
        }

        .currency-symbol {
            font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif !important;
            display: inline-block;
            line-height: 1;
            margin-right: 1px;
            vertical-align: middle;
        }

        /* Variables mapped from TripPreview.jsx */
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

        .bg-header-green {
            background-color: {{ $agencySettings?->secondary_color ?? '#4A6763' }};
        }

        .bg-light {
            background-color: #FDF9F0;
        }

        .page {
            width: 210mm;
            height: 297mm;
            position: relative;
            background-repeat: no-repeat;
            page-break-after: avoid;
        }

        .page-last {
            page-break-after: avoid;
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
        }

        .orange-header-label h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            line-height: 1.1;
            text-transform: uppercase;
            margin-bottom: 2px;
            white-space: nowrap;
        }

        .orange-header-label p {
            margin: 0;
            font-size: 8px;
            font-weight: 600;
            letter-spacing: 1.2px;
            line-height: 1;
            white-space: nowrap;
        }

        .header-logo {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
        }

        /* Hero Areas */
        .hero-cover {
            height: 380px;
            width: 100%;
            position: relative;
            overflow: hidden;
        }

        .hero-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
        }

        .hero-label {
            position: absolute;
            bottom: 25px;
            width: 100%;
            text-align: center;
            color: white;
        }

        .hero-label h1 {
            font-size: 42px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
        }

        .hero-label p {
            font-size: 13px;
            letter-spacing: 2px;
            font-weight: 600;
            margin: 3px 0 0;
        }

        .hero-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            z-index: 1;
        }

        .hero-label {
            position: absolute;
            bottom: 25px;
            width: 100%;
            text-align: center;
            color: white;
            z-index: 2;
        }

        /* Cover Content */
        .cover-content {
            background: #0D2D2D;
            color: white;
            padding: 30px 45px 80px 45px;
            position: relative;
        }

        .cover-content h2 {
            font-size: 19px;
            margin-top: 0;
            margin-bottom: 12px;
            font-weight: 500;
        }

        .booking-details-list {
            margin: 15px 0;
            padding: 0;
            list-style: none;
        }

        .booking-details-list li {
            margin-bottom: 6px;
            font-size: 14px;
            position: relative;
            padding-left: 15px;
        }

        .booking-details-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: white;
        }

        .payment-section {
            margin-top: 20px;
        }

        .payment-section h3 {
            font-size: 15px;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .payment-details-list {
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .payment-details-list li {
            margin-bottom: 4px;
            font-size: 14px;
            position: relative;
            padding-left: 15px;
        }

        .payment-details-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: white;
        }

        .footer-note {
            margin-top: 15px;
            font-size: 13px;
            line-height: 1.4;
            max-width: 85%;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        /* Decoration */
        .decoration-curve {
            position: absolute;
            top: 20px;
            right: 40px;
            width: 80px;
            opacity: 0.6;
        }

        .footer-character {
            position: absolute;
            bottom: 60px;
            right: 20px;
            width: 150px;
            z-index: 10;
        }

        .footer-bottom-curve {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 120px;
            height: 40px;
            background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            border-top-left-radius: 60px;
            z-index: 10;
        }

        /* Footer */
        .footer-line {
            height: 1px;
            background: #eee;
            margin: 5px 0;
            width: 100%;
        }

        .footer-table {
            width: 100%;
            font-size: 11px;
            color: #444;
        }

        .footer-wrapper {
            position: absolute;
            bottom: 15px;
            left: 45px;
            right: 45px;
            z-index: 20;
        }

        /* Decoration */
        .decoration {
            position: absolute;
            top: 520px;
            right: 50px;
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-size: 60px;
            opacity: 0.2;
            transform: rotate(-15deg);
        }
    </style>
</head>

<body>
    <!-- PAGE 1: COVER (CONFIRMATION) -->
    <div class="page" style="background-color: #0D2D2D; min-height: 297mm; height: auto;">
        <div class="orange-header-label" style="position: absolute; top: 0; left: 0; z-index: 100;">
            @if ($logoBase64)
                <img src="{{ $logoBase64 }}" class="header-logo">
            @elseif($agencySettings?->logo_url)
                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
            @else
                <h1>{{ strtoupper($agencySettings?->agency_name ?? 'VIAITINERARY') }}</h1>
                <p>TRAVEL SIMPLIFIED</p>
            @endif
        </div>

        @php
            $coverImage =
                $heroImageBase64 ?:
                ($tripImageBase64 ?:
                ($trip->image_path
                    ? $trip->image_url
                    : 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&q=80&w=1000'));
        @endphp

        <div class="hero-cover">
            @if ($coverImage)
                <img src="{{ $coverImage }}" alt="Trip cover" class="hero-image" />
            @endif
            <div class="hero-overlay"></div>
            <div class="hero-label">
                <h1>BOOKING CONFIRMED</h1>
                <p>TRAVEL CONFIRMATION RECEIPT BY {{ strtoupper($agencySettings?->agency_name ?? 'VIAITINERARY') }}</p>
            </div>
        </div>

        <div
            style="background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; color: white; text-align: center; padding: 8px; font-size: 9px; font-weight: 700;">
            BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES
        </div>

        <div class="cover-content">
            <!-- Top Right Decoration Curve -->
            <svg class="decoration-curve" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 10C30 50 70 50 90 90" stroke="{{ $agencySettings?->brand_color ?? '#FAA61A' }}"
                    stroke-width="2" stroke-linecap="round" />
                <path d="M20 10C40 50 80 50 100 90" stroke="{{ $agencySettings?->brand_color ?? '#FAA61A' }}"
                    stroke-width="2" stroke-linecap="round" />
            </svg>

            <p style="margin: 0; opacity: 0.9; font-size: 13px; line-height: 1.5;">
                <span style="white-space: pre-line;">{!! $confirmationMessage !!}</span>
            </p>

            <div style="margin-top: 15px;">
                <div style="font-size: 14px; margin-bottom: 3px;">Below are the confirmed details of your booking:</div>
                <ul class="booking-details-list">
                    <li><b>Itinerary ID:</b> #{{ $trip->trip_id }}</li>
                    <li><b>Travel Dates:</b>
                        @if ($trip->start_date)
                            {{ \Carbon\Carbon::parse($trip->start_date)->format('jS F Y') }}
                            to
                            {{ \Carbon\Carbon::parse($trip->start_date)->addDays((int) $trip->duration)->format('jS F Y') }}
                        @else
                            TBD
                        @endif
                    </li>
                </ul>
            </div>

            <div class="payment-section">
                <h3>Payment Details:</h3>
                <ul class="payment-details-list">
                    <li>Total Trip Amount:
                        <span
                            class="currency-symbol">{{ $trip->currency_symbol }}</span>{{ number_format($trip->cost + ($trip->gst_amount ?? 0)) }}
                    </li>
                    <li>Amount Paid: <span
                            class="currency-symbol">{{ $trip->currency_symbol }}</span>{{ number_format($trip->paid_amount ?? 0) }}
                    </li>
                    <li>Pending Amount:
                        <span
                            class="currency-symbol">{{ $trip->currency_symbol }}</span>{{ number_format($trip->cost + ($trip->gst_amount ?? 0) - ($trip->paid_amount ?? 0)) }}
                    </li>
                </ul>
            </div>

            <p class="footer-note">
                Kindly note that the balance amount is required to be settled prior to arrival to facilitate smooth
                hotel check-ins and service arrangements.
            </p>
        </div>

        <div class="footer-wrapper">
            <div class="footer-line" style="opacity: 0.3; background: #fff;"></div>
            <table class="footer-table" style="color: #fff; opacity: 1; font-weight: 500;">
                <tr>
                    <td width="33%">{{ $agencySettings?->contact_email }}</td>
                    <td width="34%" align="center"><b>{{ $agencySettings?->whatsapp }}</b></td>
                    <td width="33%" align="right">{{ $agencySettings?->website }}</td>
                </tr>
            </table>
        </div>
    </div>
</body>

</html>
