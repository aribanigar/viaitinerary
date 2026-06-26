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
        Schema::table('demo_requests', function (Blueprint $table) {
            $table->dateTime('scheduled_at')->nullable()->after('referral_source');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demo_requests', function (Blueprint $table) {
            $table->dropColumn('scheduled_at');
        });
    }
};
