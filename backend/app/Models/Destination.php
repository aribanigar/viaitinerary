<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Destination extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;
    use \App\Traits\BelongsToAdmin;

    protected $fillable = [
        'user_id',
        'name',
        'activities',
        'image_path',
    ];

    protected $casts = [
        'activities' => 'array',
    ];

    protected $appends = ['image_url', 'creator_name', 'creator_email'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getCreatorNameAttribute()
    {
        return $this->user ? $this->user->name : 'Unknown';
    }

    public function getCreatorEmailAttribute()
    {
        return $this->user ? $this->user->email : 'Unknown';
    }

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
}
