<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'key',
        'country',
        'name',
        'price',
        'original_price',
        'duration_months',
        'trip_limit',
        'features',
        'badge_label',
        'recommended',
        'is_active',
        'is_offer',
        'offer_image',
        'offer_starts_at',
        'offer_expires_at',
        'team_member_limit',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_offer' => 'boolean',
        'recommended' => 'boolean',
        'price' => 'decimal:2',
        'features' => 'array',
        'offer_starts_at' => 'datetime',
        'offer_expires_at' => 'datetime',
    ];

    /**
     * Get the absolute URL for the offer image.
     */
    public function getOfferImageAttribute($value)
    {
        if (!$value) {
            return null;
        }

        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return $value;
        }

        // Remove any existing /storage/ or storage/ from the beginning if it exists
        // (to handle already incorrectly saved records)
        $cleanPath = ltrim(str_replace(['/storage/', 'storage/'], '', $value), '/');

        return url('api/storage/' . $cleanPath);
    }
}
