<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserActiveSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'personal_access_token_id',
        'device_id',
        'user_agent',
        'ip_address',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}