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
        Schema::table('trips', function (Blueprint $table) {
            $table->index('user_id');
            $table->index('team_id');
            $table->index('status');
            $table->index('created_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['role', 'status']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->index(['user_id', 'status']);
            $table->index('ends_at');
        });

        Schema::table('hotels', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
            $table->dropIndex(['team_id']);
            $table->dropIndex(['status']);
            $table->dropIndex(['created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'status']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'status']);
            $table->dropIndex(['ends_at']);
        });

        Schema::table('hotels', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
        });
    }
};
