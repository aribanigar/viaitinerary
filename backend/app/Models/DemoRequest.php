<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoRequest extends Model
{
    protected $fillable = [
        'name',
        'email',
        'contact_number',
        'invite_guests',
        'company_name',
        'no_of_employees',
        'agency_type',
        'destinations',
        'processes',
        'office_location',
        'referral_source',
        'scheduled_at',
        'status',
    ];

    protected $casts = [
        'processes' => 'array',
        'scheduled_at' => 'datetime:d-m-Y H:i',
    ];
}
