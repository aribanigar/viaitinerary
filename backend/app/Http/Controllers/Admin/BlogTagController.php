<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogTag;
use App\Models\Team;
use Illuminate\Http\Request;

class BlogTagController extends Controller
{

    /**
     * List all tags for the authenticated admin's team
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        $tags = BlogTag::where('team_id', $teamId)
            ->withCount('posts')
            ->orderBy('name')
            ->get();

        return response()->json($tags);
    }

    /**
     * Create a new tag
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'slug' => 'nullable|string|max:60',
        ]);

        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        // Generate slug if not provided
        $slug = $validated['slug'] ?? BlogTag::generateSlug($validated['name'], $teamId);

        // Check if tag already exists
        $existingTag = BlogTag::where('team_id', $teamId)
            ->where('slug', $slug)
            ->first();

        if ($existingTag) {
            return response()->json(['error' => 'Tag already exists'], 409);
        }

        $tag = BlogTag::create([
            'team_id' => $teamId,
            'name' => $validated['name'],
            'slug' => $slug,
        ]);

        return response()->json($tag, 201);
    }

    /**
     * Delete a tag
     */
    public function destroy(BlogTag $tag)
    {
        $this->authorize('delete', $tag);

        // Detach from all posts
        $tag->posts()->detach();

        // Delete the tag
        $tag->delete();

        return response()->json(['message' => 'Tag deleted successfully'], 200);
    }

    /**
     * Merge tags (combine duplicates)
     */
    public function merge(Request $request)
    {
        $validated = $request->validate([
            'source_tag_ids' => 'required|array|min:2',
            'source_tag_ids.*' => 'required|exists:blog_tags,id',
            'target_tag_id' => 'required|exists:blog_tags,id',
        ]);

        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        $targetTag = BlogTag::findOrFail($validated['target_tag_id']);

        // Verify target tag belongs to user's team
        if ($targetTag->team_id !== $teamId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        foreach ($validated['source_tag_ids'] as $sourceTagId) {
            if ($sourceTagId == $validated['target_tag_id']) {
                continue;
            }

            $sourceTag = BlogTag::findOrFail($sourceTagId);

            // Verify source tag belongs to user's team
            if ($sourceTag->team_id !== $teamId) {
                continue;
            }

            // Reassign all posts from source tag to target tag
            $posts = $sourceTag->posts;
            foreach ($posts as $post) {
                $post->tags()->syncWithoutDetaching([$targetTag->id]);
            }

            // Delete source tag
            $sourceTag->delete();
        }

        return response()->json([
            'message' => 'Tags merged successfully',
            'target_tag' => $targetTag->fresh(['posts']),
        ], 200);
    }

    /**
     * Resolve team ID for the authenticated admin
     */
    protected function resolveTeamId($user)
    {
        $team = Team::where('created_by', $user->id)->first();

        if (!$team) {
            $team = Team::create([
                'user_id' => $user->id,
                'created_by' => $user->id,
                'slug' => Team::generateSlug($user->name),
            ]);
        }

        return $team->id;
    }
}
