<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use App\Models\Trip;

/**
 * Team record for team-role users.
 *
 * Subscription data is no longer stored here.
 * is_paid is computed from the linked user's subscription row.
 */
class Team extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'created_by',
        'slug',
        'job_title',
        'phone',
        'image_path',
        'commission_rate',
        'is_active',
    ];

    protected $appends = ['image_url', 'name', 'email', 'role', 'status', 'trips_count', 'is_paid'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // -----------------------------------------------------------------------
    // Computed attributes
    // -----------------------------------------------------------------------

    /**
     * True when the member has an active, non-expired, non-trial subscription.
     * Computed from the subscriptions table — not stored on teams.
     * Requires user (+ user.subscription) to be eager-loaded for N+1 safety.
     */
    public function getIsPaidAttribute(): bool
    {
        $user = $this->relationLoaded('user') ? $this->user : null;
        if (!$user) {
            return false;
        }

        $sub = $user->relationLoaded('subscription')
            ? $user->subscription
            : $user->subscription()->first();

        return $sub && $sub->status === 'active' && !$sub->isExpired();
    }

    public function getNameAttribute(): ?string
    {
        return $this->user ? $this->user->name : null;
    }

    public function getEmailAttribute(): ?string
    {
        return $this->user ? $this->user->email : null;
    }

    public function getRoleAttribute(): ?string
    {
        return $this->user ? $this->user->role : null;
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        if (str_starts_with($this->image_path, 'http')) {
            return $this->image_path;
        }

        return url('/api/storage/' . $this->image_path);
    }

    public function getStatusAttribute(): string
    {
        return $this->is_active ? 'Active' : 'Inactive';
    }

    public function getTripsCountAttribute(): int
    {
        return $this->user ? Trip::where('user_id', $this->user_id)->count() : 0;
    }

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function blogPosts()
    {
        return $this->hasMany(BlogPost::class, 'team_id');
    }

    public function blogCategories()
    {
        return $this->hasMany(BlogCategory::class, 'team_id');
    }

    public function blogTags()
    {
        return $this->hasMany(BlogTag::class, 'team_id');
    }

    // -----------------------------------------------------------------------
    // Route Binding
    // -----------------------------------------------------------------------

    public function getRouteKeyName()
    {
        return 'slug';
    }

    /**
     * Allow route-model binding to accept either a numeric id or the slug.
     * This keeps existing slug-based URLs working while allowing API clients
     * that send numeric IDs to resolve the model as well.
     */
    public function resolveRouteBinding($value, $field = null)
    {
        if (is_numeric($value)) {
            return $this->where('id', $value)->first();
        }

        $field = $field ?? $this->getRouteKeyName();
        return $this->where($field, $value)->first();
    }

    // -----------------------------------------------------------------------
    // Slug Generation
    // -----------------------------------------------------------------------

    public static function generateSlug(string $name): string
    {
        $baseSlug = Str::slug($name);
        $slug = $baseSlug;
        $counter = 1;

        while (self::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }
}
