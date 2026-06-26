<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Accommodation extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $touches = ['trip'];

    protected $casts = [
        'bed_prices' => 'array',
        'cnb_count' => 'integer',
        'extra_beds_5_to_12_count' => 'integer',
        'extra_beds_above_12_count' => 'integer',
        'check_in' => 'date:d-m-Y',
        'check_out' => 'date:d-m-Y',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute()
    {
        if (!$this->image_path) {
            return null;
        }

        if (str_starts_with($this->image_path, 'http')) {
            return $this->image_path;
        }

        return url('/api/storage/' . $this->image_path);
    }

    public function trip()
    {
        return $this->belongsTo(Trip::class);
    }

    public function hotel()
    {
        return $this->belongsTo(Hotel::class);
    }
}
