<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class AccountingObligation extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'due_date' => 'date',
        'expected_amount' => 'decimal:2',
        'settled_amount' => 'decimal:2',
    ];

    public function trip()
    {
        return $this->belongsTo(Trip::class);
    }

    public function settlements()
    {
        return $this->hasMany(AccountingSettlement::class, 'obligation_id');
    }
}
