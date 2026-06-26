<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use App\Models\Team;
use Illuminate\Http\Request;

class BlogCategoryController extends Controller
{

    /**
     * List all categories for the authenticated admin's team
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        $categories = BlogCategory::where('team_id', $teamId)
            ->withCount('posts')
            ->ordered()
            ->get();

        return response()->json($categories);
    }

    /**
     * Create a new category
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:120',
            'description' => 'nullable|string',
            'display_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $teamId = $this->resolveTeamId($user);

        if (!$teamId) {
            return response()->json(['error' => 'Team not found'], 404);
        }

        // Generate slug if not provided
        $slug = $validated['slug'] ?? BlogCategory::generateSlug($validated['name'], $teamId);

        $category = BlogCategory::create([
            'team_id' => $teamId,
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'display_order' => $validated['display_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($category, 201);
    }

    /**
     * Show a specific category
     */
    public function show(BlogCategory $category)
    {
        $this->authorize('view', $category);
        return response()->json($category->load('posts'));
    }

    /**
     * Update a category
     */
    public function update(Request $request, BlogCategory $category)
    {
        $this->authorize('update', $category);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'slug' => 'nullable|string|max:120',
            'description' => 'nullable|string',
            'display_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        // Regenerate slug if name changed
        if (isset($validated['name']) && $validated['name'] !== $category->name) {
            $validated['slug'] = BlogCategory::generateSlug($validated['name'], $category->team_id, $category->id);
        }

        $category->update($validated);

        return response()->json($category);
    }

    /**
     * Delete a category
     */
    public function destroy(BlogCategory $category)
    {
        $this->authorize('delete', $category);
        $category->delete();
        return response()->json(['message' => 'Category deleted successfully'], 200);
    }

    /**
     * Reorder categories
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|exists:blog_categories,id',
            'categories.*.display_order' => 'required|integer|min:0',
        ]);

        foreach ($validated['categories'] as $categoryData) {
            BlogCategory::where('id', $categoryData['id'])
                ->update(['display_order' => $categoryData['display_order']]);
        }

        return response()->json(['message' => 'Categories reordered successfully'], 200);
    }

    /**
     * Resolve team ID for the authenticated admin
     */
    protected function resolveTeamId($user)
    {
        // For super_admin, we use a global blog context (team with slug 'agency')
        if ($user->role === 'super_admin') {
            $adminTeam = Team::where('slug', 'agency')->first();
            return $adminTeam ? $adminTeam->id : 1;
        }

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
