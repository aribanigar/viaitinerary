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
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('is_offer')->default(false)->after('is_active');
            $table->string('offer_image')->nullable()->after('is_offer');
            $table->timestamp('offer_expires_at')->nullable()->after('offer_image');
            $table->unsignedInteger('team_member_limit')->nullable()->after('offer_expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['is_offer', 'offer_image', 'offer_expires_at', 'team_member_limit']);
        });
    }
};
