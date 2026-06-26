<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use Illuminate\Http\Request;

class PublicBlogController extends Controller
{
    /**
     * Display blog index page
     */
    public function index(Request $request)
    {
        $posts = BlogPost::with(['category', 'tags', 'author'])
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->latest('published_at')
            ->paginate(12);

        $categories = BlogCategory::where('is_active', true)
            ->ordered()
            ->get();

        // Generate keywords from active categories and recent posts
        $categoryNames = $categories->pluck('name')->take(5)->implode(', ');
        $commonKeywords = "Best Travel CRM Agency, travel software, travel agency software, travel agent crm, crm software company, crm Systems, travel itinerary, crm for travel agents, travel website development, software development, ViaItinerary, travel packages, tour packages, honeymoon packages, family packages, best tour operator, hotel booking, cab booking";
        $keywords = $categoryNames ? "$categoryNames, $commonKeywords" : $commonKeywords;

        if ($request->has('amp')) {
            return response()->view('blog.amp-index', [
                'posts' => $posts,
                'categories' => $categories,
                'seoTitle' => "ViaItinerary: Travel CRM, Itinerary Builder & Lead Management Software",
                'seoDescription' => "Automate your travel business with ViaItinerary. Professional itinerary planning, client management, and real-time cost calculation for travel agents.",
                'seoKeywords' => $keywords,
            ])->header('X-Robots-Tag', 'index, follow');
        }

        return response()->view('blog.index', [
            'posts' => $posts,
            'categories' => $categories,
            'seoTitle' => "ViaItinerary: Travel CRM, Itinerary Builder & Lead Management Software",
            'seoDescription' => "Automate your travel business with ViaItinerary. Professional itinerary planning, client management, and real-time cost calculation for travel agents.",
            'seoKeywords' => $keywords,
            'currentCategory' => null,
            'currentTag' => null,
        ])->header('X-Robots-Tag', 'index, follow');
    }

    /**
     * Display a specific blog post
     */
    public function show(string $postSlug, Request $request)
    {
        $post = BlogPost::with(['category', 'tags', 'author'])
            ->where('slug', $postSlug)
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->firstOrFail();

        // Increment views asynchronously
        $post->incrementViews();

        if ($request->has('amp')) {
            return response()->view('blog.amp-show', [
                'post' => $post,
                'seoTitle' => $post->meta_title ?: $post->title,
                'seoDescription' => $post->meta_description ?: $post->excerpt,
            ])->header('X-Robots-Tag', 'index, follow');
        }

        // Related posts
        $relatedPosts = BlogPost::where('status', 'published')
            ->where('published_at', '<=', now())
            ->where('id', '!=', $post->id)
            ->when($post->blog_category_id, fn($q) => $q->where('blog_category_id', $post->blog_category_id))
            ->limit(3)
            ->latest('published_at')
            ->get();

        // Use post tags as keywords
        $keywords = $post->tags->pluck('name')->implode(', ');
        // Add category name to keywords if available
        if ($post->category) {
            $keywords = $keywords ? $post->category->name . ', ' . $keywords : $post->category->name;
        }

        return response()->view('blog.show', [
            'post' => $post,
            'relatedPosts' => $relatedPosts,
            'seoTitle' => $post->meta_title ?: $post->title,
            'seoDescription' => $post->meta_description ?: $post->excerpt,
            'seoKeywords' => $keywords ?: null,
            'ogImage' => $post->og_image_url ?: $post->featured_image_url,
            'canonicalUrl' => route('blog.show', ['postSlug' => $post->slug]),
        ])->header('X-Robots-Tag', 'index, follow');
    }

    /**
     * Display posts by category
     */
    public function category(string $categorySlug)
    {
        $category = BlogCategory::where('slug', $categorySlug)
            ->where('is_active', true)
            ->firstOrFail();

        $posts = BlogPost::with(['category', 'tags', 'author'])
            ->where('blog_category_id', $category->id)
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->latest('published_at')
            ->paginate(12);

        $categories = BlogCategory::where('is_active', true)
            ->ordered()
            ->get();

        return response()->view('blog.index', [
            'posts' => $posts,
            'categories' => $categories,
            'currentCategory' => $category,
            'currentTag' => null,
            'seoTitle' => "{$category->name} - ViaItinerary Blog",
            'seoDescription' => $category->description ?: "Browse {$category->name} articles",
            'seoKeywords' => $category->name,
        ])->header('X-Robots-Tag', 'index, follow');
    }

    /**
     * Display posts by tag
     */
    public function tag(string $tagSlug)
    {
        $tag = BlogTag::where('slug', $tagSlug)
            ->firstOrFail();

        $posts = $tag->posts()
            ->with(['category', 'tags', 'author'])
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->latest('published_at')
            ->paginate(12);

        $categories = BlogCategory::where('is_active', true)
            ->ordered()
            ->get();

        return response()->view('blog.index', [
            'posts' => $posts,
            'categories' => $categories,
            'currentCategory' => null,
            'currentTag' => $tag,
            'seoTitle' => "#{$tag->name} - ViaItinerary Blog",
            'seoDescription' => "Browse articles tagged with {$tag->name}",
            'seoKeywords' => $tag->name,
        ])->header('X-Robots-Tag', 'index, follow');
    }
}
