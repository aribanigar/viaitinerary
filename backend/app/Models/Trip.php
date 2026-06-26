<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Trip extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;
    use \App\Traits\BelongsToAdmin;

    protected $fillable = [
        'user_id',
        'team_id',
        'trip_id',
        'trip_title',
        'destination',
        'destination_id',
        'client_name',
        'client_phone',
        'client_email',
        'adults',
        'kids_cnb',
        'kids_5_to_12',
        'start_date',
        'duration',
        'cost',
        'gst_amount',
        'paid_amount',
        'refunded_amount',
        'currency',
        'image_path',
        'status',
        'template',
        'inclusions',
        'exclusions',
        'include_gst',
        'follow_up_sent',
        'confirmation_sent',
        'use_flight',
        'flight_locations',
        'transport_type',
        'transport_details',
        'other_costs',
        'tagline',
        'traveler_names',
        'departure_date_time',
        'arrival_date_time',
        'return_departure_date_time',
        'return_arrival_date_time'
    ];

    protected $casts = [
        'inclusions' => 'array',
        'exclusions' => 'array',
        'include_gst' => 'boolean',
        'follow_up_sent' => 'boolean',
        'confirmation_sent' => 'boolean',
        'use_flight' => 'boolean',
        'transport_details' => 'array',
        'other_costs' => 'array',
        'departure_date_time' => 'datetime:d-m-Y H:i',
        'start_date' => 'date:d-m-Y',
    ];

    protected $appends = ['image_url', 'currency_symbol'];

    public function getCurrencySymbolAttribute()
    {
        $currency = trim((string) $this->currency);
        if ($currency === '') {
            return '₹';
        }

        // Handle persisted HTML entities (e.g. &#8377;) before parsing.
        $currency = html_entity_decode($currency, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $extractedSymbol = null;
        if (preg_match('/\((.*?)\)/u', $currency, $matches)) {
            $extractedSymbol = trim($matches[1]);
        }

        // If no parenthesized symbol is present, try any currency glyph in the value.
        if (!$extractedSymbol && preg_match('/\p{Sc}/u', $currency, $matches)) {
            $extractedSymbol = $matches[0];
        }

        $normalized = strtolower((string) $extractedSymbol);
        $isInvalidSymbol = in_array($normalized, ['', '?', 'rs', 'inr', 'rupee', 'rupees'], true);
        if ($extractedSymbol && !$isInvalidSymbol) {
            return $extractedSymbol;
        }

        $currencyCode = null;
        if (preg_match('/\b([A-Z]{3})\b/i', $currency, $matches)) {
            $currencyCode = strtoupper($matches[1]);
        }

        $symbolByCode = [
            'INR' => '₹',
            'USD' => '$',
            'EUR' => '€',
            'GBP' => '£',
            'JPY' => '¥',
            'CNY' => '¥',
        ];

        if ($currencyCode && isset($symbolByCode[$currencyCode])) {
            return $symbolByCode[$currencyCode];
        }

        return '₹';
    }

    public function getImageUrlAttribute()
    {
        if (!$this->image_path) {
            return 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&q=80&w=1000';
        }

        if (str_starts_with($this->image_path, 'http')) {
            return $this->image_path;
        }

        // Return a path that hits our API storage proxy (for CORS)
        return url('/api/storage/' . $this->image_path);
    }

    public function getRouteKeyName()
    {
        return 'trip_id';
    }

    public function itineraries()
    {
        return $this->hasMany(Itinerary::class);
    }

    public function destination_ref()
    {
        return $this->belongsTo(Destination::class, 'destination_id');
    }

    public function accommodations()
    {
        return $this->hasMany(Accommodation::class);
    }

    public function transportations()
    {
        return $this->hasMany(Transportation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function accountingObligations()
    {
        return $this->hasMany(AccountingObligation::class);
    }
}
