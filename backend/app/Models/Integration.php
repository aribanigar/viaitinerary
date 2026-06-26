<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Integration extends Model
{
    protected $fillable = [
        'user_id',
        'platform',
        'platform_id',
        'access_token',
        'refresh_token',
        'expires_at',
        'settings',
        'is_active',
    ];

    protected $casts = [
        'settings' => 'array',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
