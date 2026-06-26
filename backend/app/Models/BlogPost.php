<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;
use Illuminate\Support\Str;
use App\Models\Team;
use App\Models\User;
use App\Models\BlogCategory;
use App\Models\BlogTag;

class BlogPost extends Model
{
    use HasFactory;

    protected $guarded = ['id'];

    protected $casts = [
        'published_at' => 'datetime',
        'views_count' => 'integer',
        'read_time_minutes' => 'integer',
    ];

    protected $appends = ['featured_image_url', 'og_image_url', 'reading_time'];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function team()
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function category()
    {
        return $this->belongsTo(BlogCategory::class, 'blog_category_id');
    }

    public function tags()
    {
        return $this->belongsToMany(BlogTag::class, 'blog_post_tag');
    }

    // -----------------------------------------------------------------------
    // Route Binding
    // -----------------------------------------------------------------------

    public function resolveRouteBinding($value, $field = null)
    {
        // For super-admin routes, bypass team scoping and find by ID
        if (request()->is('api/super-admin/*')) {
            return $this->where($field ?? 'id', $value)->firstOrFail();
        }

        // For public blog routes with team parameter
        $teamSlug = request()->route('team');

        if ($teamSlug instanceof Team) {
            $team = $teamSlug;
        } else {
            $team = Team::where('slug', $teamSlug)->firstOrFail();
        }

        return $this->where('team_id', $team->id)
            ->where('slug', $value)
            ->firstOrFail();
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    public function getFeaturedImageUrlAttribute(): ?string
    {
        if (!$this->featured_image) {
            return null;
        }

        if (str_starts_with($this->featured_image, 'http')) {
            return $this->featured_image;
        }

        return url('/api/storage/' . $this->featured_image);
    }

    public function getOgImageUrlAttribute(): ?string
    {
        if ($this->og_image) {
            if (str_starts_with($this->og_image, 'http')) {
                return $this->og_image;
            }
            return url('/api/storage/' . $this->og_image);
        }

        return $this->featured_image_url;
    }

    public function getReadingTimeAttribute(): int
    {
        return $this->read_time_minutes ?: $this->calculateReadTime();
    }

    // -----------------------------------------------------------------------
    // State Helpers
    // -----------------------------------------------------------------------

    public function isPublished(): bool
    {
        return $this->status === 'published' &&
            $this->published_at &&
            $this->published_at->isPast();
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function canBePublished(): bool
    {
        return in_array($this->status, ['draft', 'archived']);
    }

    // -----------------------------------------------------------------------
    // Slug Generation
    // -----------------------------------------------------------------------

    /**
     * Generate a URL-friendly slug from title or input.
     * Follows SEO best practices: lowercase, handles special characters/foreign accents,
     * removes common "stop words", and ensures uniqueness with a suffix.
     */
    public static function generateSlug(string $title, int $teamId, ?int $excludeId = null): string
    {
        // 1-3. Lowercase, Space Substitution, Strip Special Characters/Accents
        // Str::slug in Laravel uses ASCII::to_ascii internally which handles accents (Café -> cafe)
        $slug = Str::slug($title, '-');

        // 4. Handling Stop Words (Optional/SEO)
        $stopWords = [
            'a',
            'an',
            'the',
            'in',
            'on',
            'at',
            'by',
            'of',
            'for',
            'with',
            'about',
            'to',
            'from',
            'is',
            'are',
            'was',
            'were',
            'and',
            'but',
            'or',
            'nor'
        ];

        $words = explode('-', $slug);
        $filteredWords = array_filter($words, function ($word) use ($stopWords, $words) {
            return !in_array($word, $stopWords) || count($words) <= 3; // Keep stop words if the title is very short
        });

        $baseSlug = !empty($filteredWords) ? implode('-', $filteredWords) : $slug;
        $finalSlug = $baseSlug;
        $counter = 1;

        // 5. Deduplication (The "Suffix" Rule)
        while (self::where('team_id', $teamId)
            ->where('slug', $finalSlug)
            ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
            ->exists()
        ) {
            $finalSlug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $finalSlug;
    }

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------

    public function incrementViews(): void
    {
        $this->increment('views_count');
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    protected function calculateReadTime(): int
    {
        $wordCount = str_word_count(strip_tags($this->content));
        return (int) ceil($wordCount / 200); // 200 words per minute
    }
}
