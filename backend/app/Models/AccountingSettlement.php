<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingSettlement extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'settlement_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function obligation()
    {
        return $this->belongsTo(AccountingObligation::class, 'obligation_id');
    }

    public function trip()
    {
        return $this->belongsTo(Trip::class);
    }
}
