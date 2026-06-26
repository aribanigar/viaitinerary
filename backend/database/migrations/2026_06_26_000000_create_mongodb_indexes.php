<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use MongoDB\Laravel\Schema\Blueprint;

/**
 * MongoDB is schemaless, so unlike the relational migrations we don't define
 * columns — we only create the indexes that enforce uniqueness and keep the
 * common lookups fast. (The original MySQL migrations are kept for reference in
 * database/migrations_sql_archive/.)
 */
return new class extends Migration
{
    protected $connection = 'mongodb';

    public function up(): void
    {
        $schema = Schema::connection('mongodb');

        $schema->table('users', function (Blueprint $c) {
            $c->unique('email');
            $c->index('team_id');
            $c->index('role');
            $c->index('embed_token');
        });

        $schema->table('teams', function (Blueprint $c) {
            $c->unique('slug');
            $c->index('user_id');
        });

        $schema->table('trips', function (Blueprint $c) {
            $c->unique('trip_id');
            $c->index('user_id');
            $c->index('team_id');
            $c->index('status');
        });

        // Trip-related collections, looked up by trip_id.
        foreach (['itineraries', 'accommodations', 'transportations', 'payments', 'calculations'] as $collection) {
            $schema->table($collection, function (Blueprint $c) {
                $c->index('trip_id');
            });
        }

        $schema->table('destinations', function (Blueprint $c) {
            $c->index('user_id');
        });
        $schema->table('hotels', function (Blueprint $c) {
            $c->index('user_id');
            $c->index('city');
        });
        $schema->table('vehicles', function (Blueprint $c) {
            $c->index('user_id');
        });

        $schema->table('subscriptions', function (Blueprint $c) {
            $c->index('user_id');
            $c->index('status');
        });

        $schema->table('lead_inquiries', function (Blueprint $c) {
            $c->index('user_id');
            $c->index('status');
            $c->index('assigned_to');
        });

        $schema->table('plans', function (Blueprint $c) {
            $c->unique('slug');
        });

        // Blog
        $schema->table('blog_posts', function (Blueprint $c) {
            $c->unique('slug');
            $c->index('blog_category_id');
            $c->index('status');
        });
        $schema->table('blog_categories', function (Blueprint $c) {
            $c->unique('slug');
        });
        $schema->table('blog_tags', function (Blueprint $c) {
            $c->unique('slug');
        });

        // Accounting
        foreach (['accounting_obligations', 'accounting_settlements'] as $collection) {
            $schema->table($collection, function (Blueprint $c) {
                $c->index('trip_id');
            });
        }

        // Auth / Sanctum
        $schema->table('personal_access_tokens', function (Blueprint $c) {
            $c->unique('token');
            $c->index(['tokenable_id', 'tokenable_type']);
        });

        $schema->table('user_active_sessions', function (Blueprint $c) {
            $c->index('user_id');
        });
        $schema->table('email_otps', function (Blueprint $c) {
            $c->index('email');
        });
    }

    public function down(): void
    {
        $schema = Schema::connection('mongodb');
        foreach ([
            'users', 'teams', 'trips', 'itineraries', 'accommodations', 'transportations',
            'payments', 'calculations', 'destinations', 'hotels', 'vehicles', 'subscriptions',
            'lead_inquiries', 'plans', 'blog_posts', 'blog_categories', 'blog_tags',
            'accounting_obligations', 'accounting_settlements', 'personal_access_tokens',
            'user_active_sessions', 'email_otps',
        ] as $collection) {
            if ($schema->hasCollection($collection)) {
                $schema->drop($collection);
            }
        }
    }
};
