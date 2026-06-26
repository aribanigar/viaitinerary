<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid #3b82f6;
        }

        .header h1 {
            color: #1e40af;
            margin: 0 0 8px 0;
            font-size: 24px;
        }

        .inquiry-id {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
            font-size: 14px;
        }

        .section {
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .detail-row {
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            font-weight: 600;
            color: #6b7280;
            width: 160px;
            flex-shrink: 0;
        }

        .detail-value {
            color: #111827;
            flex: 1;
        }

        .special-requests {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 6px;
            margin-top: 8px;
        }

        .cta-button {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin-top: 24px;
        }

        .cta-button:hover {
            background-color: #2563eb;
        }

        .footer {
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <h1>🌍 New Trip Inquiry</h1>
            <div class="inquiry-id">{{ $inquiry->inquiry_id }}</div>
        </div>

        <div class="section">
            <div class="section-title">Client Information</div>
            <div class="detail-row">
                <div class="detail-label">Name:</div>
                <div class="detail-value">{{ $inquiry->client_name }}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Email:</div>
                <div class="detail-value"><a href="mailto:{{ $inquiry->client_email }}">{{ $inquiry->client_email }}</a>
                </div>
            </div>
            @if ($inquiry->client_phone)
                <div class="detail-row">
                    <div class="detail-label">Phone:</div>
                    <div class="detail-value"><a
                            href="tel:{{ $inquiry->client_phone }}">{{ $inquiry->client_phone }}</a></div>
                </div>
            @endif
        </div>

        <div class="section">
            <div class="section-title">Trip Details</div>
            <div class="detail-row">
                <div class="detail-label">Destination:</div>
                <div class="detail-value">{{ $inquiry->destination }}</div>
            </div>
            @if ($inquiry->start_date)
                <div class="detail-row">
                    <div class="detail-label">Start Date:</div>
                    <div class="detail-value">{{ $inquiry->start_date->format('M d, Y') }}</div>
                </div>
            @endif
            @if ($inquiry->duration)
                <div class="detail-row">
                    <div class="detail-label">Duration:</div>
                    <div class="detail-value">{{ $inquiry->duration }} nights / {{ $inquiry->duration + 1 }} days</div>
                </div>
            @endif
            @if ($inquiry->pax)
                <div class="detail-row">
                    <div class="detail-label">Passengers:</div>
                    <div class="detail-value">{{ $inquiry->pax }}</div>
                </div>
            @endif
            @if ($inquiry->approximate_budget)
                <div class="detail-row">
                    <div class="detail-label">Budget:</div>
                    <div class="detail-value">{{ $inquiry->currency }}
                        {{ number_format($inquiry->approximate_budget, 2) }}</div>
                </div>
            @endif
        </div>

        @if ($inquiry->special_requests)
            <div class="section">
                <div class="section-title">Special Requests</div>
                <div class="special-requests">
                    {{ $inquiry->special_requests }}
                </div>
            </div>
        @endif

        <div class="section">
            <div class="section-title">Source Information</div>
            @if ($inquiry->source_url)
                <div class="detail-row">
                    <div class="detail-label">Source URL:</div>
                    <div class="detail-value" style="word-break: break-all;">{{ $inquiry->source_url }}</div>
                </div>
            @endif
            <div class="detail-row">
                <div class="detail-label">Submitted:</div>
                <div class="detail-value">{{ $inquiry->created_at->format('M d, Y - h:i A') }}</div>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="{{ config('app.frontend_url') }}/trip-inquiries" class="cta-button">
                View in Dashboard →
            </a>
        </div>

        <div class="footer">
            <p>This is an automated notification from your Travel Agency CRM.</p>
            <p>Please respond to the client within 24 hours for best results.</p>
        </div>
    </div>
</body>

</html>
