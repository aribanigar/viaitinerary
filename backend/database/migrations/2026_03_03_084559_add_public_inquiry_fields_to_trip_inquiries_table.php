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
        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->boolean('is_public')->default(false)->after('ip_address');
            $table->unsignedBigInteger('assigned_to')->nullable()->after('is_public');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->dropForeign(['assigned_to']);
            $table->dropColumn(['is_public', 'assigned_to']);
        });
    }
};
