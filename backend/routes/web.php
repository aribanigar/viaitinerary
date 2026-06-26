<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ReactController;
use App\Http\Controllers\PublicBlogController;
use App\Http\Controllers\SitemapController;

// Public Blog Routes (must be before React catch-all)
Route::prefix('blog')->name('blog.')->group(function () {
    Route::get('/', [PublicBlogController::class, 'index'])->name('index');
    Route::get('/category/{categorySlug}', [PublicBlogController::class, 'category'])->name('category');
    Route::get('/tag/{tagSlug}', [PublicBlogController::class, 'tag'])->name('tag');
    Route::get('/{postSlug}', [PublicBlogController::class, 'show'])->name('show');
});

// Sitemap
Route::get('/sitemap.xml', [SitemapController::class, 'index']);

// React SPA catch-all (must be LAST)
Route::get('/{any}', [ReactController::class, 'index'])
    ->where('any', '^(?!api|blog|sitemap\.xml|preview-confirmation|test-classic-pdf|storage).*');
