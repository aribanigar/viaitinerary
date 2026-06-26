<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Pricing Sheet - {{ $calculation->client_name }}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');

        body {
            font-family: 'Montserrat', 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
            line-height: 1.4;
        }

        .header {
            display: table;
            width: 100%;
            margin-bottom: 40px;
        }

        .header-left {
            display: table-cell;
            vertical-align: top;
        }

        .header-right {
            display: table-cell;
            vertical-align: top;
            text-align: right;
        }

        .logo {
            max-width: 150px;
            max-height: 100px;
        }

        .pricing-title {
            font-size: 36px;
            font-weight: 900;
            margin: 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
        }

        .trip-info {
            margin-top: 20px;
            font-size: 14px;
            color: #444;
        }

        .trip-info div {
            margin-bottom: 5px;
        }

        .info-label {
            font-weight: bold;
            color: #000;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            border: 1px solid #000;
        }

        th {
            background-color: #fff;
            border: 1px solid #000;
            padding: 12px;
            text-align: left;
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        td {
            border: 1px solid #000;
            padding: 12px;
            font-size: 13px;
        }

        .col-item {
            width: 50%;
        }

        .col-price {
            width: 17%;
            text-align: right;
        }

        .col-qty {
            width: 8%;
            text-align: center;
        }

        .col-amount {
            width: 25%;
            text-align: right;
        }

        .summary-container {
            display: table;
            width: 100%;
            margin-top: 30px;
        }

        .summary-notes {
            display: table-cell;
            width: 60%;
            vertical-align: top;
        }

        .summary-table-cell {
            display: table-cell;
            width: 40%;
            vertical-align: top;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
        }

        .summary-table td {
            padding: 10px 12px;
            border: 1px solid #000;
        }

        .summary-label {
            font-weight: bold;
            width: 50%;
        }

        .summary-value {
            text-align: right;
            width: 50%;
        }

        .total-row td {
            font-weight: bold;
            font-size: 16px;
        }

        .notes-title {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .notes-content {
            font-size: 13px;
            color: #666;
        }

        .footer {
            margin-top: 60px;
            display: table;
            width: 100%;
        }

        .footer-col {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }

        .footer-title {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .footer-content {
            font-size: 13px;
            line-height: 1.6;
        }

        .text-bold {
            font-weight: bold;
        }
    </style>
</head>

<body>
    <div class="header">
        <div class="header-left">
            <h1 class="pricing-title">Pricing Sheet</h1>
            <div class="trip-info">
                <div><span class="info-label">Calulation ID:</span> #{{ $calculation->id }}</div>
                <div><span class="info-label">Generated On:</span> {{ date('d/m/Y') }}</div>
                <div><span class="info-label text-bold">GENERATED FOR:</span> {{ $calculation->client_name }}</div>
            </div>
        </div>
        <div class="header-right">
            @if ($logoBase64)
                <img src="{{ $logoBase64 }}" class="logo">
            @elseif ($agencySettings && $agencySettings->agency_name)
                <div style="font-size: 24px; font-weight: bold;">{{ $agencySettings->agency_name }}</div>
            @else
                <div style="font-size: 24px; font-weight: bold;">TRAVEL AGENCY</div>
            @endif
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="col-item">Item & Description</th>
                <th class="col-price">Unit Price</th>
                <th class="col-qty">Qty</th>
                <th class="col-amount">Amount</th>
            </tr>
        </thead>
        <tbody>
            @php
                $subTotal = 0;
            @endphp

            {{-- Hotels --}}
            @foreach ($calculation->selected_hotels as $h)
                @php
                    $hotel = \App\Models\Hotel::find($h['hotel_id']);
                    if (!$hotel) {
                        continue;
                    }

                    $roomType = $h['roomType'] ?? 'deluxe';

                    $sections = is_array($hotel->price_sections)
                        ? $hotel->price_sections
                        : json_decode($hotel->price_sections, true) ?? [];
                    $section = array_filter($sections, function ($s) use ($roomType) {
                        return $s['room_type'] === $roomType;
                    });
                    $section = reset($section) ?: [];

                    $basePrice = (float) ($section['price'] ?? 0);
                    $cnbPrice = (float) ($section['cnb'] ?? 0);
                    $extraBed5To12Price = (float) ($section['upto_5'] ?? 0);
                    $extraBedAbove12Price = (float) ($section['above_12'] ?? 0);
                    $cnbCount = (int) ($h['cnbCount'] ?? ($h['cnb_count'] ?? 0));
                    $extraBeds5To12Count = (int) ($h['extraBeds5To12Count'] ?? ($h['extra_beds_5_to_12_count'] ?? 0));
                    $extraBedsAbove12Count =
                        (int) ($h['extraBedsAbove12Count'] ?? ($h['extra_beds_above_12_count'] ?? 0));
                    if ($cnbCount === 0 && $extraBeds5To12Count === 0 && $extraBedsAbove12Count === 0) {
                        $legacyCategory = $h['extraBedCategory'] ?? '5_to_12';
                        $legacyBeds = (int) ($h['extraBeds'] ?? 0);
                        if ($legacyCategory === 'cnb') {
                            $cnbCount = $legacyBeds;
                        } elseif ($legacyCategory === 'above_12') {
                            $extraBedsAbove12Count = $legacyBeds;
                        } else {
                            $extraBeds5To12Count = $legacyBeds;
                        }
                    }

                    $hotelTotal = $basePrice * (int) $h['rooms'] * (int) $h['nights'];
                    $extraTotal =
                        $cnbPrice * $cnbCount * (int) $h['nights'] +
                        $extraBed5To12Price * $extraBeds5To12Count * (int) $h['nights'] +
                        $extraBedAbove12Price * $extraBedsAbove12Count * (int) $h['nights'];
                    $itemTotal = $hotelTotal + $extraTotal;
                    $subTotal += $itemTotal;

                    $roomTypeNames = [
                        'deluxe' => 'Deluxe',
                        'super_deluxe' => 'Super Deluxe',
                        'suite' => 'Suite',
                    ];
                @endphp
                <tr>
                    <td>
                        <div class="text-bold">{{ $hotel->name }}
                            ({{ $roomTypeNames[$roomType] ?? ucfirst($roomType) }})</div>
                        <div style="font-size: 11px; color: #666;">
                            {{ $h['rooms'] }} Rooms, {{ $h['nights'] }} Nights @if ($cnbCount + $extraBeds5To12Count + $extraBedsAbove12Count > 0)
                                , {{ $cnbCount + $extraBeds5To12Count + $extraBedsAbove12Count }} Extra Beds
                            @endif
                        </div>
                    </td>
                    <td class="col-price">Rs.{{ number_format($basePrice, 2) }}</td>
                    <td class="col-qty">{{ (int) $h['rooms'] * (int) $h['nights'] }}</td>
                    <td class="col-amount">Rs.{{ number_format($itemTotal, 2) }}</td>
                </tr>
            @endforeach

            {{-- Vehicles --}}
            @foreach ($calculation->selected_vehicles as $v)
                @php
                    $vehicle = \App\Models\Vehicle::find($v['vehicle_id']);
                    if (!$vehicle) {
                        continue;
                    }

                    $itemTotal = (float) $vehicle->price * (int) $v['vehicleCount'] * (int) $v['days'];
                    $subTotal += $itemTotal;
                @endphp
                <tr>
                    <td>
                        <div class="text-bold">{{ $vehicle->name }}</div>
                        <div style="font-size: 11px; color: #666;">
                            {{ $v['vehicleCount'] }} Units, {{ $v['days'] }} Days
                        </div>
                    </td>
                    <td class="col-price">Rs.{{ number_format($vehicle->price, 2) }}</td>
                    <td class="col-qty">{{ (int) $v['vehicleCount'] * (int) $v['days'] }}</td>
                    <td class="col-amount">Rs.{{ number_format($itemTotal, 2) }}</td>
                </tr>
            @endforeach

            {{-- Other Costs --}}
            @foreach ($calculation->other_costs as $c)
                @php
                    $itemTotal = (float) $c['price'];
                    $subTotal += $itemTotal;
                @endphp
                <tr>
                    <td>
                        <div class="text-bold">{{ $c['name'] }}</div>
                    </td>
                    <td class="col-price">Rs.{{ number_format($itemTotal, 2) }}</td>
                    <td class="col-qty">1</td>
                    <td class="col-amount">Rs.{{ number_format($itemTotal, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="summary-container">
        <div class="summary-notes">
            <div class="notes-title">NOTES / TERMS:</div>
            <div class="notes-content">
                {{ $agencySettings->terms_conditions ?? 'Rates are subject to availability at the time of booking.' }}
            </div>
        </div>
        <div class="summary-table-cell">
            <table class="summary-table">
                @php
                    $gstAmount = ($subTotal * $calculation->gst_percentage) / 100;
                    $profitAmount = (($subTotal + $gstAmount) * $calculation->profit_margin_percentage) / 100;
                    $total = $subTotal + $gstAmount + $profitAmount;
                @endphp
                <tr>
                    <td class="summary-label">Sub-Total</td>
                    <td class="summary-value">Rs.{{ number_format($subTotal, 2) }}</td>
                </tr>
                <tr>
                    <td class="summary-label">Tax ({{ $calculation->gst_percentage }}%)</td>
                    <td class="summary-value">Rs.{{ number_format($gstAmount, 2) }}</td>
                </tr>
                <tr>
                    <td class="summary-label">Profit ({{ $calculation->profit_margin_percentage }}%)</td>
                    <td class="summary-value">Rs.{{ number_format($profitAmount, 2) }}</td>
                </tr>
                <tr class="total-row">
                    <td class="summary-label">Total</td>
                    <td class="summary-value">Rs.{{ number_format($total, 2) }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="footer">
        <div class="footer-col" style="padding-right: 20px;">
            <div class="footer-title">Payment Method</div>
            <div class="footer-content">
                Bank: {{ $agencySettings->beneficiary_name ?? 'N/A' }}<br>
                Account Name: {{ $agencySettings->agency_name ?? 'N/A' }}<br>
                Account Number: {{ $agencySettings->account_number ?? 'N/A' }}<br>
                IFSC Code: {{ $agencySettings->ifsc_code ?? 'N/A' }}
            </div>
        </div>
        <div class="footer-col">
            <div class="footer-title">Prepared By</div>
            <div class="footer-content">
                <span class="text-bold">{{ $user->name }}</span><br>
                {{ $agencySettings->agency_name ?? 'Travel Agency' }}
            </div>
        </div>
    </div>
</body>

</html>
