<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use App\Models\Team;
use App\Models\BlogPost;

class BlogTag extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'name',
        'slug',
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
        return $this->belongsToMany(BlogPost::class, 'blog_post_tag');
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

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    public static function findOrCreateForUser(array $tagNames, int $teamId): array
    {
        $tagIds = [];

        foreach ($tagNames as $tagName) {
            $slug = Str::slug($tagName);
            $tag = self::firstOrCreate(
                ['team_id' => $teamId, 'slug' => $slug],
                ['name' => $tagName]
            );
            $tagIds[] = $tag->id;
        }

        return $tagIds;
    }
}
