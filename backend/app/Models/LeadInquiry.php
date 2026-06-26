<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;

class LeadInquiry extends Model
{
    use HasFactory;

    protected $table = 'trip_inquiries';

    protected $fillable = [
        'inquiry_id',
        'user_id',
        'client_name',
        'client_email',
        'client_phone',
        'destination',
        'pax',
        'adults',
        'kids_cnb',
        'kids_5_to_12',
        'start_date',
        'duration',
        'approximate_budget',
        'currency',
        'special_requests',
        'status',
        'source_url',
        'notes',
        'ip_address',
        'is_public',
        'assigned_to',
        'external_id',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'gclid',
        'fb_lead_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'approximate_budget' => 'decimal:2',
    ];

    /**
     * Get the user (agency owner) that owns this inquiry.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the assigned team member/admin for this inquiry.
     */
    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Generate a unique inquiry ID.
     */
    public static function generateInquiryId(): string
    {
        do {
            $inquiryId = 'INQ' . mt_rand(100000, 999999);
        } while (self::where('inquiry_id', $inquiryId)->exists());

        return $inquiryId;
    }

    /**
     * Scope to filter by status.
     */
    public function scopeStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by date range.
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }
}
