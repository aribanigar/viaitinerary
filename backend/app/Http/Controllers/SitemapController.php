<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use Illuminate\Http\Response;

class SitemapController extends Controller
{
    /**
     * Generate and return the sitemap.xml
     */
    public function index()
    {
        $blogPosts = BlogPost::where('status', 'published')
            ->where('published_at', '<=', now())
            ->get();

        // Use APP_URL from .env or fall back to request URL
        $baseUrl = rtrim(config('app.url', url('/')), '/');

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        // Homepage
        $xml .= '<url>';
        $xml .= '<loc>' . $baseUrl . '</loc>';
        $xml .= '<lastmod>' . now()->toAtomString() . '</lastmod>';
        $xml .= '<changefreq>daily</changefreq>';
        $xml .= '<priority>1.0</priority>';
        $xml .= '</url>';

        // Static pages
        $staticPages = [
            '/login' => ['changefreq' => 'monthly', 'priority' => '0.6'],
            '/signup' => ['changefreq' => 'monthly', 'priority' => '0.6'],
            '/schedule-demo' => ['changefreq' => 'weekly', 'priority' => '0.7'],
            '/subscription' => ['changefreq' => 'weekly', 'priority' => '0.8'],
            '/about-us' => ['changefreq' => 'monthly', 'priority' => '0.7'],
            '/solutions' => ['changefreq' => 'monthly', 'priority' => '0.7'],
            '/blog' => ['changefreq' => 'daily', 'priority' => '0.9'],
        ];

        foreach ($staticPages as $page => $meta) {
            $xml .= '<url>';
            $xml .= '<loc>' . $baseUrl . $page . '</loc>';
            $xml .= '<lastmod>' . now()->toAtomString() . '</lastmod>';
            $xml .= '<changefreq>' . $meta['changefreq'] . '</changefreq>';
            $xml .= '<priority>' . $meta['priority'] . '</priority>';
            $xml .= '</url>';
        }

        // Blog posts
        foreach ($blogPosts as $post) {
            $xml .= '<url>';
            $xml .= '<loc>' . $baseUrl . "/blog/{$post->slug}" . '</loc>';
            $xml .= '<lastmod>' . $post->updated_at->toAtomString() . '</lastmod>';
            $xml .= '<changefreq>weekly</changefreq>';
            $xml .= '<priority>0.8</priority>';
            $xml .= '</url>';
        }

        $xml .= '</urlset>';

        return response($xml, 200)
            ->header('Content-Type', 'text/xml');
    }
}
