<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\BlogCategory;
use App\Models\Team;
use Illuminate\Http\Request;

class BlogController extends Controller
{
    /**
     * Resolve the team IDs that hold public blog content.
     */
    private function getBlogTeamIds(): array
    {
        $superAdmin = \App\Models\User::where('role', 'super_admin')->first();
        $teamIds    = [];

        if ($superAdmin) {
            $teamIds = Team::where('created_by', $superAdmin->id)->pluck('id')->toArray();
        }

        $agencyTeam = Team::where('slug', 'agency')->first();
        if ($agencyTeam) {
            $teamIds[] = $agencyTeam->id;
        }

        return !empty($teamIds) ? array_unique($teamIds) : [1];
    }

    /**
     * Get all published blog posts for the super admin.
     */
    public function index(Request $request)
    {
        $teamIds = $this->getBlogTeamIds();

        $query = BlogPost::with(['category', 'tags', 'author'])
            ->whereIn('team_id', $teamIds)
            ->where('status', 'published')
            ->where('published_at', '<=', now());

        // Category filter
        if ($request->has('category')) {
            $query->whereHas('category', function ($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        // Tag filter
        if ($request->has('tag')) {
            $query->whereHas('tags', function ($q) use ($request) {
                $q->where('slug', $request->tag);
            });
        }

        // Search
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('excerpt', 'like', "%{$search}%");
            });
        }

        $posts = $query->latest('published_at')->paginate($request->input('per_page', 25));

        return response()->json($posts);
    }

    /**
     * Get a single blog post by slug.
     */
    public function show(Request $request, $slug)
    {
        $teamIds = $this->getBlogTeamIds();

        $query = BlogPost::with(['category', 'tags', 'author'])
            ->whereIn('team_id', $teamIds)
            ->where('slug', $slug);

        // Preview logic for Super Admins
        $user = $request->user('sanctum');
        $isSuperAdmin = $user && $user->role === 'super_admin';

        if (!$isSuperAdmin) {
            $query->where('status', 'published')
                ->where('published_at', '<=', now());
        }

        $post = $query->firstOrFail();

        // Increment view count only for published posts viewed by non-admins
        if ($post->status === 'published' && !$isSuperAdmin) {
            $post->incrementViews();
        }

        return response()->json($post);
    }

    /**
     * Get all blog categories.
     */
    public function categories()
    {
        $teamIds = $this->getBlogTeamIds();

        $categories = BlogCategory::whereIn('team_id', $teamIds)
            ->withCount(['posts' => function ($q) {
                $q->where('status', 'published');
            }])
            ->get();

        return response()->json($categories);
    }
}
