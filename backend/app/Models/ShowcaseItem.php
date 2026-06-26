<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShowcaseItem extends Model
{
    protected $fillable = [
        'city',
        'title',
        'agency_name',
        'whatsapp_number',
        'price',
        'image',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Get the full URL for the image.
     */
    public function getImageUrlAttribute()
    {
        if (!$this->image) {
            return null;
        }

        if (filter_var($this->image, FILTER_VALIDATE_URL)) {
            return $this->image;
        }

        // Use the API storage proxy for consistent behavior across environments (especially production)
        return url('/api/storage/' . $this->image);
    }

    protected $appends = ['image_url'];
}
