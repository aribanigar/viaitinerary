<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class EmailOtp extends Model
{
    protected $fillable = [
        'email',
        'otp',
        'expires_at',
    ];
}
