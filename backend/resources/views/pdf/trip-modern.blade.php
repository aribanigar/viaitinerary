<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>{{ $trip->trip_title }}</title>
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
            vertical-align: baseline;
            position: relative;
            top: 2px;
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
            min-height: 297mm;
            position: relative;
            page-break-after: always;
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

        .orange-header-label.secondary {
            display: inline-block;
            width: fit-content;
            min-width: unset;
            max-width: 500px;
            border-radius: 0;
            padding-right: 40px;
        }

        .brand-logo-right {
            text-align: right;
            color: #0D2D2D;
            padding: 10px 45px 0 0;
        }

        .brand-logo-right h2 {
            margin: 0;
            font-weight: 900;
            letter-spacing: 2px;
            font-size: 22px;
            line-height: 1;
            text-transform: uppercase;
        }

        .brand-logo-right span {
            display: block;
            font-size: 9px;
            letter-spacing: 2px;
            font-weight: 700;
            margin-top: 5px;
            text-transform: uppercase;
            opacity: 0.7;
        }

        .header-logo {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            width: 800px;
            margin-left: -400px;
            margin-top: -150px;
            opacity: 0.2;
            z-index: -1000;
            text-align: center;
            transform: rotate(-30deg);
        }

        .watermark img {
            width: 100%;
            height: auto;
        }

        /* Section Bar */
        .section-bar {
            background: #4A6763;
            color: white;
            margin-top: 20px;
            padding: 12px 60px;
            position: relative;
            width: 95%;
            border-left: 25px solid #0D2D2D;
        }

        .section-bar h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .section-slashes {
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            position: absolute;
            right: 40px;
            top: 5px;
            font-weight: 900;
            font-size: 26px;
            letter-spacing: -2px;
        }

        /* Hero Areas */
        .hero-cover {
            height: 480px;
            width: 100%;
            position: relative;
            overflow: hidden;
        }

        .hero-cover-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            z-index: 0;
        }

        .hero-label {
            position: absolute;
            bottom: 30px;
            width: 100%;
            text-align: center;
            color: white;
            z-index: 2;
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

        .hero-label h1 {
            font-size: 48px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
        }

        .hero-label p {
            font-size: 14px;
            letter-spacing: 3px;
            font-weight: 600;
            margin: 5px 0 0;
        }

        /* Cover Content */
        .cover-content {
            background: #0D2D2D;
            color: white;
            padding: 30px 45px;
            /* Remove height: 100% to prevent overflow to segundo page */
            min-height: 480px;
        }

        .cover-content h2 {
            font-size: 20px;
            margin-bottom: 10px;
        }

        .grid-3 {
            width: 100%;
            margin-top: 20px;
        }

        .grid-3 td {
            vertical-align: top;
            padding: 10px 0;
            width: 33.33%;
        }

        .grid-label {
            font-size: 11px;
            opacity: 0.6;
            margin-bottom: 2px;
        }

        .grid-value {
            font-size: 16px;
            font-weight: 600;
        }

        .price-card {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 16px;
            border-radius: 12px;
            margin-top: 24px;
            position: relative;
            width: 260px;
            margin-left: auto;
        }

        /* Hotel Cards */
        .hotel-card {
            background: #FDF9F0;
            margin: 12px 30px;
            padding: 16px;
            border-radius: 10px;
        }

        .hotel-table {
            width: 100%;
        }

        .hotel-img {
            width: 210px;
            height: 140px;
            border-radius: 10px;
        }

        .night-badge {
            background: #0D2D2D;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
            vertical-align: middle;
        }

        /* Tables */
        .itinerary-table {
            width: 90%;
            margin: 25px auto;
            border-collapse: collapse;
        }

        .itinerary-table th {
            background: #f8f8f8;
            text-align: left;
            padding: 12px;
            border: 1px solid #ddd;
            font-weight: 700;
            color: #0D2D2D;
        }

        .itinerary-table td {
            padding: 12px;
            border: 1px solid #ddd;
            vertical-align: middle;
        }

        /* Day Itinerary */
        .day-header table {
            width: 100%;
            padding: 20px 45px;
        }

        .day-badge {
            background: #0D2D2D;
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            width: 65px;
            height: 65px;
            border-radius: 15px;
            text-align: center;
            padding: 5px;
        }

        .day-badge b {
            font-size: 32px;
            display: block;
            line-height: 1;
        }

        .day-badge span {
            font-size: 9px;
            display: block;
        }

        .day-title {
            padding-left: 15px;
        }

        .day-title p {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #666;
            width: 100%;
        }

        .overnight-stay {
            float: right;
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-weight: 700;
            font-size: 13px;
        }

        .day-title h3 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            color: #0D2D2D;
            text-transform: uppercase;
        }

        .day-hero {
            width: 100%;
            margin: 0 45px;
            width: calc(100% - 90px);
        }

        .day-hero img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            border-radius: 15px;
        }

        .activities {
            padding: 20px 60px;
        }

        .activities h4 {
            font-size: 24px;
            font-weight: 900;
            color: #0D2D2D;
            margin-bottom: 15px;
        }

        .activities ul {
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .activities li {
            margin-bottom: 6px;
            padding-left: 20px;
            position: relative;
            font-weight: 500;
            line-height: 1.2;
        }

        .activities li:before {
            content: "•";
            color: #4A6763;
            font-size: 20px;
            position: absolute;
            left: 0;
            top: -2px;
        }

        /* Footer */
        .page-footer {
            left: 45px;
            right: 45px;
            font-size: 11px;
            font-weight: 600;
            color: #0D2D2D;
            position: absolute;
            bottom: 30px;
        }

        .section-rule {
            height: 2px;
            background: #eee;
            width: 100%;
            margin-bottom: 15px;
        }

        .footer-line {
            height: 1px;
            background: #eee;
            margin: 10px 0;
            width: 100%;
        }

        .footer-table {
            width: 100%;
            font-size: 11px;
            color: #444;
        }

        .footer-table td {
            vertical-align: middle;
        }

        /* Lists */
        .custom-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .custom-list li {
            margin-bottom: 5px;
            padding-left: 20px;
            position: relative;
            font-weight: 600;
            font-size: 15px;
            color: #0D2D2D;
            line-height: 1.2;
        }

        .custom-list li:before {
            content: "•";
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-size: 24px;
            position: absolute;
            left: 0;
            top: -5px;
        }

        /* Payments Card */
        .payment-card {
            background: #FDF5E6;
            border-radius: 20px;
            padding: 10px 25px;
            margin-bottom: 15px;
        }

        .payment-card h3 {
            font-size: 18px;
            margin-top: 0;
            margin-bottom: 8px;
            font-weight: 700;
            color: #0D2D2D;
        }

        .payment-card p {
            margin: 4px 0;
            font-size: 15px;
            font-weight: 800;
            color: #0D2D2D;
        }

        /* Helpers */
        .text-center {
            text-align: center;
        }

        .w-full {
            width: 100%;
        }

        .uppercase {
            text-transform: uppercase;
        }

        .mt-auto {
            margin-top: auto;
        }

        .flex-grow {
            height: 100%;
        }
    </style>
</head>

<body>
    @if ($watermarkBase64)
        <div class="watermark" style="opacity: 0.2; z-index: 1000; pointer-events: none;">
            <img src="{{ $watermarkBase64 }}" style="width: 800px;">
        </div>
    @endif
    <!-- PAGE 1: COVER -->
    <div class="page" style="background-color: #0D2D2D;">
        <div class="orange-header-label" style="position: absolute; top: 0; left: 0; z-index: 100;">
            @if ($logoBase64)
                <img src="{{ $logoBase64 }}" class="header-logo">
            @elseif($agencySettings?->logo_url)
                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
            @else
                <h1>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h1>
                <p>TRAVEL SIMPLIFIED</p>
            @endif
        </div>

        <div class="hero-cover">
            <img class="hero-cover-img"
                src="{{ $tripImageBase64 ?: ($trip->image_path ? $trip->image_url : 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&q=80&w=1000') }}"
                alt="Trip cover">
            <div class="hero-overlay"></div>
            <div class="hero-label">
                <h1>{{ (int) ($trip->duration ?? 0) }} {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                    {{ (int) ($trip->duration ?? 0) + 1 }}
                    {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}</h1>
                <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</p>
            </div>
        </div>

        <div
            style="background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; color: white; text-align: center; padding: 8px; font-size: 9px; font-weight: 700;">
            {{ $trip->tagline ?? ($agencySettings?->tagline ?? 'BOOK VERIFIED HOTELS, CABS, HORSES, SHIKARAS, HOUSEBOATS, TOUR PACKAGES, ACTIVITIES, VISITS') }}
        </div>

        <div class="cover-content">
            <h2>Dear <b>{{ $trip->client_name ?? 'Guest' }}</b>,</h2>
            <p style="margin: 10px 0; opacity: 0.8; font-size: 13px;">
                {{ str_replace('{agencyName}', strtoupper($agencySettings?->agency_name ?? 'Via Kashmir'), $agencySettings?->greeting_message ?? 'Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.') }}
            </p>

            <table class="grid-3">
                <tr>
                    <td>
                        <div class="grid-label">Destination</div>
                        <div class="grid-value">{{ $trip->destination ?? 'Jammu & Kashmir' }}</div>
                    </td>
                    <td>
                        <div class="grid-label">Start Date</div>
                        <div class="grid-value">
                            {{ $trip->start_date ? \Carbon\Carbon::parse($trip->start_date)->format('d M Y') : 'TBD' }}
                        </div>
                    </td>
                    <td>
                        <div class="grid-label">Duration</div>
                        <div class="grid-value">
                            {{ (int) ($trip->duration ?? 0) }}N/{{ (int) ($trip->duration ?? 0) + 1 }}D</div>
                    </td>
                </tr>
                <tr>
                    <td>
                        <div class="grid-label">Pax</div>
                        <div class="grid-value">
                            {{ $trip->adults ? $trip->adults . ' Adults' : '2 Adults' }}
                            @php
                                $kidsTotal =
                                    ($trip->kids_cnb ?? ($trip->kids_upto_5 ?? 0)) + ($trip->kids_5_to_12 ?? 0);
                            @endphp
                            {{ $kidsTotal > 0 ? ', ' . $kidsTotal . ' Kids' : '' }}
                        </div>
                    </td>
                    <td>
                        <div class="grid-label">Trip ID</div>
                        <div class="grid-value">#{{ $trip->trip_id }}</div>
                    </td>
                    <td></td>
                </tr>
            </table>

            <div class="price-card">
                <div class="grid-label" style="opacity: 0.7;">Quote Price</div>
                <div style="font-size: 16px; margin: 4px 0;">Total (<span
                        class="currency-symbol">{{ explode(' ', $trip->currency ?? 'INR')[0] === 'INR' ? '₹' : explode(' ', $trip->currency ?? 'INR')[0] }}</span>)
                </div>
                <div style="font-size: 26px; font-weight: 900; word-wrap: break-word;">
                    @php
                        $baseCost = (float) ($trip->cost ?? 0);
                    @endphp
                    {{ number_format($baseCost) }}/-
                </div>
                @if ($trip->include_gst)
                    <div style="text-align: right; font-style: italic; opacity: 0.7; font-size: 11px; margin-top: 4px;">
                        including GST/-
                    </div>
                @else
                    <div style="text-align: right; font-style: italic; opacity: 0.7; font-size: 11px; margin-top: 4px;">
                        excluding GST/-
                    </div>
                @endif
            </div>

            <div style="position: absolute; bottom: 30px; left: 45px; right: 45px;">
                <div class="footer-line" style="opacity: 0.3; background: #fff;"></div>
                <table class="footer-table" style="color: #fff; opacity: 0.8;">
                    <tr>
                        <td>{{ $agencySettings?->contact_email }}</td>
                        <td align="center"><b>WA:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    </div>

    <!-- PAGE 2: ACCOMMODATIONS -->
    @php
        $groupedAccommodations = $trip->accommodations->sortBy('check_in')->groupBy(function ($hotel) {
            $hotelName = $hotel->hotel ? $hotel->hotel->name : $hotel->name ?? ($hotel->hotel_name ?? '');
            $hotelCity = $hotel->hotel ? $hotel->hotel->city : $hotel->city ?? '';
            return $hotelName . '|' . $hotelCity . '|' . $hotel->category . '|' . ($hotel->room_type ?? 'Standard');
        });
    @endphp
    @if ($groupedAccommodations->count() > 0)
        @foreach ($groupedAccommodations->chunk(3) as $pageIndex => $chunk)
            <div class="page">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td width="55%" align="left" valign="top">
                            <div class="orange-header-label secondary">
                                <h1>{{ (int) ($trip->duration ?? 0) }}
                                    {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                    {{ (int) ($trip->duration ?? 0) + 1 }}
                                    {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                                </h1>
                                <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                                </p>
                            </div>
                        </td>
                        <td width="45%" align="right" valign="top">
                            <div class="brand-logo-right">
                                @if ($logoBase64)
                                    <img src="{{ $logoBase64 }}" class="header-logo">
                                @elseif($agencySettings?->logo_url)
                                    <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                                @else
                                    <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                    <span>TRAVEL SIMPLIFIED</span>
                                @endif
                            </div>
                        </td>
                    </tr>
                </table>
                <div class="section-bar">
                    <h2>ACCOMMODATIONS</h2>
                    <span class="section-slashes">///</span>
                </div>

                @foreach ($chunk as $groupKey => $groupItems)
                    @php
                        $hotel = $groupItems->first();
                        $hotelName = $hotel->hotel ? $hotel->hotel->name : $hotel->name ?? ($hotel->hotel_name ?? null);
                        $hotelCity = $hotel->hotel ? $hotel->hotel->city : $hotel->city ?? null;
                        $totalNights = $groupItems->reduce(function ($carry, $item) {
                            if ($item->check_in && $item->check_out) {
                                $cIn = new DateTime($item->check_in);
                                $cOut = new DateTime($item->check_out);
                                $diff = $cIn->diff($cOut)->days;
                                return $carry + ($diff > 0 ? $diff : 1);
                            }
                            return $carry + 1;
                        }, 0);

                        $getOrdinal = function ($n) {
                            $s = ['th', 'st', 'nd', 'rd'];
                            $v = (int) $n % 100;
                            return $n . ($s[($v - 20) % 10] ?? ($s[$v] ?? $s[0]));
                        };

                        $stayGroups = [];
                        foreach ($groupItems as $item) {
                            if ($item->check_in && $trip->start_date) {
                                $cIn = new \DateTime($item->check_in);
                                $sDate = new \DateTime($trip->start_date);
                                $startDayNum = $cIn->diff($sDate)->days + 1;

                                $nights = 1;
                                if ($item->check_out) {
                                    $cOut = new \DateTime($item->check_out);
                                    $nights = $cIn->diff($cOut)->days;
                                    if ($nights < 1) {
                                        $nights = 1;
                                    }
                                }

                                $daysInThisStay = [];
                                for ($i = 0; $i < $nights; $i++) {
                                    $daysInThisStay[] = $getOrdinal($startDayNum + $i);
                                }

                                if (count($daysInThisStay) > 2) {
                                    $last = array_pop($daysInThisStay);
                                    $stayGroups[] = implode(', ', $daysInThisStay) . ' & ' . $last;
                                } elseif (count($daysInThisStay) == 2) {
                                    $stayGroups[] = $daysInThisStay[0] . ' & ' . $daysInThisStay[1];
                                } else {
                                    $stayGroups[] = $daysInThisStay[0];
                                }
                            }
                        }

                        $accommodationDays = '';
                        if (count($stayGroups) > 2) {
                            $last = array_pop($stayGroups);
                            $accommodationDays = implode(', ', $stayGroups) . ' & ' . $last;
                        } elseif (count($stayGroups) == 2) {
                            $accommodationDays = $stayGroups[0] . ' & ' . $stayGroups[1];
                        } elseif (count($stayGroups) == 1) {
                            $accommodationDays = $stayGroups[0];
                        } else {
                            $accommodationDays = 'Accommodation';
                        }
                    @endphp
                    <div class="hotel-card">
                        <table class="hotel-table">
                            <tr>
                                <td valign="top">
                                    <table cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                                        <tr>
                                            <td style="vertical-align: middle;">
                                                <div class="night-badge"
                                                    style="margin: 0; padding: 5px 12px; line-height: 1;">
                                                    {{ $accommodationDays }}
                                                </div>
                                            </td>
                                            <td style="vertical-align: middle; padding-left: 12px;">
                                                <span
                                                    style="font-weight: 500; font-size: 14px; text-transform: uppercase; color: #0D2D2D; display: inline-block;">
                                                    {{ $totalNights }} {{ $totalNights > 1 ? 'NIGHTS' : 'NIGHT' }} AT
                                                    <b style="font-weight: 800;">{{ $hotelCity }}</b>
                                                </span>
                                            </td>
                                        </tr>
                                    </table>

                                    <h3
                                        style="font-size: 24px; font-weight: 800; margin: 8px 0 3px 0; line-height: 1.15; color: #0D2D2D;">
                                        {{ $hotelName }}</h3>
                                    <div
                                        style="color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; font-size: 18px; margin-bottom: 12px; font-family: 'DejaVu Sans', sans-serif;">
                                        @for ($i = 0; $i < (int) $hotel->category; $i++)
                                            &#9733;
                                        @endfor
                                        @for ($i = (int) $hotel->category; $i < 5; $i++)
                                            &#9734;
                                        @endfor
                                    </div>
                                    <table style="margin-top: 15px; font-size: 11px; width: 100%;">
                                        <tr>
                                            <td width="25%">
                                                <div style="opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                    ROOMS
                                                </div>
                                                <b style="font-size: 14px;">{{ $hotel->rooms ?? '-' }}</b>
                                            </td>
                                            @if ($hotel->room_type)
                                                <td width="25%">
                                                    <div
                                                        style="opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                        ROOM TYPE
                                                    </div>
                                                    <b style="font-size: 14px;">{{ $hotel->room_type }}</b>
                                                </td>
                                            @endif
                                            @php
                                                $totalExtraBeds =
                                                    (int) ($hotel->extra_beds_5_to_12_count ?? 0) +
                                                    (int) ($hotel->extra_beds_above_12_count ?? 0);
                                                if ($totalExtraBeds < 1) {
                                                    $totalExtraBeds = (int) ($hotel->beds ?? 0);
                                                }
                                            @endphp
                                            @if ($totalExtraBeds)
                                                <td width="25%">
                                                    <div
                                                        style="opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                        EXTRA BEDS
                                                    </div>
                                                    <b style="font-size: 14px;">{{ $totalExtraBeds }}</b>
                                                </td>
                                            @endif
                                            <td width="50%">
                                                <div style="opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                    MEAL PLAN
                                                </div>
                                                <b
                                                    style="font-size: 14px; white-space: nowrap;">{{ $hotel->meal_plan ?? 'Only Room' }}</b>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td width="250" align="right">
                                    @if (isset($hotel->image_base64))
                                        <img src="{{ $hotel->image_base64 }}" class="hotel-img"
                                            style="object-fit: cover;">
                                    @elseif($hotel->image_url)
                                        <img src="{{ $hotel->image_url }}" class="hotel-img"
                                            style="object-fit: cover;">
                                    @else
                                        <div class="hotel-img"
                                            style="background-color: #eee; text-align: center; line-height: 160px; color: #999; font-size: 11px;">
                                            No Image</div>
                                    @endif
                                </td>
                            </tr>
                        </table>
                    </div>
                @endforeach

                <div class="page-footer">
                    <div class="footer-line"></div>
                    <table class="footer-table">
                        <tr>
                            <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                            <td align="center">{{ $agencySettings?->contact_email }}</td>
                            <td align="right">{{ $agencySettings?->website }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        @endforeach
    @else
        <div class="page">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="55%" align="left" valign="top">
                        <div class="orange-header-label secondary">
                            <h1>{{ (int) ($trip->duration ?? 0) }}
                                {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                {{ (int) ($trip->duration ?? 0) + 1 }}
                                {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                            </h1>
                            <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</p>
                        </div>
                    </td>
                    <td width="45%" align="right" valign="top">
                        <div class="brand-logo-right">
                            @if ($logoBase64)
                                <img src="{{ $logoBase64 }}" class="header-logo">
                            @elseif($agencySettings?->logo_url)
                                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                            @else
                                <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                <span>TRAVEL SIMPLIFIED</span>
                            @endif
                        </div>
                    </td>
                </tr>
            </table>
            <div class="section-bar">
                <h2>ACCOMMODATIONS</h2>
                <span class="section-slashes">///</span>
            </div>
            <div class="hotel-card text-center" style="padding: 50px;">
                <h3 style="font-size: 24px; font-weight: 800; color: #0D2D2D;">HOTEL BOOKED BY GUEST</h3>
            </div>
            <div class="page-footer">
                <div class="footer-line"></div>
                <table class="footer-table">
                    <tr>
                        <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="center">{{ $agencySettings?->contact_email }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- PAGE 3: TRANSPORTATIONS -->
    <div class="page">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td width="55%" align="left" valign="top">
                    <div class="orange-header-label secondary">
                        <h1>{{ (int) ($trip->duration ?? 0) }}
                            {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                            {{ (int) ($trip->duration ?? 0) + 1 }}
                            {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                        </h1>
                        <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</p>
                    </div>
                </td>
                <td width="45%" align="right" valign="top">
                    <div class="brand-logo-right">
                        @if ($logoBase64)
                            <img src="{{ $logoBase64 }}" class="header-logo">
                        @elseif($agencySettings?->logo_url)
                            <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                        @else
                            <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                            <span>TRAVEL SIMPLIFIED</span>
                        @endif
                    </div>
                </td>
            </tr>
        </table>
        <div class="section-bar">
            <h2>TRANSPORTATIONS</h2>
            <span class="section-slashes">///</span>
        </div>

        @if ($trip->transportations->count() > 0)
            <table class="itinerary-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Type</th>
                        <th>Service/Route</th>
                        <th>No. Vehicles</th>
                        <th>Vehicle</th>
                    </tr>
                </thead>
                <tbody>
                    @php
                        $sortedTransports = $trip->transportations->sortBy('date')->values();
                    @endphp
                    @foreach ($sortedTransports as $index => $item)
                        <tr>
                            <td width="120" style="font-size: 13px;">
                                @php
                                    $uniqueTransportDates = $sortedTransports
                                        ->pluck('date')
                                        ->filter()
                                        ->unique()
                                        ->sort()
                                        ->values();
                                    $dayNum = $item->date ? $uniqueTransportDates->search($item->date) + 1 : $index + 1;
                                    $suffixes = ['st', 'nd', 'rd'];
                                    $mod10 = $dayNum % 10;
                                    $mod100 = $dayNum % 100;
                                    $suffix =
                                        $mod10 > 0 && $mod10 < 4 && ($mod100 < 11 || $mod100 > 13)
                                            ? $suffixes[$mod10 - 1]
                                            : 'th';
                                @endphp
                                {{ $dayNum }}{{ $suffix }} Day
                                @if ($item->date)
                                    <br><small
                                        style="color: #666;">({{ \Carbon\Carbon::parse($item->date)->format('d M Y') }})</small>
                                @endif
                            </td>
                            <td style="font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase;">
                                {{ $item->trip_type ?? 'Transfer' }}</td>
                            <td style="font-size: 14px; font-weight: 600;">{{ $item->route }}</td>
                            <td style="font-size: 14px; font-weight: 600; color: #000000; text-align: center;">
                                {{ $item->quantity ?? '1' }}</td>
                            <td style="font-size: 14px;">{{ $item->vehicle_type }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @else
            <div style="padding: 60px; text-align: center; color: #666;">
                <h3 style="font-size: 22px; font-weight: 800; color: #0D2D2D;">TRANSPORT BOOKED BY GUEST</h3>
                <p style="margin-top: 10px;">No transportation details have been added to this quote.</p>
            </div>
        @endif

        <div class="page-footer">
            <div class="footer-line"></div>
            <table class="footer-table">
                <tr>
                    <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                    <td align="center">{{ $agencySettings?->contact_email }}</td>
                    <td align="right">{{ $agencySettings?->website }}</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- DAY WISE ITINERARY PAGES -->
    @foreach ($trip->itineraries->sortBy('day_number') as $index => $day)
        <div class="page">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="55%" align="left" valign="top">
                        <div class="orange-header-label secondary">
                            <h1>{{ (int) ($trip->duration ?? 0) }}
                                {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                {{ (int) ($trip->duration ?? 0) + 1 }}
                                {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}</h1>
                            <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</p>
                        </div>
                    </td>
                    <td width="45%" align="right" valign="top">
                        <div class="brand-logo-right">
                            @if ($logoBase64)
                                <img src="{{ $logoBase64 }}" class="header-logo">
                            @elseif($agencySettings?->logo_url)
                                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                            @else
                                <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                <span>TRAVEL SIMPLIFIED</span>
                            @endif
                        </div>
                    </td>
                </tr>
            </table>
            <div class="section-bar">
                <h2>DAY WISE ITINERARY</h2>
                <span class="section-slashes">///</span>
            </div>

            <div class="day-header">
                <table>
                    <tr>
                        <td width="70">
                            <div class="day-badge">
                                <b>{{ $day->day_number }}</b>
                                <span>DAY</span>
                            </div>
                        </td>
                        <td class="day-title">
                            @php
                                $suffixes = ['ST', 'ND', 'RD'];
                                $idx = (int) $day->day_number - 1;
                                $suffix = $idx >= 0 && $idx < 3 ? $suffixes[$idx] : 'TH';

                                $formattedDate = '—';
                                // Align transportation by index (Day 1 -> Transport 1, etc.)
                                $transport = $trip->transportations->sortBy('date')->values()->get($idx);

                                if ($transport && $transport->date) {
                                    $dateObj = new \DateTime($transport->date);
                                    $formattedDate = strtoupper($dateObj->format('d M D'));
                                } elseif ($trip->start_date) {
                                    // Fallback: Calculate from Trip Start Date
                                    $dateObj = new \DateTime($trip->start_date);
                                    if ($day->day_number > 1) {
                                        $dateObj->modify('+' . ($day->day_number - 1) . ' days');
                                    }
                                    $formattedDate = strtoupper($dateObj->format('d M D'));
                                }
                            @endphp
                            <p>
                                {{ $day->day_number }}{{ $suffix }} DAY ({{ $formattedDate }})
                                <span class="overnight-stay">
                                    {{ strtoupper($day->location ?: 'TBD') }}
                                </span>
                            </p>
                            <h3>
                                {{ $day->title }}
                                @php
                                    // Get the transportation for this day based on the same index
                                    $dayTransport = $trip->transportations->sortBy('date')->values()->get($index);
                                    // if ($dayTransport && $dayTransport->route) {
                                    //     echo ' : ' . $dayTransport->route;
                                    // }
                                @endphp
                            </h3>
                        </td>
                    </tr>
                </table>
            </div>

            @if (isset($day->image_base64))
                <div class="day-hero">
                    <img src="{{ $day->image_base64 }}">
                </div>
            @elseif($day->image_url)
                <div class="day-hero">
                    <img src="{{ $day->image_url }}">
                </div>
            @else
                <div style="height: 50px;"></div>
            @endif

            <div class="activities">
                <h4>ACTIVITIES</h4>
                <ul>
                    @foreach (explode("\n", $day->description) as $line)
                        @if (trim($line))
                            <li>{{ preg_replace('/^[•\-\*]\s*/', '', trim($line)) }}</li>
                        @endif
                    @endforeach
                </ul>
            </div>

            <div class="page-footer">
                <div class="footer-line"></div>
                <table class="footer-table">
                    <tr>
                        <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="center">{{ $agencySettings?->contact_email }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endforeach


    <!-- FLIGHT INFORMATION PAGE -->
    @if ($trip->use_flight && !empty($trip->transport_details))
        <div class="page">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="55%" align="left" valign="top">
                        <div class="orange-header-label secondary">
                            <h1>{{ (int) ($trip->duration ?? 0) }}
                                {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                {{ (int) ($trip->duration ?? 0) + 1 }}
                                {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}</h1>
                            <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                            </p>
                        </div>
                    </td>
                    <td width="45%" align="right" valign="top">
                        <div class="brand-logo-right">
                            @if ($logoBase64)
                                <img src="{{ $logoBase64 }}" class="header-logo">
                            @elseif($agencySettings?->logo_url)
                                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                            @else
                                <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                <span>TRAVEL SIMPLIFIED</span>
                            @endif
                        </div>
                    </td>
                </tr>
            </table>
            <div class="section-bar">
                <h2>TRANSPORTATION INFORMATION</h2>
                <span class="section-slashes">///</span>
            </div>

            <div style="padding: 15px 50px;">
                @foreach ($trip->transport_details as $transport)
                    @php
                        $transport = (object) $transport;
                        $tType = $transport->transportType ?? 'Flight';
                    @endphp
                    <div
                        style="background: #f8f9fa; border-radius: 16px; padding: 15px 25px; border: 1px solid #eee; color: #0D2D2D; margin-bottom: 20px;">

                        <!-- Airline and Flight Number with PNR -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd;">
                            <tr>
                                <td style="font-size: 14px; color: #0D2D2D;">
                                    <span
                                        style="font-weight: 700;">{{ $transport->airline ?? ($tType === 'Bus' ? 'Bus Company' : ($tType === 'Train' ? 'Train Name' : 'N/A')) }}</span>
                                    <span style="font-weight: 500;">{{ $transport->flightNumber ?? '' }}</span>
                                    <span
                                        style="margin-left: 10px; font-size: 10px; background: #eee; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">{{ $tType }}</span>
                                </td>
                                <td style="text-align: right;">
                                    <span
                                        style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #999; letter-spacing: 0.5px;">PNR:</span>
                                    <span
                                        style="font-size: 14px; font-weight: 700; letter-spacing: 1px; color: #0D2D2D;">{{ $transport->pnrNumber ?? 'N/A' }}</span>
                                </td>
                            </tr>
                        </table>

                        <!-- Flight Timeline -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                            <tr>
                                <td width="30%" style="vertical-align: top;">
                                    <p
                                        style="font-size: 20px; font-weight: 700; color: #0D2D2D; margin: 0; line-height: 1;">
                                        @if (isset($transport->departure_date_time) || isset($transport->departureDateTime))
                                            {{ \Carbon\Carbon::parse($transport->departure_date_time ?? $transport->departureDateTime)->format('h:i A') }}
                                        @else
                                            N/A
                                        @endif
                                    </p>
                                    <p style="font-size: 11px; font-weight: 500; color: #666; margin: 2px 0 0 0;">
                                        @if (isset($transport->departure_date_time) || isset($transport->departureDateTime))
                                            {{ \Carbon\Carbon::parse($transport->departure_date_time ?? $transport->departureDateTime)->format('d M Y') }}
                                        @else
                                            N/A
                                        @endif
                                    </p>
                                </td>
                                <td width="40%" style="text-align: center; vertical-align: middle;">
                                    <div style="height: 1px; background: #ddd; margin: 0 15px;"></div>
                                    <p
                                        style="font-size: 10px; font-weight: 600; color: #999; margin: 4px 0 0 0; text-transform: uppercase;">
                                        @php
                                            $duration = 'Duration';
                                            $depDT =
                                                $transport->departure_date_time ??
                                                ($transport->departureDateTime ?? null);
                                            $arrDT =
                                                $transport->arrival_date_time ?? ($transport->arrivalDateTime ?? null);
                                            if ($depDT && $arrDT) {
                                                $dep = \Carbon\Carbon::parse($depDT);
                                                $arr = \Carbon\Carbon::parse($arrDT);
                                                $diffMinutes = $dep->diffInMinutes($arr);
                                                $hours = floor($diffMinutes / 60);
                                                $minutes = $diffMinutes % 60;
                                                $duration = "{$hours}h {$minutes}m";
                                            }
                                        @endphp
                                        {{ $duration }}
                                    </p>
                                </td>
                                <td width="30%" style="text-align: right; vertical-align: top;">
                                    <p
                                        style="font-size: 20px; font-weight: 700; color: #0D2D2D; margin: 0; line-height: 1;">
                                        @if (isset($transport->arrival_date_time) || isset($transport->arrivalDateTime))
                                            {{ \Carbon\Carbon::parse($transport->arrival_date_time ?? $transport->arrivalDateTime)->format('h:i A') }}
                                        @else
                                            N/A
                                        @endif
                                    </p>
                                    <p style="font-size: 11px; font-weight: 500; color: #666; margin: 2px 0 0 0;">
                                        @if (isset($transport->arrival_date_time) || isset($transport->arrivalDateTime))
                                            {{ \Carbon\Carbon::parse($transport->arrival_date_time ?? $transport->arrivalDateTime)->format('d M Y') }}
                                        @else
                                            N/A
                                        @endif
                                    </p>
                                </td>
                            </tr>
                        </table>

                        <!-- Locations -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                            <tr>
                                <td width="48%" style="font-size: 11px; font-weight: 500; color: #666;">
                                    {{ $transport->departureLocation ?? 'N/A' }}
                                </td>
                                <td width="4%" style="text-align: center; color: #ccc;">•</td>
                                <td width="48%"
                                    style="text-align: right; font-size: 11px; font-weight: 500; color: #666;">
                                    {{ $transport->arrivalLocation ?? 'N/A' }}
                                </td>
                            </tr>
                        </table>

                        <!-- Travellers -->
                        <div>
                            <span
                                style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #999; margin-right: 10px;">
                                @php
                                    $tNames = $transport->travelerNames ?? [];
                                    $pCount = is_array($tNames) ? count($tNames) : 0;
                                @endphp
                                {{ $tType === 'Bus' || $tType === 'Train' ? 'Travellers' : 'Passengers' }}
                                ({{ $pCount }}):
                            </span>
                            <span style="font-size: 11px; font-weight: 500; color: #0D2D2D;">
                                @if (is_array($tNames) && count($tNames) > 0)
                                    {{ implode(', ', $tNames) }}
                                @else
                                    N/A
                                @endif
                            </span>
                        </div>
                    </div>
                @endforeach
            </div>

            <div class="page-footer">
                <div class="footer-line"></div>
                <table class="footer-table">
                    <tr>
                        <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="center">{{ $agencySettings?->contact_email }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- INCLUSIONS & EXCLUSIONS -->
    @php
        $normalizeItem = function ($item) {
            if (is_array($item)) {
                $value = $item['content'] ?? '';
                return is_array($value) ? json_encode($value) : (string) $value;
            }
            return (string) $item;
        };

        $inclusionItems = [];
        if (is_array($trip->inclusions)) {
            foreach ($trip->inclusions as $inc) {
                $text = trim($normalizeItem($inc));
                if ($text !== '') {
                    $inclusionItems[] = $text;
                }
            }
        }

        $exclusionItems = [];
        if (is_array($trip->exclusions)) {
            foreach ($trip->exclusions as $exc) {
                $text = trim($normalizeItem($exc));
                if ($text !== '') {
                    $exclusionItems[] = $text;
                }
            }
        }

        $estimateUnits = function ($text) {
            $clean = trim(preg_replace('/\s+/', ' ', strip_tags($text)));
            $charsPerLine = 90;
            $length = strlen($clean);
            return max(1, (int) ceil($length / $charsPerLine));
        };

        $maxUnits = 26;
        $headingUnits = 2;
        $pages = [];
        $currentPage = ['sections' => []];
        $currentUnits = 0;

        $pushPage = function () use (&$pages, &$currentPage, &$currentUnits) {
            if (!empty($currentPage['sections'])) {
                $pages[] = $currentPage;
            }
            $currentPage = ['sections' => []];
            $currentUnits = 0;
        };

        $addSection = function ($title, $items) use (
            &$currentPage,
            &$currentUnits,
            $maxUnits,
            $headingUnits,
            $estimateUnits,
            $pushPage,
        ) {
            $idx = 0;
            $total = count($items);
            while ($idx < $total) {
                if ($currentUnits + $headingUnits > $maxUnits && $currentUnits > 0) {
                    $pushPage();
                }

                $section = ['title' => $title, 'items' => []];
                $currentUnits += $headingUnits;

                while ($idx < $total) {
                    $units = $estimateUnits($items[$idx]);
                    if ($currentUnits + $units > $maxUnits) {
                        break;
                    }
                    $section['items'][] = $items[$idx];
                    $currentUnits += $units;
                    $idx++;
                }

                $currentPage['sections'][] = $section;

                if ($idx < $total) {
                    $pushPage();
                }
            }
        };

        if (count($inclusionItems) === 0 && count($exclusionItems) === 0) {
            $pages = [
                [
                    'sections' => [['title' => 'INCLUSIONS', 'items' => []], ['title' => 'EXCLUSIONS', 'items' => []]],
                ],
            ];
        } else {
            if (count($inclusionItems) > 0) {
                $addSection('INCLUSIONS', $inclusionItems);
            }
            if (count($exclusionItems) > 0) {
                $addSection('EXCLUSIONS', $exclusionItems);
            }
            $pushPage();
        }
    @endphp

    @foreach ($pages as $page)
        <div class="page">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="55%" align="left" valign="top">
                        <div class="orange-header-label secondary">
                            <h1>{{ (int) ($trip->duration ?? 0) }}
                                {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                {{ (int) ($trip->duration ?? 0) + 1 }}
                                {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                            </h1>
                            <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                            </p>
                        </div>
                    </td>
                    <td width="45%" align="right" valign="top">
                        <div class="brand-logo-right">
                            @if ($logoBase64)
                                <img src="{{ $logoBase64 }}" class="header-logo">
                            @elseif($agencySettings?->logo_url)
                                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                            @else
                                <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                <span>TRAVEL SIMPLIFIED</span>
                            @endif
                        </div>
                    </td>
                </tr>
            </table>
            <div class="section-bar">
                <h2>INCLUSIONS/EXCLUSIONS</h2>
                <span class="section-slashes">///</span>
            </div>

            <div style="padding: 30px 45px;">
                @foreach ($page['sections'] as $sectionIndex => $section)
                    <table cellpadding="0" cellspacing="0"
                        style="margin-bottom: 5px; {{ $sectionIndex > 0 ? 'margin-top: 35px;' : '' }}">
                        <tr>
                            <td style="color: #0D2D2D; font-size: 32px; font-weight: 900;">
                                {{ $section['title'] }}
                            </td>
                            <td style="padding-left: 15px; vertical-align: middle;">
                                <span
                                    style="color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; font-weight: 900; font-size: 24px;">///</span>
                            </td>
                        </tr>
                    </table>
                    <div class="section-rule"></div>
                    @if (count($section['items']) > 0)
                        <ul class="custom-list">
                            @foreach ($section['items'] as $text)
                                <li>{{ $text }}</li>
                            @endforeach
                        </ul>
                    @endif
                @endforeach
            </div>

            <div class="page-footer">
                <div class="footer-line"></div>
                <table class="footer-table">
                    <tr>
                        <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="center">{{ $agencySettings?->contact_email }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endforeach

    @php
        $normalizePolicyItem = function ($item) {
            if (is_array($item)) {
                $value = $item['content'] ?? '';
                return is_array($value) ? json_encode($value) : (string) $value;
            }
            return (string) $item;
        };

        $normalizePolicyList = function ($value) use ($normalizePolicyItem) {
            if (!$value) {
                return [];
            }
            $rawItems = is_array($value) ? $value : explode("\n", (string) $value);
            $items = [];
            foreach ($rawItems as $item) {
                $text = trim($normalizePolicyItem($item));
                if ($text !== '') {
                    $items[] = $text;
                }
            }
            return $items;
        };

        $paginateSections = function ($sections, $maxUnits, $headingUnits, $charsPerLine, $noteUnits = 2) {
            $estimateUnits = function ($text) use ($charsPerLine) {
                $clean = trim(preg_replace('/\s+/', ' ', strip_tags($text)));
                $length = strlen($clean);
                return max(1, (int) ceil($length / $charsPerLine));
            };

            $pages = [];
            $currentPage = ['sections' => [], 'units' => 0];
            $currentUnits = 0;

            $pushPage = function () use (&$pages, &$currentPage, &$currentUnits) {
                if (!empty($currentPage['sections'])) {
                    $currentPage['units'] = $currentUnits;
                    $pages[] = $currentPage;
                }
                $currentPage = ['sections' => [], 'units' => 0];
                $currentUnits = 0;
            };

            foreach ($sections as $section) {
                $type = $section['type'] ?? 'list';
                if ($type === 'note') {
                    $text = (string) ($section['text'] ?? '');
                    if (trim($text) === '') {
                        continue;
                    }
                    $units = max($noteUnits, $estimateUnits($text));
                    if ($currentUnits + $units > $maxUnits && $currentUnits > 0) {
                        $pushPage();
                    }
                    $currentPage['sections'][] = ['type' => 'note', 'text' => $text];
                    $currentUnits += $units;
                    continue;
                }

                $title = (string) ($section['title'] ?? '');
                $items = $section['items'] ?? [];
                $idx = 0;
                $total = count($items);

                if ($total === 0) {
                    if ($currentUnits + $headingUnits > $maxUnits && $currentUnits > 0) {
                        $pushPage();
                    }
                    $currentPage['sections'][] = ['type' => 'list', 'title' => $title, 'items' => []];
                    $currentUnits += $headingUnits;
                    continue;
                }

                while ($idx < $total) {
                    if ($currentUnits + $headingUnits > $maxUnits && $currentUnits > 0) {
                        $pushPage();
                    }
                    $block = ['type' => 'list', 'title' => $title, 'items' => []];
                    $currentUnits += $headingUnits;
                    while ($idx < $total) {
                        $units = $estimateUnits($items[$idx]);
                        if ($currentUnits + $units > $maxUnits) {
                            break;
                        }
                        $block['items'][] = $items[$idx];
                        $currentUnits += $units;
                        $idx++;
                    }
                    $currentPage['sections'][] = $block;
                    if ($idx < $total) {
                        $pushPage();
                    }
                }
            }

            $pushPage();
            return $pages;
        };
    @endphp

    <!-- TERMS AND CONDITIONS -->
    @php
        $buildSectionPages = function ($title, $items, $note = null) use ($paginateSections) {
            $sections = [
                [
                    'type' => 'list',
                    'title' => $title,
                    'items' => $items,
                ],
            ];
            if ($note) {
                $sections[] = [
                    'type' => 'note',
                    'text' => $note,
                ];
            }
            return $paginateSections($sections, 24, 2, 85, 2);
        };

        $termsGroups = [
            [
                'pages' => $buildSectionPages(
                    'Terms & Conditions',
                    $normalizePolicyList($policies?->terms_conditions ?? null),
                ),
            ],
            [
                'pages' => $buildSectionPages(
                    'Cancellation Policy',
                    $normalizePolicyList($policies?->cancellation_policy ?? null),
                ),
            ],
            [
                'pages' => $buildSectionPages(
                    'Additional Expenses (Indicative)',
                    $normalizePolicyList($policies?->additional_expenses ?? null),
                    'Note: Government-fixed rates for activities will be shared separately.',
                ),
            ],
        ];
    @endphp

    @foreach ($termsGroups as $group)
        @foreach ($group['pages'] as $page)
            <div class="page">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td width="55%" align="left" valign="top">
                            <div class="orange-header-label secondary">
                                <h1>{{ (int) ($trip->duration ?? 0) }}
                                    {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                    {{ (int) ($trip->duration ?? 0) + 1 }}
                                    {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                                </h1>
                                <p>TRAVEL ITINERARY BY
                                    {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                                </p>
                            </div>
                        </td>
                        <td width="45%" align="right" valign="top">
                            <div class="brand-logo-right">
                                @if ($logoBase64)
                                    <img src="{{ $logoBase64 }}" class="header-logo">
                                @elseif($agencySettings?->logo_url)
                                    <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                                @else
                                    <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                    <span>TRAVEL SIMPLIFIED</span>
                                @endif
                            </div>
                        </td>
                    </tr>
                </table>
                <div class="section-bar">
                    <h2>TERMS AND CONDITIONS</h2>
                    <span class="section-slashes">///</span>
                </div>

                <div style="padding: 20px 60px; color: #0D2D2D;">
                    @foreach ($page['sections'] as $sectionIndex => $section)
                        @if (($section['type'] ?? 'list') === 'note')
                            <p style="font-size: 14px; font-weight: 600; margin-top: 10px;">
                                {{ $section['text'] }}
                            </p>
                        @else
                            <div style="margin-bottom: 0px; {{ $sectionIndex > 0 ? 'margin-top: 18px;' : '' }}">
                                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">
                                    {{ $section['title'] }}
                                </h3>
                                @if (count($section['items']) > 0)
                                    <ul class="custom-list" style="font-size: 13px;">
                                        @foreach ($section['items'] as $item)
                                            <li>{{ $item }}</li>
                                        @endforeach
                                    </ul>
                                @endif
                            </div>
                        @endif
                    @endforeach
                </div>

                <div class="page-footer">
                    <div class="footer-line"></div>
                    <table class="footer-table">
                        <tr>
                            <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                            <td align="center">{{ $agencySettings?->contact_email }}</td>
                            <td align="right">{{ $agencySettings?->website }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        @endforeach
    @endforeach

    <!-- MUST HAVES & ROLES -->
    @php
        $mustHavesItems = $normalizePolicyList($policies?->must_haves ?? null);
        $rolesItems = $normalizePolicyList($policies?->roles_responsibilities ?? null);

        $rolesSections = [
            ['type' => 'list', 'title' => 'MUST HAVES', 'items' => $mustHavesItems],
            ['type' => 'list', 'title' => 'YOUR ROLES AND RESPONSIBILITIES', 'items' => $rolesItems],
        ];

        $rolesPages = $paginateSections($rolesSections, 26, 2, 90, 2);
        if (count($rolesPages) === 0) {
            $rolesPages = [['sections' => [], 'units' => 0]];
        }

        $paymentUnits = 9;
        $lastIndex = count($rolesPages) - 1;
        $hasRolesBar = false;
        foreach ($rolesPages[$lastIndex]['sections'] as $section) {
            if (
                ($section['type'] ?? '') === 'list' &&
                ($section['title'] ?? '') === 'YOUR ROLES AND RESPONSIBILITIES'
            ) {
                $hasRolesBar = true;
                break;
            }
        }

        $paymentBlock = [
            'type' => 'payment',
            'barTitle' => 'YOUR ROLES AND RESPONSIBILITIES',
            'forceBar' => !$hasRolesBar,
            'units' => $paymentUnits,
        ];

        if (($rolesPages[$lastIndex]['units'] ?? 0) + $paymentUnits <= 26) {
            $rolesPages[$lastIndex]['sections'][] = $paymentBlock;
            $rolesPages[$lastIndex]['units'] += $paymentUnits;
        } else {
            $paymentBlock['forceBar'] = true;
            $rolesPages[] = ['sections' => [$paymentBlock], 'units' => $paymentUnits];
        }
    @endphp

    @foreach ($rolesPages as $page)
        <div class="page">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td width="55%" align="left" valign="top">
                        <div class="orange-header-label secondary">
                            <h1>{{ (int) ($trip->duration ?? 0) }}
                                {{ (int) ($trip->duration ?? 0) == 1 ? 'NIGHT' : 'NIGHTS' }}
                                {{ (int) ($trip->duration ?? 0) + 1 }}
                                {{ (int) ($trip->duration ?? 0) + 1 == 1 ? 'DAY' : 'DAYS' }}
                            </h1>
                            <p>TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                            </p>
                        </div>
                    </td>
                    <td width="45%" align="right" valign="top">
                        <div class="brand-logo-right">
                            @if ($logoBase64)
                                <img src="{{ $logoBase64 }}" class="header-logo">
                            @elseif($agencySettings?->logo_url)
                                <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                            @else
                                <h2>{{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</h2>
                                <span>TRAVEL SIMPLIFIED</span>
                            @endif
                        </div>
                    </td>
                </tr>
            </table>

            @foreach ($page['sections'] as $section)
                @if (($section['type'] ?? 'list') === 'payment')
                    @if ($section['forceBar'] ?? false)
                        <div class="section-bar">
                            <h2>{{ $section['barTitle'] }}</h2>
                            <span class="section-slashes">///</span>
                        </div>
                    @endif
                    <div style="padding: 0 60px; margin-top: 10px;">
                        <div class="payment-card">
                            <h3 style="font-size: 18px; font-weight: 700; color: #0D2D2D; margin-bottom: 8px;">
                                Payment Details:
                            </h3>
                            <p>Beneficiary Name:
                                <b>{{ $agencySettings?->beneficiary_name ?? 'VIAKASHMIR OPC PRIVATE LIMITED' }}</b>
                            </p>
                            <p>Bank Name: <b>{{ $agencySettings?->bank_name ?? 'N/A' }}</b></p>
                            <p>Account Number: <b>{{ $agencySettings?->account_number ?? '0013619000005184' }}</b></p>
                            <p>IFSC CODE: <b>{{ $agencySettings?->ifsc_code ?? 'YESB0000013' }}</b></p>
                        </div>

                        <table width="100%" bgcolor="#FDF5E6" style="padding: 10px 30px; border-radius: 20px;">
                            <tr>
                                <td>
                                    <div style="font-size: 22px; font-weight: 800; color: #0D2D2D;">
                                        {{ $agencySettings?->whatsapp ?? '+91 9186051499' }}</div>
                                    <div style="font-size: 11px; color: #666; font-weight: 600;">WhatsApp Number</div>
                                </td>
                                <td align="right">
                                    <div style="font-size: 11px; color: #666; font-weight: 600;">Your Travel Partner
                                    </div>
                                    <div style="font-size: 24px; font-weight: 900; color: #0D2D2D;">
                                        @if ($logoBase64)
                                            <img src="{{ $logoBase64 }}" class="header-logo">
                                        @elseif($agencySettings?->logo_url)
                                            <img src="{{ $agencySettings->logo_url }}" class="header-logo">
                                        @else
                                            {{ strtoupper($agencySettings?->agency_name ?? 'Via Kashmir') }}
                                        @endif
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </div>
                @else
                    <div class="section-bar">
                        <h2>{{ $section['title'] }}</h2>
                        <span class="section-slashes">///</span>
                    </div>
                    <div style="padding: 15px 60px;">
                        @if (count($section['items']) > 0)
                            <ul class="custom-list" style="font-size: 15px;">
                                @foreach ($section['items'] as $item)
                                    <li>{{ $item }}</li>
                                @endforeach
                            </ul>
                        @endif
                    </div>
                @endif
            @endforeach

            <div class="page-footer">
                <div class="footer-line"></div>
                <table class="footer-table">
                    <tr>
                        <td><b>WhatsApp:</b> {{ $agencySettings?->whatsapp }}</td>
                        <td align="center">{{ $agencySettings?->contact_email }}</td>
                        <td align="right">{{ $agencySettings?->website }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endforeach

    <!-- FINAL PAGE: THANK YOU -->
    <div class="page page-last" style="background-color: #0D2D2D;">
        <div style="position: absolute; top: 30%; width: 100%; text-align: center;">
            <h1 style="color: white; font-size: 72px; font-weight: 900; letter-spacing: 2px; margin: 0;">THANK YOU!
            </h1>
            <div style="margin-top: 20px;">
                <p
                    style="color: white; font-weight: 600; letter-spacing: 5px; margin-top: 10px; text-transform: uppercase;">
                    {{ strtoupper($agencySettings?->agency_name ?? 'VIAKASHMIR') }}</p>
                @if (filled($agencySettings?->company_address))
                    <p
                        style="color: white; margin-top: 10px; font-size: 14px; font-weight: 500; letter-spacing: 0.4px;">
                        {{ $agencySettings->company_address }}
                    </p>
                @endif
            </div>
        </div>

        <div
            style="position: absolute; bottom: 50px; left: 45px; right: 45px; color: white; font-size: 11px; font-weight: 600;">
            <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
                <tr>
                    <td colspan="3" align="center"
                        style="vertical-align: middle; padding-bottom: 12px; text-align: center;">
                        <span
                            style="background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }}; color: #0D2D2D; padding: 6px 15px; border-radius: 25px; font-weight: 800; text-transform: uppercase; font-size: 11px; display: inline-block; line-height: 1; white-space: nowrap; margin: 0 auto;">
                            Contact Us
                        </span>
                    </td>
                </tr>
                <tr>
                    <td width="30%" style="vertical-align: middle;">
                        @if ($logoBase64 || $agencySettings?->logo_url)
                            <div
                                style="background-color: white; padding: 4px 10px; border-radius: 12px; display: inline-block; line-height: 0;">
                                @if ($logoBase64)
                                    <img src="{{ $logoBase64 }}"
                                        style="max-height: 60px; max-width: 200px; object-fit: contain;">
                                @elseif($agencySettings?->logo_url)
                                    <img src="{{ $agencySettings->logo_url }}"
                                        style="max-height: 60px; max-width: 200px; object-fit: contain;">
                                @endif
                            </div>
                        @endif
                    </td>
                    <td width="40%" align="center" style="vertical-align: middle; white-space: nowrap;">
                        <b>WA:</b> {{ $agencySettings?->whatsapp }}
                    </td>
                    <td width="30%" align="right" style="vertical-align: middle; white-space: nowrap;">
                        {{ $agencySettings?->website }}
                    </td>
                </tr>
            </table>
        </div>
    </div>
</body>

</html>
