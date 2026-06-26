<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrustedCompany extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'logo_path',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the full URL for the logo.
     */
    public function getLogoUrlAttribute()
    {
        if (!$this->logo_path) {
            return null;
        }

        if (filter_var($this->logo_path, FILTER_VALIDATE_URL)) {
            return $this->logo_path;
        }

        return url('/api/storage/' . $this->logo_path);
    }

    protected $appends = ['logo_url'];
}
