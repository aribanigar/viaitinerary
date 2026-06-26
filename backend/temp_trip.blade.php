<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>{{ $trip->trip_title }}</title>
    <style>
        @page {
            margin: 0;
        }

        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            line-height: 1.5;
        }

        .header {
            background-color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            margin: 0;
            font-size: 28px;
            text-transform: uppercase;
        }

        .header p {
            margin: 5px 0 0;
            font-size: 16px;
            opacity: 0.9;
        }

        .container {
            padding: 40px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-size: 20px;
            border-bottom: 2px solid {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            padding-bottom: 5px;
            margin-bottom: 15px;
            text-transform: uppercase;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        th,
        td {
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }

        th {
            background-color: #f9f9f9;
            font-weight: bold;
        }

        .itinerary-item {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }

        .itinerary-day {
            font-weight: bold;
            color: {{ $agencySettings?->brand_color ?? '#FAA61A' }};
            font-size: 18px;
        }

        .itinerary-title {
            font-weight: bold;
            font-size: 16px;
        }

        .footer {
            background-color: #0D2D2D;
            color: white;
            padding: 20px 40px;
            position: fixed;
            bottom: 0;
            width: 100%;
            font-size: 12px;
        }

        .footer table {
            margin-bottom: 0;
            border: none;
        }

        .footer td {
            border: none;
            color: white;
            padding: 0;
        }

        .meta-table td {
            border: none;
            padding: 4px 0;
        }

        .meta-label {
            font-weight: bold;
            width: 120px;
        }

        .list-item {
            margin-bottom: 5px;
        }

        .page-break {
            page-break-after: always;
        }
    </style>
</head>

<body>
    <div class="header">
        @if ($logoBase64)
            <img src="{{ $logoBase64 }}" height="60"
                style="margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
        @endif
        <h1>{{ $trip->trip_title }}</h1>
        <p>{{ $trip->destination }} | {{ $trip->duration }}</p>
    </div>

    <div class="container">
        @if ($tripImageBase64)
            <div class="section" style="text-align: center;">
                <img src="{{ $tripImageBase64 }}"
                    style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;">
            </div>
        @endif
        <div class="section">
            <table class="meta-table">
                <tr>
                    <td class="meta-label">Trip ID:</td>
                    <td>{{ $trip->trip_id }}</td>
                    <td class="meta-label">Prepared For:</td>
                    <td>{{ $trip->client_name }}</td>
                </tr>
                <tr>
                    <td class="meta-label">Start Date:</td>
                    <td>{{ $trip->start_date }}</td>
                    <td class="meta-label">Duration:</td>
                    <td>{{ $trip->duration }}</td>
                </tr>
                <tr>
                    <td class="meta-label">Travelers:</td>
                    <td>{{ $trip->pax }}</td>
                    <td class="meta-label">Total Cost:</td>
                    <td>{{ $trip->currency }} {{ number_format($trip->cost, 2) }}</td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">Itinerary</h2>
            @foreach ($trip->itineraries->sortBy('day_number') as $itinerary)
                <div class="itinerary-item">
                    <span class="itinerary-day">Day {{ $itinerary->day_number }}:</span>
                    <span class="itinerary-title">{{ $itinerary->title }}</span>
                    <p style="margin-top: 5px;">{{ $itinerary->description }}</p>
                </div>
            @endforeach
        </div>

        <div class="page-break"></div>

        @if ($trip->accommodations->count() > 0)
            <div class="section">
                <h2 class="section-title">Accommodation</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Hotel/Stay</th>
                            <th>Location</th>
                            <th>Nights</th>
                            <th>Room Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($trip->accommodations as $acc)
                            <tr>
                                <td>{{ $acc->hotel_name }}</td>
                                <td>{{ $acc->location }}</td>
                                <td>{{ $acc->nights }}</td>
                                <td>{{ $acc->room_type }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif

        @if ($trip->transportations->count() > 0)
            <div class="section">
                <h2 class="section-title">Transportation</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($trip->transportations as $trans)
                            <tr>
                                <td>{{ $trans->date }}</td>
                                <td>{{ $trans->vehicle_type }}</td>
                                <td>{{ $trans->remarks }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif

        <div class="section">
            <h2 class="section-title">Inclusions & Exclusions</h2>
            <table style="border: none;">
                <tr>
                    <td style="width: 50%; vertical-align: top; border: none; padding-right: 20px;">
                        <h3 style="color: green; font-size: 16px;">Inclusions</h3>
                        @if (is_array($trip->inclusions))
                            @foreach ($trip->inclusions as $inc)
                                <div class="list-item">Γ£ô {{ is_array($inc) ? $inc['content'] ?? '' : $inc }}</div>
                            @endforeach
                        @endif
                    </td>
                    <td style="width: 50%; vertical-align: top; border: none;">
                        <h3 style="color: red; font-size: 16px;">Exclusions</h3>
                        @if (is_array($trip->exclusions))
                            @foreach ($trip->exclusions as $exc)
                                <div class="list-item">Γ£ù {{ is_array($exc) ? $exc['content'] ?? '' : $exc }}</div>
                            @endforeach
                        @endif
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <div class="footer">
        <table style="width: 100%;">
            <tr>
                <td style="width: 30%;">
                    <strong>{{ $agencySettings?->agency_name ?? 'Travel Agency' }}</strong>
                </td>
                <td style="width: 40%; text-align: center;">
                    {{ $agencySettings?->website ?? '' }}
                </td>
                <td style="width: 30%; text-align: right;">
                    {{ $agencySettings?->contact_phone ?? '' }} @if ($agencySettings?->contact_phone && $agencySettings?->contact_email)
                        |
                    @endif {{ $agencySettings?->contact_email ?? '' }}
                </td>
            </tr>
        </table>
    </div>
</body>

</html>
