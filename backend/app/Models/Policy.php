<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Policy extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'terms_conditions' => 'array',
        'must_haves' => 'array',
        'roles_responsibilities' => 'array',
        'cancellation_policy' => 'array',
        'additional_expenses' => 'array',
        'default_inclusions' => 'array',
        'default_exclusions' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
