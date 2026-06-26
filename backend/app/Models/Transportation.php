<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transportation extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $touches = ['trip'];

    protected $casts = [
        'date' => 'date:d-m-Y',
    ];

    public function trip()
    {
        return $this->belongsTo(Trip::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }
}
