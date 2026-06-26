<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Get the first team and set slug
$team = \App\Models\Team::first();

if ($team) {
    $team->slug = 'agency';
    $team->save();
    echo "✅ Team slug set to 'agency' for team ID: {$team->id}\n";
    echo "Blog URL: http://localhost:8000/agencies/agency/blog\n";
} else {
    echo "❌ No team found in database\n";
}

// Check blog posts
$postsCount = \App\Models\BlogPost::count();
echo "\nTotal blog posts: {$postsCount}\n";

if ($postsCount > 0) {
    echo "\nAvailable blog posts:\n";
    $posts = \App\Models\BlogPost::where('status', 'published')
        ->select('id', 'title', 'slug', 'team_id', 'status')
        ->get();

    foreach ($posts as $post) {
        echo "  - {$post->title} (/{$post->slug}) - Status: {$post->status}\n";
    }
} else {
    echo "No blog posts found. Create one in the dashboard at /blog/posts/new\n";
}
