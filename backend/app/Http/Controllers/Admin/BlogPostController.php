<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Team;
use App\Traits\SanitizesHtml;
use Illuminate\Http\Request;

class BlogPostController extends Controller
{
    use SanitizesHtml;

    /**
     * List all blog posts for the authenticated admin
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        $query = BlogPost::with(['category', 'tags', 'author'])
            ->where('team_id', $teamId);

        // Filters
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->has('category_id')) {
            $query->where('blog_category_id', $request->input('category_id'));
        }

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('excerpt', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->latest()->paginate($request->input('per_page', 25))
        );
    }

    /**
     * Create a new blog post
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'excerpt' => 'nullable|string|max:500',
            'content' => 'required|string',
            'featured_image' => 'nullable|string',
            'blog_category_id' => 'nullable|exists:blog_categories,id',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'status' => 'nullable|in:draft,published,scheduled',
            'published_at' => 'nullable|date',
            'meta_title' => 'nullable|string|max:160',
            'meta_description' => 'nullable|string|max:300',
            'og_image' => 'nullable|string',
        ]);

        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        // Sanitize HTML content
        $validated['content'] = $this->sanitizeHtml($validated['content']);

        // Generate slug from provided slug or title
        $slugSource = !empty($validated['slug']) ? $validated['slug'] : $validated['title'];
        $slug = BlogPost::generateSlug($slugSource, $teamId);

        // Auto-set published_at if status is published
        $status = $validated['status'] ?? 'draft';
        if ($status === 'published' && !isset($validated['published_at'])) {
            $validated['published_at'] = now();
        }

        // Calculate read time
        $readTime = $this->calculateReadingTime($validated['content'] ?? '');

        $post = BlogPost::create([
            'team_id' => $teamId,
            'author_id' => $user->id,
            'title' => $validated['title'],
            'slug' => $slug,
            'excerpt' => $validated['excerpt'] ?? null,
            'content' => $validated['content'] ?? '',
            'featured_image' => $validated['featured_image'] ?? null,
            'blog_category_id' => $validated['blog_category_id'] ?? null,
            'status' => $status,
            'published_at' => $validated['published_at'] ?? null,
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
            'og_image' => $validated['og_image'] ?? null,
            'read_time_minutes' => $readTime,
        ]);

        // Sync tags
        if (isset($validated['tags']) && !empty($validated['tags'])) {
            $tagIds = BlogTag::findOrCreateForUser($validated['tags'], $teamId);
            $post->tags()->sync($tagIds);
        }

        return response()->json($post->load(['category', 'tags', 'author']), 201);
    }

    /**
     * Show a specific blog post
     */
    public function show(BlogPost $post)
    {
        $this->authorize('view', $post);
        return response()->json($post->load(['category', 'tags', 'author']));
    }

    /**
     * Update a blog post
     */
    public function update(Request $request, BlogPost $post)
    {
        $this->authorize('update', $post);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'excerpt' => 'nullable|string|max:500',
            'content' => 'sometimes|required|string',
            'featured_image' => 'nullable|string',
            'blog_category_id' => 'nullable|exists:blog_categories,id',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'status' => 'nullable|in:draft,published,scheduled,archived',
            'published_at' => 'nullable|date',
            'meta_title' => 'nullable|string|max:160',
            'meta_description' => 'nullable|string|max:300',
            'og_image' => 'nullable|string',
        ]);

        // Sanitize HTML content if provided
        if (isset($validated['content'])) {
            $validated['content'] = $this->sanitizeHtml($validated['content']);
            $validated['read_time_minutes'] = $this->calculateReadingTime($validated['content']);
        }

        // Handle slug update: if slug is manually provided OR if title changed and slug wasn't manually provided
        if (!empty($request->slug)) {
            $validated['slug'] = BlogPost::generateSlug($request->slug, $post->team_id, $post->id);
        } elseif (isset($validated['title']) && $validated['title'] !== $post->title) {
            $validated['slug'] = BlogPost::generateSlug($validated['title'], $post->team_id, $post->id);
        }

        // Set published_at if status changed to published and it was never set
        if (isset($validated['status']) && $validated['status'] === 'published' && !$post->published_at) {
            $validated['published_at'] = now();
        }

        $post->update($validated);

        // Sync tags
        if (isset($validated['tags'])) {
            $tagIds = BlogTag::findOrCreateForUser($validated['tags'], $post->team_id);
            $post->tags()->sync($tagIds);
        }

        return response()->json($post->fresh(['category', 'tags', 'author']));
    }

    /**
     * Delete a blog post
     */
    public function destroy(BlogPost $post)
    {
        $this->authorize('delete', $post);
        $post->delete();
        return response()->json(['message' => 'Post deleted successfully'], 200);
    }

    /**
     * Publish a blog post
     */
    public function publish(BlogPost $post)
    {
        $this->authorize('publish', $post);

        $post->update([
            'status' => 'published',
            'published_at' => $post->published_at ?? now(),
        ]);

        return response()->json($post);
    }

    /**
     * Unpublish a blog post (revert to draft)
     */
    public function unpublish(BlogPost $post)
    {
        $this->authorize('update', $post);

        $post->update([
            'status' => 'draft',
        ]);

        return response()->json($post);
    }

    /**
     * Resolve team ID for the authenticated admin
     */
    protected function resolveTeamId($user)
    {
        // For super_admin, we find the team created by them. 
        // If not exists, we use a fallback or create one.
        if ($user->role === 'super_admin') {
            $team = Team::where('created_by', $user->id)->first();
            if (!$team) {
                // Check for 'agency' slug as a fallback if that's the intended global team
                $team = Team::where('slug', 'agency')->first();
            }
            return $team ? $team->id : 1;
        }

        // For admin users, find or create their team record
        $team = Team::where('created_by', $user->id)->first();

        if (!$team) {
            // Create default team for admin if not exists
            $team = Team::create([
                'user_id' => $user->id,
                'created_by' => $user->id,
                'slug' => Team::generateSlug($user->name),
            ]);
        }

        return $team->id;
    }
}
