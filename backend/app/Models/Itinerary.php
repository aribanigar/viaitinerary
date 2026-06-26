<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;

class Itinerary extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $touches = ['trip'];

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
}
