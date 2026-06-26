<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // No-op: subscription data is stored exclusively in the subscriptions table.
        // All subscription columns have been removed from the users table.
        // Run: php artisan migrate:fresh
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'plan_name',
                'trial_started_at',
                'trial_ends_at',
                'subscription_started_at',
                'subscription_ends_at',
                'trial_expired_notified_at',
                'seats',
            ]);
        });
    }
};
