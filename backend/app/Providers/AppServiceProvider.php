<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use App\Models\BlogPost;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Policies\BlogPostPolicy;
use App\Policies\BlogCategoryPolicy;
use App\Policies\BlogTagPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register blog policies
        Gate::policy(BlogPost::class, BlogPostPolicy::class);
        Gate::policy(BlogCategory::class, BlogCategoryPolicy::class);
        Gate::policy(BlogTag::class, BlogTagPolicy::class);

        // Core Rate Limiters
        $this->configureRateLimiting();
    }

    /**
     * Configure the rate limiters for the application.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Strict limit for OTP sending to prevent cost spikes and abuse
        RateLimiter::for('otp', function (Request $request) {
            return [
                Limit::perMinute(1)->by($request->input('email') ?: $request->ip()),
                Limit::perHour(5)->by($request->input('email') ?: $request->ip()),
            ];
        });

        // Limit for login attempts to thwart brute-force
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->input('email') ?: $request->ip());
        });
    }
}
