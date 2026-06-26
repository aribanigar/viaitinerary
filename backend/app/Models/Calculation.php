<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Calculation extends Model
{
    protected $fillable = [
        'user_id',
        'client_name',
        'selected_hotels',
        'selected_vehicles',
        'other_costs',
        'gst_percentage',
        'profit_margin_percentage',
        'total_cost',
    ];

    protected $casts = [
        'selected_hotels' => 'array',
        'selected_vehicles' => 'array',
        'other_costs' => 'array',
        'number_of_people' => 'integer',
        'price_per_ticket' => 'float',
        'gst_percentage' => 'float',
        'profit_margin_percentage' => 'float',
        'total_cost' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
