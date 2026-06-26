<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>{{ $trip->trip_title }}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
    </style>

    @php
        $primaryColor = $agencySettings?->brand_color ?? ($agencySettings?->brandColor ?? '#FAA61A');
        $secondaryColor = $agencySettings?->secondary_color ?? ($agencySettings?->secondaryColor ?? '#0B7AAC');
        $fontFamily = 'Montserrat';
    @endphp

    <style>
        @page {
            margin: 0;
            size: A4;
        }

        body {
            font-family: '{{ $fontFamily }}', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.5;
            background-color: #ffffff;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: '{{ $fontFamily }}', 'Arial', sans-serif;
        }

        .classic-page {
            width: 210mm;
            min-height: 297mm;
            position: relative;
            page-break-after: always;
            background: white;
            display: block;
        }

        .classic-page:last-child {
            page-break-after: avoid;
        }

        /* Header with Image */
        .classic-hero {
            position: relative;
            height: 500px;
            width: 100%;
            overflow: hidden;
        }

        .classic-hero-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            z-index: 0;
        }

        .classic-hero-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
        }

        .classic-hero-content {
            position: absolute;
            bottom: 40px;
            left: 0;
            right: 0;
            z-index: 2;
            text-align: center;
            color: white;
            padding: 0 60px;
        }

        .classic-title {
            font-size: 68px;
            font-weight: 900;
            line-height: 0.9;
            text-transform: uppercase;
            color: {{ $primaryColor }};
            text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            margin-bottom: 10px;
        }

        .classic-subtitle {
            font-size: 16px;
            letter-spacing: 4px;
            font-weight: 600;
            text-transform: uppercase;
            margin: 0;
        }

        /* Logo Header Box */
        .br-header-box {
            position: absolute;
            top: 0;
            left: 0;
            background: {{ $primaryColor }};
            color: white;
            padding: 15px 60px 15px 40px;
            display: inline-block;
            width: auto;
            min-width: 250px;
            max-width: 550px;
            border-bottom-right-radius: 40px;
            z-index: 10;
        }

        .br-header-logo {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
        }

        .br-header-box h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 1px;
            margin: 0;
            white-space: nowrap;
        }

        .br-header-box p {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 1.5px;
            opacity: 0.8;
            margin: 0;
            white-space: nowrap;
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

        /* Destination Banner */
        .classic-destination-banner {
            background: {{ $secondaryColor }};
            color: white;
            padding: 20px 50px;
            width: 90%;
        }

        .classic-destination-banner table {
            width: 90%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .classic-destination-icon {
            width: 32px;
            height: 32px;
            background: {{ $primaryColor }};
            border-radius: 8px;
            display: inline-block;
            text-align: center;
            vertical-align: middle;
            margin-right: 12px;
            color: white;
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 14px;
        }

        .classic-destination-icon span {
            display: block;
            margin-top: 4px;
        }

        .classic-destination-label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 2px;
        }

        .classic-destination-value {
            font-size: 14px;
            font-weight: 800;
        }

        /* Greetings Section */
        .classic-highlights {
            padding: 20px 50px;
        }

        .classic-highlights-title {
            font-size: 28px;
            font-weight: 700;
            color: {{ $secondaryColor }};
            margin-bottom: 10px;
        }

        /* Quote Card */
        .quote-card {
            background: #f9f9f9;
            border: 2px solid {{ $secondaryColor }};
            padding: 15px 25px;
            border-radius: 24px;
            display: inline-block;
            min-width: 300px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            margin-top: 10px;
        }

        .quote-label {
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            font-weight: 600;
        }

        .quote-price {
            font-size: 32px;
            font-weight: 800;
            color: {{ $secondaryColor }};
        }

        .quote-currency {
            font-size: 18px;
            font-family: 'DejaVu Sans', 'Arial Unicode MS', 'Noto Sans Symbols 2', 'Noto Sans', 'Helvetica', 'Arial', sans-serif;
            font-weight: 700;
            display: inline-block;
            line-height: 1;
            vertical-align: middle;
            margin-right: 2px;
        }

        /* Section Headers */
        .classic-section-header {
            background: {{ $primaryColor }};
            padding: 15px 50px;
            width: 95%;
            margin-bottom: 30px;
        }

        .classic-section-header table {
            width: 95%;
        }

        .classic-section-title {
            font-size: 32px;
            font-weight: 700;
            color: {{ $secondaryColor }};
            display: inline-block;
            vertical-align: middle;
        }

        .classic-section-icon {
            width: 32px;
            height: 32px;
            display: inline-block;
            margin-right: 15px;
            vertical-align: middle;
        }

        .classic-section-logo {
            max-height: 80px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
            vertical-align: middle;
        }

        /* Highlights Grid */
        .classic-highlights-grid {
            padding: 0 50px 40px;
        }

        .classic-highlights-grid table {
            width: auto;
            border-collapse: separate;
            border-spacing: 15px;
            margin: 0;
        }

        .classic-highlight-card {
            text-align: center;
            width: 190px;
            vertical-align: top;
        }

        .classic-highlight-image {
            width: 100%;
            height: 160px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 12px;
        }

        .classic-highlight-title {
            font-size: 14px;
            font-weight: 700;
            color: {{ $secondaryColor }};
        }

        /* Tables */
        .classic-table-container {
            padding: 0 50px 40px;
        }

        .classic-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .classic-table thead {
            background: {{ $secondaryColor }};
            color: white;
        }

        .classic-table th {
            padding: 18px 20px;
            text-align: left;
            font-size: 16px;
            font-weight: 700;
            border: none;
        }

        .classic-table td {
            padding: 18px 20px;
            border: 1px solid #E0E0E0;
            font-size: 15px;
            font-weight: 500;
            color: #333;
        }

        .classic-table tbody tr:nth-child(even) {
            background: #F8F8F8;
        }

        /* Hotel Cards */
        .classic-hotel-cards {
            padding: 0 50px 40px;
        }

        .classic-hotel-card {
            background: #F8F8F8;
            border-radius: 12px;
            border: 1px solid #EEE;
            padding: 20px;
            margin-bottom: 30px;
            width: 90%;
        }

        .classic-hotel-card table {
            width: 100%;
        }

        .classic-hotel-image {
            width: 280px;
            height: 180px;
            object-fit: cover;
            border-radius: 12px;
        }

        .classic-hotel-name {
            font-size: 22px;
            font-weight: 700;
            color: {{ $secondaryColor }};
            margin-bottom: 8px;
        }

        .hotel-stars {
            color: #FAA61A;
            margin: 10px 0;
            font-size: 18px;
            font-family: 'DejaVu Sans', sans-serif !important;
        }

        .hotel-day-badge {
            color: {{ $secondaryColor }};
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .classic-hotel-desc {
            font-size: 14px;
            font-weight: 400;
            color: #666;
            line-height: 1.6;
        }

        /* Itinerary Grid - 1 item per row */
        .classic-itinerary-grid {
            padding: 0 50px 40px;
        }

        .classic-day-card {
            background: #FEF9E7;
            border-radius: 15px;
            padding: 15px 25px;
            margin-bottom: 20px;
            width: 90%;
        }

        .classic-day-title {
            font-size: 20px;
            font-weight: 700;
            color: {{ $secondaryColor }};
            margin-bottom: 10px;
        }

        .classic-day-checklist {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: 1fr;
            gap: 0;
        }

        .classic-day-checklist li {
            position: relative;
            padding-left: 25px;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            line-height: 1.4;
        }

        .classic-checkbox {
            position: relative;
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid {{ $secondaryColor }};
            border-radius: 4px;
            vertical-align: middle;
        }

        .classic-day-checklist .classic-checkbox {
            position: absolute;
            left: 0;
            top: 5px;
        }

        /* Inclusion/Exclusion */
        .classic-checklist-table {
            width: 100%;
            border-collapse: collapse;
        }

        .classic-checklist-table thead {
            background: {{ $secondaryColor }};
            color: white;
        }

        .classic-checklist-table th {
            padding: 18px 20px;
            text-align: left;
            font-size: 16px;
            font-weight: 700;
        }

        .classic-checklist-table td {
            padding: 16px 20px;
            border: 1px solid #E0E0E0;
            font-size: 15px;
            font-weight: 500;
            color: #333;
        }

        .classic-checklist-table td:last-child {
            text-align: center;
            width: 120px;
        }

        .check-icon-cell {
            width: 120px;
            text-align: center;
        }

        .classic-check-icon {
            width: 24px;
            height: 24px;
            border: 2px solid {{ $secondaryColor }};
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
        }

        .classic-check-icon.checked {
            background: {{ $secondaryColor }};
            color: white;
        }

        .classic-check-icon.checked::after {
            content: '✓';
        }

        .classic-check-icon.unchecked {
            background: transparent;
            color: {{ $secondaryColor }};
        }

        .classic-check-icon.unchecked::after {
            content: '✕';
        }

        /* Policy Section */
        .policy-item {
            margin-bottom: 25px;
        }

        .policy-title {
            color: {{ $secondaryColor }};
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 10px;
            border-bottom: 2px solid {{ $secondaryColor }};
            display: inline-block;
            padding-right: 20px;
        }

        .policy-list {
            list-style: none;
            padding: 0;
            margin-top: 10px;
        }

        .policy-list li {
            margin-bottom: 8px;
            padding-left: 20px;
            position: relative;
            font-size: 13px;
            color: #444;
            line-height: 1.4;
        }

        .policy-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: {{ $secondaryColor }};
            font-weight: bold;
        }

        /* Important Box */
        .important-box {
            background: #F8F8F8;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .important-title {
            font-size: 20px;
            font-weight: 800;
            color: {{ $secondaryColor }};
            margin-bottom: 15px;
        }

        /* Footer Banner */
        .footer-banner {
            background: {{ $secondaryColor }};
            border-radius: 15px;
            padding: 25px;
            color: white;
        }

        .footer-banner table {
            width: 100%;
        }

        .footer-whatsapp {
            font-size: 20px;
            font-weight: 800;
            color: white;
        }

        .footer-agency {
            font-size: 24px;
            font-weight: 900;
            color: white;
            text-align: right;
        }

        /* Page Footer */
        .classic-footer {
            position: absolute;
            bottom: 30px;
            left: 50px;
            right: 50px;
            border-top: 1px solid #eee;
            padding-top: 12px;
            font-size: 12px;
            color: #666;
        }

        .classic-footer table {
            width: 100%;
        }

        .classic-footer.light {
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            opacity: 0.8;
        }

        /* Thank You Page */
        .thank-you-page {
            background: {{ $secondaryColor }};
            color: white;
            text-align: center;
        }

        .thank-you-title {
            font-size: 80px;
            font-weight: 900;
            letter-spacing: 4px;
            font-style: italic;
            padding-top: 250px;
            margin-bottom: 20px;
        }

        .thank-you-line {
            height: 4px;
            width: 200px;
            background: {{ $primaryColor }};
            margin: 0 auto 30px;
        }

        .thank-you-agency {
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 8px;
            text-transform: uppercase;
            opacity: 0.9;
        }
    </style>
</head>

<body>
    @if (isset($watermarkBase64) && $watermarkBase64)
        <div class="watermark" style="opacity: 0.2; z-index: 1000; pointer-events: none;">
            <img src="{{ $watermarkBase64 }}" style="width: 800px;">
        </div>
    @endif
    <!-- PAGE 1: Cover -->
    <div class="classic-page">
        <div class="br-header-box">
            @if (isset($logoBase64) && $logoBase64)
                <img src="{{ $logoBase64 }}" class="br-header-logo" alt="Logo">
            @else
                <h1>{{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</h1>
                <p>TRAVEL SIMPLIFIED</p>
            @endif
        </div>

        <div class="classic-hero">
            <img class="classic-hero-img"
                src="{{ $tripImageBase64 ?: ($trip->image_path ? $trip->image_url : 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&q=80&w=2000') }}"
                alt="Trip cover">
            <div class="classic-hero-overlay"></div>
            <div class="classic-hero-content">
                <h1 class="classic-title">
                    {{ $trip->duration ?? 0 }} NIGHTS {{ (int) ($trip->duration ?? 0) + 1 }} DAYS
                </h1>
                <p class="classic-subtitle">
                    TRAVEL ITINERARY BY {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}
                </p>
            </div>
        </div>

        <div class="classic-destination-banner">
            <table>
                <tr>
                    <td style="width: 30%; vertical-align: middle; padding-right: 8px;">
                        <div style="display: inline-block; vertical-align: middle; max-width: 160px;">
                            <div class="classic-destination-label">Destination</div>
                            <div class="classic-destination-value"
                                style="word-wrap: break-word; overflow-wrap: break-word; white-space: normal;">
                                {{ $trip->destination ?? 'Adventure Awaits' }}</div>
                        </div>
                    </td>
                    <td style="width: 18%; text-align: center; vertical-align: middle; padding: 0 5px;">
                        <div class="classic-destination-label">Trip ID</div>
                        <div class="classic-destination-value">#{{ $trip->id }}</div>
                    </td>
                    <td style="width: 24%; text-align: center; vertical-align: middle; padding: 0 5px;">
                        <div class="classic-destination-label">Pax</div>
                        <div class="classic-destination-value">
                            {{ $trip->adults ? $trip->adults . ' Adults' : '2 Adults' }}
                            @php
                                $kidsCountTotal =
                                    ($trip->kids_cnb ?? ($trip->kids_upto_5 ?? 0)) + ($trip->kids_5_to_12 ?? 0);
                            @endphp
                            {{ $kidsCountTotal > 0 ? ', ' . $kidsCountTotal . ' Kids' : '' }}
                        </div>
                    </td>
                    <td style="width: 28%; text-align: right; vertical-align: middle; padding-left: 8px;">
                        <div class="classic-destination-label">Start Date</div>
                        <div class="classic-destination-value">
                            {{ $trip->start_date ? \Carbon\Carbon::parse($trip->start_date)->format('d/m/Y') : 'Not Set' }}
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="classic-highlights">
            <div class="classic-highlights-title">Greetings!</div>
            <div style="padding-right: 50px;">
                <p style="font-size: 18px; color: #333; font-weight: 700; margin-bottom: 10px;">
                    Dear {{ $trip->client_name ?? 'Guest' }},
                </p>
                <p style="font-size: 15px; color: #666; line-height: 1.5; margin-bottom: 15px;">
                    {{ str_replace('{agencyName}', strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR'), $agencySettings?->greeting_message ?? 'Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.') }}
                </p>

                <div class="quote-card">
                    <div class="quote-label">Quote Price</div>
                    <div class="quote-price">
                        <span
                            class="quote-currency">{{ preg_replace('/\s*\(.*?\)\s*/', '', $trip->currency ?? 'INR') }}</span>
                        {{ number_format($trip->cost ?? 0, 0) }}/-
                    </div>
                    <div style="font-size: 12px; color: #888; font-style: italic; margin-top: 5px; text-align: right;">
                        {{ $trip->include_gst ? 'including GST/-' : 'excluding GST/-' }}
                    </div>
                </div>
            </div>
        </div>

        <div class="classic-footer">
            <table>
                <tr>
                    <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                    <td style="width: 34%; text-align: center; font-weight: 600;">
                        {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                    <td style="width: 33%; text-align: right;">{{ $agencySettings?->website ?? 'www.viakashmir.com' }}
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- PAGE 2: Trip Highlights -->
    @if ($trip->itineraries && $trip->itineraries->count() > 0)
        @foreach ($trip->itineraries->chunk(6) as $chunkIndex => $chunk)
            <div class="classic-page">
                <div class="classic-section-header">
                    <table>
                        <tr>
                            <td style="vertical-align: middle;">
                                <span class="classic-section-title">Trip Highlights</span>
                            </td>
                            <td style="text-align: right;">
                                @if (isset($logoBase64) && $logoBase64)
                                    <img src="{{ $logoBase64 }}" class="classic-section-logo">
                                @endif
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="classic-highlights-grid">
                    @foreach ($chunk->chunk(3) as $row)
                        <table>
                            <tr>
                                @foreach ($row as $item)
                                    <td class="classic-highlight-card">
                                        <img src="{{ isset($item->image_base64) ? $item->image_base64 : ($item->image_path ? $item->image_url : 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=400') }}"
                                            class="classic-highlight-image">
                                        <div class="classic-highlight-title">
                                            {{ preg_replace('/^Day \d+:\s*/i', '', $item->title) }}</div>
                                    </td>
                                @endforeach
                            </tr>
                        </table>
                    @endforeach
                </div>

                <div class="classic-footer">
                    <table>
                        <tr>
                            <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                            <td style="width: 34%; text-align: center; font-weight: 600;">
                                {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                            <td style="width: 33%; text-align: right;">
                                {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        @endforeach
    @endif

    <!-- PAGE 3: Accommodation Info -->
    @php
        if ($trip->accommodations) {
            $groupedAccommodations = $trip->accommodations->sortBy('check_in')->groupBy(function ($hotel) {
                $hotelName = $hotel->hotel ? $hotel->hotel->name : $hotel->name ?? ($hotel->hotel_name ?? '');
                $hotelCity = $hotel->hotel ? $hotel->hotel->city : $hotel->city ?? '';
                return $hotelName . '|' . $hotelCity . '|' . $hotel->category . '|' . ($hotel->room_type ?? 'Standard');
            });
        }
    @endphp
    @if ($trip->accommodations && $trip->accommodations->count() > 0)
        {{-- Page 1: Accommodation Summary Table --}}
        <div class="classic-page">
            <div class="classic-section-header">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Accommodation</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div class="classic-table-container">
                <table class="classic-table">
                    <thead>
                        <tr>
                            <th>City</th>
                            <th>Hotel</th>
                            <th>Room Type</th>
                            <th>Rooms</th>
                            <th>Extra Beds</th>
                            <th>Meal Plan</th>
                            <th>Nights</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($groupedAccommodations as $groupKey => $groupItems)
                            @php
                                $hotel = $groupItems->first();
                                $hotelName = $hotel->hotel
                                    ? $hotel->hotel->name
                                    : $hotel->name ?? ($hotel->hotel_name ?? null);
                                $hotelCity = $hotel->hotel ? $hotel->hotel->city : $hotel->city ?? null;
                                $totalNights = $groupItems->reduce(function ($carry, $item) {
                                    if ($item->check_in && $item->check_out) {
                                        $cIn = \Carbon\Carbon::parse($item->check_in);
                                        $cOut = \Carbon\Carbon::parse($item->check_out);
                                        $diff = $cIn->diffInDays($cOut);
                                        return $carry + ($diff > 0 ? $diff : 1);
                                    }
                                    return $carry + 1;
                                }, 0);
                            @endphp
                            <tr>
                                <td>{{ $hotelCity ?? '-' }}</td>
                                <td>{{ $hotelName ?? '-' }}</td>
                                <td>{{ $hotel->room_type ?? '-' }}</td>
                                <td>{{ $hotel->rooms ?? '-' }}</td>
                                @php
                                    $totalExtraBeds =
                                        (int) ($hotel->extra_beds_5_to_12_count ?? 0) +
                                        (int) ($hotel->extra_beds_above_12_count ?? 0);
                                    if ($totalExtraBeds < 1) {
                                        $totalExtraBeds = (int) ($hotel->beds ?? 0);
                                    }
                                @endphp
                                <td>{{ $totalExtraBeds ?: '-' }}
                                </td>
                                <td>{{ $hotel->meal_plan ?? '-' }}</td>
                                <td>{{ $totalNights }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>

        {{-- Subsequent Pages: Hotel Details (3 per page) --}}
        @foreach ($groupedAccommodations->chunk(3) as $pageIndex => $chunk)
            <div class="classic-page">
                <div class="classic-section-header">
                    <table>
                        <tr>
                            <td style="vertical-align: middle;">
                                <span class="classic-section-title">Accommodation</span>
                            </td>
                            <td style="text-align: right;">
                                @if (isset($logoBase64) && $logoBase64)
                                    <img src="{{ $logoBase64 }}" class="classic-section-logo">
                                @endif
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="classic-hotel-cards">
                    @foreach ($chunk as $groupKey => $groupItems)
                        @php
                            $hotel = $groupItems->first();
                            $hotelName = $hotel->hotel
                                ? $hotel->hotel->name
                                : $hotel->name ?? ($hotel->hotel_name ?? null);
                            $hotelCity = $hotel->hotel ? $hotel->hotel->city : $hotel->city ?? null;
                            $getOrdinal = function ($n) {
                                $s = ['th', 'st', 'nd', 'rd'];
                                $v = (int) $n % 100;
                                return $n . ($s[($v - 20) % 10] ?? ($s[$v] ?? $s[0]));
                            };

                            $stayGroups = [];
                            foreach ($groupItems as $item) {
                                if ($item->check_in && $trip->start_date) {
                                    $cIn = \Carbon\Carbon::parse($item->check_in);
                                    $sDate = \Carbon\Carbon::parse($trip->start_date);
                                    $startDayNum = $cIn->diffInDays($sDate) + 1;

                                    $nights = 1;
                                    if ($item->check_out) {
                                        $cOut = \Carbon\Carbon::parse($item->check_out);
                                        $nights = $cIn->diffInDays($cOut);
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

                            if (count($stayGroups) > 2) {
                                $last = array_pop($stayGroups);
                                $dayBadge = implode(', ', $stayGroups) . ' & ' . $last;
                            } elseif (count($stayGroups) == 2) {
                                $dayBadge = $stayGroups[0] . ' & ' . $stayGroups[1];
                            } elseif (count($stayGroups) == 1) {
                                $dayBadge = $stayGroups[0];
                            } else {
                                $dayBadge = 'Accommodation';
                            }
                        @endphp
                        <div class="classic-hotel-card">
                            <table>
                                <tr>
                                    <td style="width: 280px; vertical-align: top;">
                                        <img src="{{ isset($hotel->image_base64) ? $hotel->image_base64 : ($hotel->image_path ? $hotel->image_url : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=400') }}"
                                            class="classic-hotel-image">
                                    </td>
                                    <td style="padding-left: 30px; vertical-align: top;">
                                        <div class="classic-hotel-name">{{ $hotelName ?? 'Hotel' }},
                                            {{ $hotelCity ?? 'City' }}</div>
                                        <div class="hotel-stars">
                                            {{ str_repeat('★', (int) ($hotel->category ?? 0)) }}{{ str_repeat('☆', 5 - (int) ($hotel->category ?? 0)) }}
                                        </div>
                                        @if ($dayBadge)
                                            <div class="hotel-day-badge">{{ $dayBadge }}</div>
                                        @endif
                                        <div class="classic-hotel-desc">
                                            @if ($hotel->rooms)
                                                <span>{{ $hotel->rooms }} Rooms</span>
                                            @endif
                                            @if ($hotel->room_type)
                                                <span>{{ $hotel->rooms ? ' • ' : '' }}{{ $hotel->room_type }}</span>
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
                                                <span>{{ $hotel->rooms || $hotel->room_type ? ' • ' : '' }}{{ $hotel->beds }}
                                                    Extra Bed{{ $totalExtraBeds > 1 ? 's' : '' }}
                                                    @if (isset($hotel->extra_bed_category))
                                                        ({{ $hotel->extra_bed_category == 'cnb' ? 'CNB' : ($hotel->extra_bed_category == 'above_12' ? 'ABOVE 12Y' : '5-12Y') }})
                                                    @elseif(isset($hotel->extraBedCategory))
                                                        ({{ $hotel->extraBedCategory == 'cnb' ? 'CNB' : ($hotel->extraBedCategory == 'above_12' ? 'ABOVE 12Y' : '5-12Y') }})
                                                    @endif
                                                </span>
                                            @endif
                                            @if ($hotel->meal_plan)
                                                <span>{{ $hotel->rooms || $hotel->room_type || $hotel->beds ? ' • ' : '' }}{{ $hotel->meal_plan }}</span>
                                            @endif
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    @endforeach
                </div>

                <div class="classic-footer">
                    <table>
                        <tr>
                            <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                            <td style="width: 34%; text-align: center; font-weight: 600;">
                                {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                            <td style="width: 33%; text-align: right;">
                                {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        @endforeach
    @else
        <div class="classic-page">
            <div class="classic-section-header">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Accommodation</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding: 30px; text-align: center; color: #666;">
                <h3 style="font-size: 24px; font-weight: 800; color: {{ $secondaryColor ?? '#000' }};">
                    HOTEL BOOKED BY GUEST
                </h3>
                <p style="margin-top: 10px;">No accommodation details have been added to this quote.</p>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- PAGE 4: Transportation Info -->
    @if ($trip->transportations && $trip->transportations->count() > 0)
        <div class="classic-page">
            <div class="classic-section-header">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Transportation Info</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div class="classic-table-container">
                <table class="classic-table">
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
                        @foreach ($sortedTransports as $index => $transport)
                            @php
                                $uniqueTransportDates = $sortedTransports
                                    ->pluck('date')
                                    ->filter()
                                    ->unique()
                                    ->sort()
                                    ->values();
                                $dayNum = $transport->date
                                    ? $uniqueTransportDates->search($transport->date) + 1
                                    : $index + 1;
                                $suffixes = ['st', 'nd', 'rd'];
                                $mod10 = $dayNum % 10;
                                $mod100 = $dayNum % 100;
                                $suffix =
                                    $mod10 > 0 && $mod10 < 4 && ($mod100 < 11 || $mod100 > 13)
                                        ? $suffixes[$mod10 - 1]
                                        : 'th';
                                $dayLabel = $dayNum . $suffix . ' Day';
                            @endphp
                            <tr>
                                <td>{{ $dayLabel }}</td>
                                <td style="text-transform: uppercase; font-size: 11px;">
                                    {{ $transport->trip_type ?? 'Transfer' }}</td>
                                <td>{{ $transport->route ?? '-' }}</td>
                                <td style="font-weight: 700; color: #000000;">
                                    {{ $transport->quantity ?? '1' }}
                                </td>
                                <td>{{ $transport->vehicle_type ?? '-' }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @else
        <div class="classic-page">
            <div class="classic-section-header">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Transportation Info</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding: 30px; text-align: center; color: #666;">
                <h3 style="font-size: 24px; font-weight: 800; color: {{ $secondaryColor }};">
                    TRANSPORT BOOKED BY GUEST
                </h3>
                <p style="margin-top: 10px;">No transportation details have been added to this quote.</p>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- PAGE 5: Daily Itinerary -->
    @php
        // Check if any itinerary has meaningful content
        $hasItineraryContent = false;
        if ($trip->itineraries && $trip->itineraries->count() > 0) {
            foreach ($trip->itineraries as $day) {
                if (trim($day->description) || (isset($day->title) && !preg_match('/^Day \d+/i', $day->title))) {
                    $hasItineraryContent = true;
                    break;
                }
            }
        }
    @endphp

    @if ($hasItineraryContent)
        @foreach ($trip->itineraries->chunk(8) as $chunkIndex => $chunk)
            <div class="classic-page">
                @if ($chunkIndex === 0)
                    <div class="classic-section-header">
                        <table>
                            <tr>
                                <td style="vertical-align: middle;">
                                    <span class="classic-section-title">Daily Itinerary</span>
                                </td>
                                <td style="text-align: right;">
                                    @if (isset($logoBase64) && $logoBase64)
                                        <img src="{{ $logoBase64 }}" class="classic-section-logo">
                                    @endif
                                </td>
                            </tr>
                        </table>
                    </div>
                @endif

                <div class="classic-itinerary-grid">
                    @foreach ($chunk as $index => $day)
                        @if (trim($day->description) || (isset($day->title) && !preg_match('/^Day \d+/i', $day->title)))
                            <div class="classic-day-card">
                                <div class="classic-day-title">Day {{ $day->day ?? $chunkIndex * 8 + $index + 1 }}
                                    @php
                                        $dayIdx =
                                            (int) ($day->day ?? ($day->day_number ?? $chunkIndex * 8 + $index + 1)) - 1;
                                        $dayTransport = $trip->transportations->sortBy('date')->values()->get($dayIdx);
                                        if ($dayTransport && $dayTransport->route) {
                                            echo ' : ' . $dayTransport->route;
                                        }
                                    @endphp
                                </div>
                                <ul class="classic-day-checklist">
                                    @if ($day->description)
                                        @foreach (array_slice(array_filter(explode("\n", $day->description), fn($line) => trim($line)), 0, 5) as $line)
                                            <li>
                                                <div class="classic-checkbox"></div>
                                                <span>{{ preg_replace('/^[-•*]\s*/', '', trim($line)) }}</span>
                                            </li>
                                        @endforeach
                                    @else
                                        <li>
                                            <div class="classic-checkbox"></div>
                                            <span>{{ preg_replace('/^Day \d+:\s*/i', '', $day->title) }}</span>
                                        </li>
                                    @endif
                                </ul>
                            </div>
                        @endif
                    @endforeach
                </div>

                <div class="classic-footer">
                    <table>
                        <tr>
                            <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                            <td style="width: 34%; text-align: center; font-weight: 600;">
                                {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                            <td style="width: 33%; text-align: right;">
                                {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                        </tr>
                    </table>
                </div>
            </div>
        @endforeach
    @else
        <div class="classic-page">
            <div class="classic-section-header">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Daily Itinerary</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding: 30px; text-align: center;">
                <div style="background: #F9F9F9; border-radius: 15px; padding: 40px; border: 1px dashed #DDD;">
                    <h3 style="font-size: 24px; font-weight: 800; color: {{ $secondaryColor }};">
                        ITINERARY PENDING
                    </h3>
                    <p style="margin-top: 10px; color: #666;">
                        No daily itinerary details have been added to this quote yet.
                    </p>
                </div>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif


    <!-- TRANSPORTATION INFORMATION PAGE -->
    @if ($trip->use_flight && !empty($trip->transport_details))
        <div class="classic-page">
            <div class="classic-section-header" style="margin-top: 0; margin-bottom: 30px;">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">TRANSPORTATION INFORMATION</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div style="padding: 10px 40px;">
                @foreach ($trip->transport_details as $transport)
                    @php
                        $transport = (object) $transport;
                        $tType = $transport->transportType ?? 'Flight';
                    @endphp
                    <div
                        style="background: #f8f9fa; border-radius: 16px; padding: 15px 25px; border: 1px solid #eee; color: {{ $secondaryColor ?? '#0D2D2D' }}; margin-bottom: 20px;">

                        <!-- Airline and Flight Number with PNR -->
                        <table width="100%" cellpadding="0" cellspacing="0"
                            style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd;">
                            <tr>
                                <td style="font-size: 14px; color: {{ $secondaryColor ?? '#0D2D2D' }};">
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
                                        style="font-size: 14px; font-weight: 700; letter-spacing: 1px; color: {{ $secondaryColor ?? '#0D2D2D' }};">{{ $transport->pnrNumber ?? 'N/A' }}</span>
                                </td>
                            </tr>
                        </table>

                        <!-- Flight Timeline -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                            <tr>
                                <td width="30%" style="vertical-align: top;">
                                    <p
                                        style="font-size: 20px; font-weight: 700; color: {{ $secondaryColor ?? '#0D2D2D' }}; margin: 0; line-height: 1;">
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
                                        style="font-size: 20px; font-weight: 700; color: {{ $secondaryColor ?? '#0D2D2D' }}; margin: 0; line-height: 1;">
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
                            <span
                                style="font-size: 11px; font-weight: 500; color: {{ $secondaryColor ?? '#0D2D2D' }};">
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

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- PAGE 6: Inclusions/Exclusions -->
    <div class="classic-page">
        <div class="classic-section-header">
            <table>
                <tr>
                    <td style="vertical-align: middle;">
                        <span class="classic-section-title">Inclusion/Exclusion</span>
                    </td>
                    <td style="text-align: right;">
                        @if (isset($logoBase64) && $logoBase64)
                            <img src="{{ $logoBase64 }}" class="classic-section-logo">
                        @endif
                    </td>
                </tr>
            </table>
        </div>

        <div class="classic-table-container">
            <table class="classic-checklist-table" style="margin-bottom: 40px;">
                <thead>
                    <tr>
                        <th>Inclusions</th>
                        <th class="check-icon-cell">Checklist</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($trip->inclusions as $inc)
                        @php
                            $text = '';
                            if (is_array($inc)) {
                                $text = is_array($inc['content'] ?? '')
                                    ? json_encode($inc['content'])
                                    : $inc['content'] ?? '';
                            } else {
                                $text = $inc;
                            }
                        @endphp
                        <tr>
                            <td>{{ $text }}</td>
                            <td class="check-icon-cell">
                                <div class="classic-checkbox"></div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="2"
                                style="text-align: center; color: #666; padding: 20px; border: 1px dashed #ccc;">
                                No inclusion details added.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>

            <table class="classic-checklist-table">
                <thead>
                    <tr>
                        <th>Exclusions</th>
                        <th class="check-icon-cell">Checklist</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($trip->exclusions as $exc)
                        @php
                            $text = '';
                            if (is_array($exc)) {
                                $text = is_array($exc['content'] ?? '')
                                    ? json_encode($exc['content'])
                                    : $exc['content'] ?? '';
                            } else {
                                $text = $exc;
                            }
                        @endphp
                        <tr>
                            <td>{{ $text }}</td>
                            <td class="check-icon-cell">
                                <div class="classic-checkbox"></div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="2"
                                style="text-align: center; color: #666; padding: 20px; border: 1px dashed #ccc;">
                                No exclusion details added.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div class="classic-footer">
            <table>
                <tr>
                    <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                    <td style="width: 34%; text-align: center; font-weight: 600;">
                        {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                    <td style="width: 33%; text-align: right;">
                        {{ $agencySettings?->website ?? 'www.viakashmir.com' }}
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- PAGE 7: Policies -->
    @if ($policies)
        <div class="classic-page">
            <div class="classic-section-header" style="margin-top: 0;">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="classic-section-title">Policies</span>
                        </td>
                        <td style="text-align: right;">
                            @if (isset($logoBase64) && $logoBase64)
                                <img src="{{ $logoBase64 }}" class="classic-section-logo">
                            @endif
                        </td>
                    </tr>
                </table>
            </div>

            <div class="classic-table-container" style="padding: 0 40px;">
                @if ($policies->terms_conditions)
                    <div style="margin-bottom: 15px;">
                        <h3
                            style="color: {{ $secondaryColor }}; font-size: 20px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid {{ $secondaryColor }}; display: inline-block; padding-right: 20px;">
                            Terms & Conditions
                        </h3>
                        <ul style="list-style: none; margin-top: 10px; padding: 0;">
                            @foreach (is_array($policies->terms_conditions) ? $policies->terms_conditions : explode("\n", $policies->terms_conditions) as $line)
                                @if (trim($line))
                                    <li
                                        style="margin-bottom: 8px; padding-left: 20px; position: relative; font-size: 14px; color: #444; line-height: 1.4;">
                                        <span
                                            style="position: absolute; left: 0; color: {{ $secondaryColor }}; font-weight: bold;">•</span>
                                        {{ trim($line) }}
                                    </li>
                                @endif
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if ($policies->cancellation_policy)
                    <div style="margin-bottom: 15px;">
                        <h3
                            style="color: {{ $secondaryColor }}; font-size: 20px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid {{ $secondaryColor }}; display: inline-block; padding-right: 20px;">
                            Cancellation Policy
                        </h3>
                        <ul style="list-style: none; margin-top: 10px; padding: 0;">
                            @foreach (is_array($policies->cancellation_policy) ? $policies->cancellation_policy : explode("\n", $policies->cancellation_policy) as $line)
                                @if (trim($line))
                                    <li
                                        style="margin-bottom: 8px; padding-left: 20px; position: relative; font-size: 14px; color: #444; line-height: 1.4;">
                                        <span
                                            style="position: absolute; left: 0; color: {{ $secondaryColor }}; font-weight: bold;">•</span>
                                        {{ trim($line) }}
                                    </li>
                                @endif
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if ($policies->additional_expenses)
                    <div style="margin-bottom: 15px;">
                        <h3
                            style="color: {{ $secondaryColor }}; font-size: 20px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid {{ $secondaryColor }}; display: inline-block; padding-right: 20px;">
                            Additional Expenses (Indicative)
                        </h3>
                        <ul style="list-style: none; margin-top: 10px; padding: 0;">
                            @foreach (is_array($policies->additional_expenses) ? $policies->additional_expenses : explode("\n", $policies->additional_expenses) as $line)
                                @if (trim($line))
                                    <li
                                        style="margin-bottom: 8px; padding-left: 20px; position: relative; font-size: 14px; color: #444; line-height: 1.4;">
                                        <span
                                            style="position: absolute; left: 0; color: {{ $secondaryColor }}; font-weight: bold;">•</span>
                                        {{ trim($line) }}
                                    </li>
                                @endif
                            @endforeach
                        </ul>
                    </div>
                @endif

                <p style="font-size: 14px; font-weight: 600; margin-top: 10px; color: {{ $secondaryColor }};">
                    Note: Government-fixed rates for activities will be shared separately.
                </p>
            </div>

            <div class="classic-footer">
                <table>
                    <tr>
                        <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                        <td style="width: 34%; text-align: center; font-weight: 600;">
                            {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                        <td style="width: 33%; text-align: right;">
                            {{ $agencySettings?->website ?? 'www.viakashmir.com' }}</td>
                    </tr>
                </table>
            </div>
        </div>
    @endif

    <!-- PAGE 8: Important Details -->
    <div class="classic-page">
        <div class="classic-section-header" style="margin-top: 0;">
            <table>
                <tr>
                    <td style="vertical-align: middle;">
                        <span class="classic-section-title">Important Details</span>
                    </td>
                    <td style="text-align: right;">
                        @if (isset($logoBase64) && $logoBase64)
                            <img src="{{ $logoBase64 }}" class="classic-section-logo">
                        @endif
                    </td>
                </tr>
            </table>
        </div>

        <div class="classic-table-container" style="padding: 0 50px;">
            @if ($policies && ($policies->must_haves || $policies->roles_responsibilities))
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: none;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 20px; border: none;">
                            @if ($policies->must_haves)
                                <h3
                                    style="color: {{ $secondaryColor }}; font-size: 18px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid {{ $secondaryColor }}; display: inline-block; padding-right: 20px;">
                                    Must Haves
                                </h3>
                                <ul style="list-style: none; margin-top: 10px; padding: 0;">
                                    @foreach (is_array($policies->must_haves) ? $policies->must_haves : explode("\n", $policies->must_haves) as $line)
                                        @if (trim($line))
                                            <li
                                                style="margin-bottom: 6px; padding-left: 15px; position: relative; font-size: 13px; color: #444; line-height: 1.3;">
                                                <span
                                                    style="position: absolute; left: 0; color: {{ $secondaryColor }}; font-weight: bold;">•</span>
                                                {{ trim($line) }}
                                            </li>
                                        @endif
                                    @endforeach
                                </ul>
                            @endif
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 20px; border: none;">
                            @if ($policies->roles_responsibilities)
                                <h3
                                    style="color: {{ $secondaryColor }}; font-size: 18px; font-weight: 800; margin-bottom: 10px; border-bottom: 2px solid {{ $secondaryColor }}; display: inline-block; padding-right: 20px;">
                                    Roles & Responsibilities
                                </h3>
                                <ul style="list-style: none; margin-top: 10px; padding: 0;">
                                    @foreach (is_array($policies->roles_responsibilities) ? $policies->roles_responsibilities : explode("\n", $policies->roles_responsibilities) as $line)
                                        @if (trim($line))
                                            <li
                                                style="margin-bottom: 6px; padding-left: 15px; position: relative; font-size: 13px; color: #444; line-height: 1.3;">
                                                <span
                                                    style="position: absolute; left: 0; color: {{ $secondaryColor }}; font-weight: bold;">•</span>
                                                {{ trim($line) }}
                                            </li>
                                        @endif
                                    @endforeach
                                </ul>
                            @endif
                        </td>
                    </tr>
                </table>
            @endif

            <div
                style="background: #F8F8F8; border-radius: 15px; padding: 25px; margin-bottom: 30px; border: 1px solid #E0E0E0;">
                <h3 style="font-size: 20px; font-weight: 800; color: {{ $secondaryColor }}; margin-bottom: 15px;">
                    Payment Details:
                </h3>
                <div style="font-size: 15px; color: #333; line-height: 1.8;">
                    <p style="margin-bottom: 8px;"><span style="font-weight: 700;">Beneficiary Name:</span>
                        {{ $agencySettings?->beneficiary_name ?? 'N/A' }}</p>
                    <p style="margin-bottom: 8px;"><span style="font-weight: 700;">Bank Name:</span>
                        {{ $agencySettings?->bank_name ?? 'N/A' }}</p>
                    <p style="margin-bottom: 8px;"><span style="font-weight: 700;">Account Number:</span>
                        {{ $agencySettings?->account_number ?? 'N/A' }}</p>
                    <p style="margin-bottom: 0;"><span style="font-weight: 700;">IFSC CODE:</span>
                        {{ $agencySettings?->ifsc_code ?? 'N/A' }}
                    </p>
                </div>
            </div>

            <div
                style="background: {{ $secondaryColor }}; border-radius: 15px; padding: 25px; color: white; display: block;">
                <table style="width: 100%; border-collapse: collapse; border: none;">
                    <tr>
                        <td style="vertical-align: middle; padding: 0; border: none;">
                            <div style="display: table;">
                                <div style="display: table-cell; vertical-align: middle;">
                                    <div style="font-size: 20px; font-weight: 800; color: white;">
                                        {{ $agencySettings?->whatsapp ?? 'N/A' }}</div>
                                    <div style="font-size: 12px; color: white; opacity: 0.8;">WhatsApp Support</div>
                                </div>
                            </div>
                        </td>
                        <td style="text-align: right; vertical-align: middle; padding: 0; border: none;">
                            <div style="font-size: 12px; color: white; opacity: 0.8; margin-bottom: 3px;">Your Travel
                                Partner</div>
                            <div style="font-size: 24px; font-weight: 900; color: white; text-transform: uppercase;">
                                {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="classic-footer">
            <table>
                <tr>
                    <td style="width: 33%;"> {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                    <td style="width: 34%; text-align: center; font-weight: 600;">
                        {{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</td>
                    <td style="width: 33%; text-align: right;">
                        {{ $agencySettings?->website ?? 'www.viakashmir.com' }}
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- PAGE 9: Thank You -->
    <div class="classic-page thank-you-page">
        <div class="thank-you-title">THANK YOU!</div>
        <div class="thank-you-line"></div>
        <div class="thank-you-agency">{{ strtoupper($agencySettings?->agency_name ?? 'VIA KASHMIR') }}</div>
        @if (filled($agencySettings?->company_address))
            <div
                style="margin-top: 10px; font-size: 14px; font-weight: 500; color: white; text-align: center; max-width: 70%;">
                {{ $agencySettings->company_address }}
            </div>
        @endif

        <div
            style="position: absolute; bottom: 50px; left: 50px; right: 50px; color: white; font-size: 11px; font-weight: 600;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td align="center" style="vertical-align: middle; padding-bottom: 12px;">
                        <span
                            style="background-color: {{ $primaryColor }}; color: {{ $secondaryColor }}; padding: 6px 15px; border-radius: 25px; font-weight: 800; text-transform: uppercase; font-size: 11px; display: inline-block; line-height: 1; white-space: nowrap;">
                            Contact Us
                        </span>
                    </td>
                </tr>
                <tr>
                    <td width="30%" style="vertical-align: middle;">
                        @if (isset($logoBase64) && $logoBase64)
                            <img src="{{ $logoBase64 }}"
                                style="max-height: 80px; max-width: 280px; object-fit: contain;">
                        @elseif($agencySettings?->logo_url)
                            <img src="{{ $agencySettings?->logo_url }}"
                                style="max-height: 80px; max-width: 280px; object-fit: contain;">
                        @endif
                    </td>
                    <td style="vertical-align: middle; white-space: nowrap;"><b>WA:</b>
                        {{ $agencySettings?->whatsapp ?? 'N/A' }}</td>
                    <td align="right" style="vertical-align: middle; white-space: nowrap;">
                        {{ $agencySettings?->website ?? 'www.viakashmir.com' }}
                    </td>
                </tr>
            </table>
        </div>
    </div>
</body>

</html>
