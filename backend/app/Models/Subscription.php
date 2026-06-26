<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;

/**
 * Single source of truth for ALL subscription data (admin + team member).
 *
 * Schema: user_id (unique), plan_key, status, starts_at, ends_at,
 *         trial_ends_at, trial_expired_notified_at, trip_limit, trips_used
 */
class Subscription extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'starts_at'                   => 'datetime',
        'ends_at'                     => 'datetime',
        'trial_ends_at'               => 'datetime',
        'trial_expired_notified_at'   => 'datetime',
    ];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // -----------------------------------------------------------------------
    // Status helpers
    // -----------------------------------------------------------------------

    public function isTrial(): bool
    {
        return $this->plan_key === 'trial' && $this->status === 'trialing';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isExpired(): bool
    {
        if ($this->status === 'trialing') {
            return $this->trial_ends_at && Carbon::now()->greaterThan($this->trial_ends_at);
        }

        if ($this->status === 'active') {
            return $this->ends_at !== null && Carbon::now()->greaterThan($this->ends_at);
        }

        return false;
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['trialing', 'active']) && !$this->isExpired();
    }
}
