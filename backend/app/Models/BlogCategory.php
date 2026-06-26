<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use App\Models\Team;
use App\Models\BlogPost;

class BlogCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'name',
        'slug',
        'description',
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function team()
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    public function posts()
    {
        return $this->hasMany(BlogPost::class, 'blog_category_id');
    }

    // -----------------------------------------------------------------------
    // Scopes
    // -----------------------------------------------------------------------

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order', 'asc');
    }

    // -----------------------------------------------------------------------
    // Slug Generation
    // -----------------------------------------------------------------------

    public static function generateSlug(string $name, int $teamId, ?int $excludeId = null): string
    {
        $baseSlug = Str::slug($name);
        $slug = $baseSlug;
        $counter = 1;

        while (self::where('team_id', $teamId)
            ->where('slug', $slug)
            ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
            ->exists()
        ) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }
}
