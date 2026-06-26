@php
    $brandColor = $agencySettings->brand_color ?? '#FAA61A';
    $secondaryColor = $agencySettings->secondary_color ?? '#0D2D2D';
    $agencyName = $agencySettings->agency_name ?? config('app.name');
    $contactPhone = $agencySettings->contact_phone ?? ($agencySettings->whatsapp ?? 'N/A');
    $contactEmail = $agencySettings->contact_email ?? config('mail.from.address');
    $checkInDate = $accommodation->check_in ? \Carbon\Carbon::parse($accommodation->check_in)->format('d M Y') : 'TBD';
    $checkOutDate = $accommodation->check_out
        ? \Carbon\Carbon::parse($accommodation->check_out)->format('d M Y')
        : 'TBD';
    $guestCount =
        ($trip->adults ?? 0) . ' Adults, ' . (($trip->kids_5_to_12 ?? 0) + ($trip->kids_cnb ?? 0)) . ' Children';

    $hotelTemplateMessage = 'Please confirm room availability for the guest booking shared below.';
@endphp

<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hotel Booking Request</title>
</head>

<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="background-color:#f4f6f8;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0"
                    style="width:680px;max-width:680px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ee;">
                    <tr>
                        <td style="background:{{ $secondaryColor }};padding:26px 28px 18px 28px;">
                            <p
                                style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;color:#ffffff;opacity:0.85;">
                                HOTEL BOOKING REQUEST</p>
                            <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.2;color:#ffffff;font-weight:800;">
                                New Booking Confirmation Request</h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:24px 28px 8px 28px;">
                            <p style="margin:0;font-size:15px;color:#1f2937;line-height:1.6;">Hello
                                {{ $accommodation->hotel->name ?? 'Hotel Team' }},</p>
                            <p style="margin:10px 0 0 0;font-size:14px;color:#4b5563;line-height:1.7;">
                                {!! nl2br(e($hotelTemplateMessage)) !!}
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:0 28px 16px 28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                                style="border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;">
                                        <p style="margin:0;font-size:12px;color:#6b7280;font-weight:700;">Guest</p>
                                        <p style="margin:4px 0 0 0;font-size:14px;color:#111827;font-weight:700;">
                                            {{ $trip->client_name ?? 'Guest' }}</p>
                                    </td>
                                    <td
                                        style="padding:14px 16px;border-bottom:1px solid #e5e7eb;border-left:1px solid #e5e7eb;">
                                        <p style="margin:0;font-size:12px;color:#6b7280;font-weight:700;">Trip ID</p>
                                        <p style="margin:4px 0 0 0;font-size:14px;color:#111827;font-weight:700;">
                                            {{ $trip->trip_id ?? 'N/A' }}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding:14px 16px;">
                                        <p style="margin:0;font-size:12px;color:#6b7280;font-weight:700;">Travel Agency
                                        </p>
                                        <p style="margin:4px 0 0 0;font-size:14px;color:#111827;font-weight:700;">
                                            {{ $agencyName }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:0 28px 8px 28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                                style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td colspan="2"
                                        style="background:{{ $brandColor }};padding:12px 14px;font-size:13px;font-weight:800;color:#ffffff;letter-spacing:0.3px;">
                                        Booking Details</td>
                                </tr>
                                <tr>
                                    <td
                                        style="width:42%;padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                                        Check-in</td>
                                    <td
                                        style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">
                                        {{ $checkInDate }}</td>
                                </tr>
                                <tr>
                                    <td
                                        style="padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                                        Check-out</td>
                                    <td
                                        style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">
                                        {{ $checkOutDate }}</td>
                                </tr>
                                <tr>
                                    <td
                                        style="padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                                        Rooms</td>
                                    <td
                                        style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">
                                        {{ $accommodation->room_count ?? ($accommodation->rooms ?? 'N/A') }}</td>
                                </tr>
                                <tr>
                                    <td
                                        style="padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                                        Room Type</td>
                                    <td
                                        style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">
                                        {{ $accommodation->room_type ?? 'Standard' }}</td>
                                </tr>
                                <tr>
                                    <td
                                        style="padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                                        Meal Plan</td>
                                    <td
                                        style="padding:11px 14px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">
                                        {{ $accommodation->meal_plan ?? 'As shared in itinerary' }}</td>
                                </tr>
                                <tr>
                                    <td
                                        style="padding:11px 14px;font-size:13px;font-weight:700;color:#374151;background:#f9fafb;">
                                        Guests</td>
                                    <td style="padding:11px 14px;font-size:13px;color:#111827;">{{ $guestCount }}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:8px 28px 16px 28px;">
                            <p style="margin:0;font-size:13px;line-height:1.7;color:#374151;font-weight:700;">Please
                                confirm:</p>
                            <p style="margin:8px 0 0 0;font-size:13px;line-height:1.8;color:#4b5563;">1. Room
                                availability for the above dates<br>2. Reconfirmation of room category and meal
                                plan<br>3. Any mandatory check-in notes or policies</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:0 28px 24px 28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                                style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
                                <tr>
                                    <td style="padding:12px 14px;font-size:12px;color:#6b7280;line-height:1.6;">
                                        Contact us for clarification: <strong
                                            style="color:#111827;">{{ $contactPhone }}</strong><br>
                                        Email: <strong style="color:#111827;">{{ $contactEmail }}</strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background:#f3f4f6;padding:16px 28px;font-size:12px;color:#6b7280;line-height:1.6;">
                            Thanks,<br>
                            <strong style="color:#111827;">{{ $agencyName }}</strong>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
