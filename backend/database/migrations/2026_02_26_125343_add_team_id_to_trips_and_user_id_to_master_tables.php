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
            $table->foreignId('team_id')->nullable()->after('user_id')->constrained('teams')->onDelete('set null');
        });

        Schema::table('destinations', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->onDelete('cascade');
        });

        Schema::table('hotels', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->onDelete('cascade');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropForeign(['team_id']);
            $table->dropColumn('team_id');
        });

        Schema::table('destinations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('hotels', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};
